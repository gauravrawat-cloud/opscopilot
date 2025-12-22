import json
import logging
from datetime import datetime
import os
import requests


import azure.functions as func

app = func.FunctionApp()

@app.queue_trigger(
    arg_name="msg",
    queue_name="ops-items",
    connection="AzureWebJobsStorage"
)
def analyze_item(msg: func.QueueMessage):
    raw = msg.get_body().decode("utf-8")
    logging.info("🔔 analyze_item triggered. raw message: %s", raw)

    try:
        payload = json.loads(raw)
    except Exception as e:
        logging.error("❌ Failed to parse JSON: %s", e)
        return

    item_id = payload.get("id")
    action = payload.get("action")

    analysis = {
        "summary": "Stub summary: ops issue needs investigation.",
        "category": "Incident",
        "tags": ["azure", "functions", "queue"],
        "severity": 3,
        "reasoning": "Stub reasoning based on keywords.",
        "nextSteps": [
            "Check recent deployments",
            "Review logs",
            "Validate dependencies"
        ],
        "modelInfo": {
            "provider": "stub",
            "model": "none",
            "generatedAt": datetime.utcnow().isoformat() + "Z"
        }
    }

    logging.info("✅ Parsed payload. id=%s action=%s", item_id, action)
    logging.info("🧠 Stub analysis: %s", json.dumps(analysis))
    api_base = os.getenv("API_BASE_URL", "http://localhost:7071").rstrip("/")
    if item_id:
        url = f"{api_base}/api/items/{item_id}/analysis"
        try:
            r = requests.post(url, json=analysis, timeout=10)
            logging.info("📤 Posted analysis to API. status=%s body=%s", r.status_code, r.text)
        except Exception as e:
            logging.error("❌ Failed to POST analysis to API: %s", e)
    else:
        logging.error("❌ No item_id in payload; cannot post analysis")

