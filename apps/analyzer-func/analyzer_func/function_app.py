import json
import logging
import os
import re
from datetime import datetime

import requests
import azure.functions as func
from openai import OpenAI
from azure.cosmos import CosmosClient, PartitionKey
from .helpers import (
    getenv_int, getenv_float, clamp,
    strip_control_chars, safe_truncate,
    build_embedding_text, build_rag_context
)

app = func.FunctionApp()
client = OpenAI()

# -----------------------
# helpers
# -----------------------

def get_cosmos_containers():
    endpoint = os.getenv("COSMOS_ENDPOINT")
    key = os.getenv("COSMOS_KEY")
    db_name = os.getenv("COSMOS_DB_NAME", "opscopilot")
    items_name = os.getenv("COSMOS_ITEMS_CONTAINER", "items")
    vectors_name = os.getenv("COSMOS_VECTORS_CONTAINER", "item_vectors")

    if not endpoint or not key:
        raise ValueError("COSMOS_ENDPOINT / COSMOS_KEY missing")

    client = CosmosClient(endpoint, credential=key)
    db = client.get_database_client(db_name)
    items = db.get_container_client(items_name)
    vectors = db.get_container_client(vectors_name)
    return items, vectors

def get_embedding(text: str) -> list[float]:
    embed_model = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small")
    # OpenAI client is already created above
    resp = client.embeddings.create(
        model=embed_model,
        input=text
    )
    return resp.data[0].embedding

def upsert_item_vector(item_id: str, system: str, env: str, title: str, embedding: list[float]):
    _, vectors = get_cosmos_containers()
    now = datetime.utcnow().isoformat() + "Z"
    pk = system or "global"

    doc = {
        "id": item_id,
        "pk": pk,
        "itemId": item_id,
        "embedding": embedding,
        "system": system,
        "env": env,
        "title": title,
        "createdAt": now,
        "updatedAt": now,
        "embeddingModel": os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small"),
        "embeddingDims": len(embedding),
        "source": "item"
    }
    vectors.upsert_item(doc)

def find_similar_item_ids(system: str, query_embedding: list[float], top_k: int = 3) -> list[dict]:
    """
    Returns list of dicts: [{ "itemId": "...", "score": <distance> }, ...]
    Filters to same system via pk.
    """
    _, vectors = get_cosmos_containers()
    pk = system or "global"

    # NOTE: Always use TOP N with vector search (recommended by Cosmos docs)
    query = """
    SELECT TOP @topK c.itemId,
           VectorDistance(c.embedding, @qv) AS score,
           c.title, c.env
    FROM c
    WHERE c.pk = @pk
    ORDER BY VectorDistance(c.embedding, @qv)
    """

    params = [
        {"name": "@topK", "value": top_k + 1},  # +1 so we can drop self-match if it appears
        {"name": "@pk", "value": pk},
        {"name": "@qv", "value": query_embedding},
    ]

    items = list(
        vectors.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=False,   # filter by pk, so keep it single-partition
        )
    )

    # remove self-match if present (VectorDistance to itself is usually 0)
    return items

def fetch_items_by_ids(system: str, item_ids: list[str]) -> list[dict]:
    """
    Fetch items from the main `items` container by id within the same system partition.
    Items container pk is /pk (or /system).
    """
    items_container, _ = get_cosmos_containers()

    results = []
    for iid in item_ids:
        try:
            doc = items_container.read_item(item=iid, partition_key=iid)
            results.append(doc)
        except Exception:
            continue
    return results

def get_item_status(item_id: str) -> str | None:
    items, _ = get_cosmos_containers()
    try:
        doc = items.read_item(item=item_id, partition_key=item_id)
        return doc.get("status")
    except Exception:
        return None
    
def post_status(item_id: str, status: str, stage: str | None = None, message: str | None = None):
    api_base = os.getenv("API_BASE_URL", "").rstrip("/")
    if not api_base:
        logging.error("API_BASE_URL not set")
        return

    headers = {}
    api_key = os.getenv("APP_API_KEY")
    if api_key:
        headers["x-api-key"] = api_key

    payload = {"status": status}
    if stage or message:
        payload["error"] = {
            "stage": stage,
            "message": message,
            "at": datetime.utcnow().isoformat() + "Z",
        }

    try:
        requests.post(
            f"{api_base}/api/items/{item_id}/status",
            json=payload,
            headers=headers,
            timeout=10
        )
    except Exception as e:
        logging.error("Failed to post status update for %s: %s", item_id, e)

# -----------------------
# function
# -----------------------

