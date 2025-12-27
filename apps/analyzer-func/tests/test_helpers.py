import re
from analyzer_func.helpers import (
    clamp,
    strip_control_chars,
    safe_truncate,
    build_embedding_text,
    build_rag_context,
)

def test_clamp_bounds():
    assert clamp(5, 1, 10) == 5
    assert clamp(-1, 1, 10) == 1
    assert clamp(999, 1, 10) == 10

def test_strip_control_chars_removes_non_printing():
    s = "abc\x00\x07\x1Fdef\x7Fghi"
    out = strip_control_chars(s)
    assert out == "abcdefghi"

def test_safe_truncate_no_change_when_short():
    s = "hello"
    assert safe_truncate(s, 10) == "hello"

def test_safe_truncate_truncates_and_appends_marker():
    s = "a" * 20
    out = safe_truncate(s, 10)
    assert out.startswith("a" * 10)
    assert out.endswith("…[truncated]")
    assert len(out) > 10  # marker added

def test_build_embedding_text_format():
    text = build_embedding_text("T", "D", "system1", "dev")
    assert "title: T" in text
    assert "system: system1" in text
    assert "env: dev" in text
    assert "description: D" in text
    # consistent newlines
    assert text.endswith("\n")

def test_build_rag_context_empty():
    assert build_rag_context([]) == "No similar past incidents found."

def test_build_rag_context_includes_summary_and_next_steps():
    similar_items = [
        {
            "id": "1",
            "title": "Incident A",
            "analysis": {
                "summary": "Summary A",
                "nextSteps": ["a", "b", "c", "d"]
            }
        }
    ]
    out = build_rag_context(similar_items)
    assert "Similar past incidents" in out
    assert "id=1" in out
    assert "title=Incident A" in out
    assert "summary: Summary A" in out
    # only first 3 next steps included
    assert "nextSteps: ['a', 'b', 'c']" in out
    assert "nextSteps: ['a', 'b', 'c', 'd']" not in out

