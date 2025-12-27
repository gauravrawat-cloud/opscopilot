import os
import re

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

def build_embedding_text(title: str, description: str, system: str, env: str) -> str:
    return (
        f"title: {title}\n"
        f"system: {system}\n"
        f"env: {env}\n"
        f"description: {description}\n"
    )

def build_rag_context(similar_items: list[dict]) -> str:
    if not similar_items:
        return "No similar past incidents found."

    lines = ["Similar past incidents (for reference):"]
    for i, it in enumerate(similar_items, start=1):
        analysis = it.get("analysis") or {}
        summary = analysis.get("summary") or "(no summary)"
        next_steps = analysis.get("nextSteps") or []
        next_steps_short = next_steps[:3]

        lines.append(
            f"{i}) id={it.get('id')} title={it.get('title','')}\n"
            f"   summary: {summary}\n"
            f"   nextSteps: {next_steps_short}\n"
        )
    return "\n".join(lines)