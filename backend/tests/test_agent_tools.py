import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import MagicMock, patch
import services.ai_agent as agent_module


def _make_db(rows):
    """Return a db mock whose execute().data == rows. Supports full query chain."""
    q = MagicMock()
    for m in ("select", "eq", "neq", "gte", "lte", "order", "limit", "range",
              "update", "insert", "single", "contains", "is_"):
        getattr(q, m).return_value = q
    result = MagicMock()
    result.data = rows
    q.execute.return_value = result
    db = MagicMock()
    db.table.return_value = q
    return db, q


def test_list_tickets_passes_all_filters(monkeypatch):
    db, q = _make_db([{"ticket_id": "T1", "subject": "hi"}])
    monkeypatch.setattr(agent_module, "get_db", lambda: db)

    result = agent_module._execute_tool("list_tickets", {
        "status": "NEW",
        "priority": "HIGH",
        "customer_segment": "ENT",
        "assigned_to": "alice",
        "category": "CHURN_SIGNAL",
        "no_reply": True,
        "created_after": "2026-01-01",
        "created_before": "2026-03-31",
        "sort_by": "created_at",
        "sort_desc": False,
        "limit": 5,
    })
    import json
    data = json.loads(result)
    assert isinstance(data, list)
    q.eq.assert_any_call("status", "NEW")
    q.eq.assert_any_call("customer_segment", "ENT")
    q.eq.assert_any_call("assigned_to", "alice")
    q.eq.assert_any_call("category", "CHURN_SIGNAL")
    q.is_.assert_called_with("last_reply_at", "null")


def test_list_tickets_no_reply_false_skips_filter(monkeypatch):
    db, q = _make_db([])
    monkeypatch.setattr(agent_module, "get_db", lambda: db)

    agent_module._execute_tool("list_tickets", {"no_reply": False})
    q.is_.assert_not_called()
