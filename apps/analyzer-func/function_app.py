import json
import logging
import os
import re
from datetime import datetime

import requests
import azure.functions as func
from openai import OpenAI

app = func.FunctionApp()
client = OpenAI()

# -----------------------
# helpers
# -----------------------

def getenv_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except:
        return default

def getenv_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except:
        return default

def clamp(n: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, n))

def strip_control_chars(s: str) -> str:
    return re.sub(r"[\x00-\x08\x0B-\x1F\x7F]", "", s or "")

def safe_truncate(text: str, max_chars: int) -> str:
    text = strip_control_chars(text)
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "…[truncated]"

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

    logging.info(
        "analyze_item id=%s model=%s title_len=%d desc_len=%d",
        item_id, model, len(title), len(description)
    )

    try:
        prompt = f"""
            You are an SRE assistant.

            Analyze the following ops issue and return a structured incident analysis.

            Context:
            Title: {title}
            Description: {description}
            System: {system}
            Environment: {env}
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

    except Exception as e:
        logging.error("OpenAI analysis failed for %s: %s", item_id, e)
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