@app.queue_trigger(
    arg_name="msg",
    queue_name="ops-items",
    connection="AzureWebJobsStorage"
)
def analyze_item(msg: func.QueueMessage):
    raw = msg.get_body().decode("utf-8")

    try:
        payload = json.loads(raw)
    except Exception as e:
        logging.error("Invalid JSON payload: %s", e)
        return

    item_id = payload.get("id")
    if not item_id:
        logging.error("Missing item id")
        return
    
    # Idempotency, skip if already analyzed
    status = get_item_status(item_id)
    if status == "analyzed":
        logging.info("Skip analyze for %s (already analyzed)", item_id)
        return

    # env-configurable guardrails
    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    max_out = clamp(getenv_int("OPENAI_MAX_OUTPUT_TOKENS", 400), 100, 1200)
    max_in = clamp(getenv_int("OPENAI_MAX_INPUT_CHARS", 6000), 1000, 20000)
    timeout_s = clamp(getenv_int("OPENAI_TIMEOUT_SECONDS", 15), 5, 60)
    temperature = max(0.0, min(getenv_float("OPENAI_TEMPERATURE", 0.2), 1.0))

    title = safe_truncate(payload.get("title", ""), 200)
    description = safe_truncate(payload.get("description", ""), max_in)
    system = safe_truncate(payload.get("system", ""), 50)
    env = safe_truncate(payload.get("env", ""), 20)

    # 1) create embedding and upsert to item_vectors
    try:
        embed_text = build_embedding_text(title, description, system, env)
        emb = get_embedding(embed_text)
        upsert_item_vector(item_id, system, env, title, emb)
        logging.info("Vector upserted for item %s (dims=%d pk=%s)", item_id, len(emb), (system or "global"))
    except Exception as e:
        logging.error("Vector upsert failed for %s: %s", item_id, e)
        post_status(item_id, "failed", "embedding", str(e))
        return
    
    # 2) retrieve top-K similar vectors (same system only)
    top_k = int(os.getenv("RAG_TOP_K", "3"))
    similar = []
    try:
        candidates = find_similar_item_ids(system, emb, top_k=top_k)

        # drop the current item if it appears
        similar = [c for c in candidates if c.get("itemId") != item_id][:top_k]

        logging.info(
            "Retrieved %d similar items for %s (pk=%s): %s",
            len(similar), item_id, (system or "global"),
            [c.get("itemId") for c in similar]
        )
    except Exception as e:
        logging.error("Vector retrieval failed for %s: %s", item_id, e)
        post_status(item_id, "failed", "rag", str(e))
        return
    
    similar_ids = [s.get("itemId") for s in similar if s.get("itemId")]
    similar_docs = fetch_items_by_ids(system, similar_ids)
    rag_context = build_rag_context(similar_docs)

    logging.info(
        "analyze_item id=%s model=%s title_len=%d desc_len=%d",
        item_id, model, len(title), len(description)
    )

    try:
        prompt = f"""
            You are an SRE assistant.

            Analyze the following NEW ops issue and return a structured incident analysis.
            Use the similar past incidents as supporting context when relevant.
            If the similar incidents are not relevant, ignore them.

            NEW issue:
            Title: {title}
            Description: {description}
            System: {system}
            Environment: {env}

            {rag_context}
            """

        response = client.chat.completions.create(
            model=model,
            temperature=temperature,
            max_tokens=max_out,
            timeout=timeout_s,
            messages=[
                {
                    "role": "system",
                    "content": "Return ONLY valid JSON following the schema. Be concise and practical."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "OpsAnalysis",
                    "schema": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "summary": {"type": "string"},
                            "category": {
                                "type": "string",
                                "enum": ["Incident", "Performance", "Security", "Deployment", "Data", "Unknown"]
                            },
                            "severity": {"type": "integer", "minimum": 1, "maximum": 5},
                            "tags": {"type": "array", "items": {"type": "string"}},
                            "nextSteps": {
                                "type": "array",
                                "items": {"type": "string"},
                                "minItems": 3,
                                "maxItems": 7
                            }
                        },
                        "required": ["summary", "category", "severity", "tags", "nextSteps"]
                    }
                }
            }
        )

        analysis = json.loads(response.choices[0].message.content)

        analysis["rag"] = {
            "topK": int(os.getenv("RAG_TOP_K", "3")),
            "systemOnly": True,
            "similarItems": [
                {"id": d.get("id") or d.get("itemId"), "title": d.get("title", "")}
                for d in similar_docs
            ],
        }
        analysis["rag"]["source"] = "cosmos-vector-search"
        analysis["rag"]["retrievedCount"] = len(similar_ids)

    except Exception as e:
        logging.error("OpenAI analysis failed for %s: %s", item_id, e)
        post_status(item_id, "failed", "openai", str(e))
        return

    # post analysis back to API
    api_base = os.getenv("API_BASE_URL", "").rstrip("/")
    api_key = os.getenv("APP_API_KEY")

    headers = {}
    if api_key:
        headers["x-api-key"] = api_key
    if not api_base:
        logging.error("API_BASE_URL not set")
        return

    try:
        r = requests.post(
            f"{api_base}/api/items/{item_id}/analysis",
            json=analysis,
            headers=headers,
            timeout=10
        )
        logging.info("Posted analysis for %s status=%s", item_id, r.status_code)
    except Exception as e:
        logging.error("Failed to post analysis to API: %s", e)
        post_status(item_id, "failed", "postback", str(e))
        return
