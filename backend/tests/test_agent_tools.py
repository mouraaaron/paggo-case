import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import json
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
    data = json.loads(result)
    assert isinstance(data, list)
    q.eq.assert_any_call("status", "NEW")
    q.eq.assert_any_call("customer_segment", "ENT")
    q.eq.assert_any_call("assigned_to", "alice")
    q.eq.assert_any_call("category", "CHURN_SIGNAL")
    q.is_.assert_called_with("last_reply_at", None)


def test_list_tickets_no_reply_false_skips_filter(monkeypatch):
    db, q = _make_db([])
    monkeypatch.setattr(agent_module, "get_db", lambda: db)

    agent_module._execute_tool("list_tickets", {"no_reply": False})
    q.is_.assert_not_called()


def test_list_tickets_unassigned_uses_is_filter(monkeypatch):
    db, q = _make_db([])
    monkeypatch.setattr(agent_module, "get_db", lambda: db)

    agent_module._execute_tool("list_tickets", {"assigned_to": "unassigned"})
    q.is_.assert_called_with("assigned_to", None)


# ── close_ticket ──────────────────────────────────────────────────────────────

def test_close_ticket_executes_and_logs(monkeypatch):
    ticket_data = {"status": "RESOLVED"}

    call_count = [0]
    def fake_execute():
        r = MagicMock()
        r.data = ticket_data
        call_count[0] += 1
        return r

    q = MagicMock()
    for m in ("select", "eq", "neq", "gte", "lte", "order", "limit", "range",
              "update", "insert", "single", "contains", "is_"):
        getattr(q, m).return_value = q
    q.execute.side_effect = fake_execute
    db = MagicMock()
    db.table.return_value = q
    monkeypatch.setattr(agent_module, "get_db", lambda: db)

    result = agent_module._execute_tool("close_ticket", {
        "ticket_id": "T1",
        "close_reason": "RESOLVED_FIXED",
    })
    data = json.loads(result)
    assert data.get("success") is True
    q.insert.assert_called()


def test_close_ticket_rejects_invalid_transition(monkeypatch):
    ticket_data = {"status": "NEW"}

    q = MagicMock()
    for m in ("select", "eq", "neq", "gte", "lte", "order", "limit", "range",
              "update", "insert", "single", "contains", "is_"):
        getattr(q, m).return_value = q
    r = MagicMock()
    r.data = ticket_data
    q.execute.return_value = r
    db = MagicMock()
    db.table.return_value = q
    monkeypatch.setattr(agent_module, "get_db", lambda: db)

    result = agent_module._execute_tool("close_ticket", {
        "ticket_id": "T1",
        "close_reason": "RESOLVED_FIXED",
    })
    data = json.loads(result)
    assert "error" in data


def test_close_ticket_rejects_invalid_reason(monkeypatch):
    ticket_data = {"status": "RESOLVED"}

    q = MagicMock()
    for m in ("select", "eq", "neq", "gte", "lte", "order", "limit", "range",
              "update", "insert", "single", "contains", "is_"):
        getattr(q, m).return_value = q
    r = MagicMock()
    r.data = ticket_data
    q.execute.return_value = r
    db = MagicMock()
    db.table.return_value = q
    monkeypatch.setattr(agent_module, "get_db", lambda: db)

    result = agent_module._execute_tool("close_ticket", {
        "ticket_id": "T1",
        "close_reason": "INVALID_REASON",
    })
    data = json.loads(result)
    assert "error" in data


# ── merge_tickets ─────────────────────────────────────────────────────────────

def test_merge_tickets_executes_and_logs(monkeypatch):
    primary = {"ticket_id": "T1", "customer_id": "C1", "status": "RESOLVED"}
    secondary = {"ticket_id": "T2", "customer_id": "C1", "status": "RESOLVED"}

    call_count = [0]
    def fake_execute():
        r = MagicMock()
        if call_count[0] == 0:
            r.data = [primary]
        elif call_count[0] == 1:
            r.data = [secondary]
        else:
            r.data = [primary]
        call_count[0] += 1
        return r

    q = MagicMock()
    for m in ("select", "eq", "neq", "gte", "lte", "order", "limit", "range",
              "update", "insert", "single", "contains", "is_"):
        getattr(q, m).return_value = q
    q.execute.side_effect = fake_execute
    db = MagicMock()
    db.table.return_value = q
    monkeypatch.setattr(agent_module, "get_db", lambda: db)

    result = agent_module._execute_tool("merge_tickets", {
        "primary_ticket_id": "T1",
        "secondary_ticket_id": "T2",
    })
    data = json.loads(result)
    assert data.get("success") is True


def test_merge_tickets_rejects_different_customers(monkeypatch):
    primary = {"ticket_id": "T1", "customer_id": "C1", "status": "RESOLVED"}
    secondary = {"ticket_id": "T2", "customer_id": "C2", "status": "RESOLVED"}

    call_count = [0]
    def fake_execute():
        r = MagicMock()
        r.data = [primary] if call_count[0] == 0 else [secondary]
        call_count[0] += 1
        return r

    q = MagicMock()
    for m in ("select", "eq", "neq", "gte", "lte", "order", "limit", "range",
              "update", "insert", "single", "contains", "is_"):
        getattr(q, m).return_value = q
    q.execute.side_effect = fake_execute
    db = MagicMock()
    db.table.return_value = q
    monkeypatch.setattr(agent_module, "get_db", lambda: db)

    result = agent_module._execute_tool("merge_tickets", {
        "primary_ticket_id": "T1",
        "secondary_ticket_id": "T2",
    })
    data = json.loads(result)
    assert "error" in data
