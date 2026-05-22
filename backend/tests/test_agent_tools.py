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


# ── draft_reply ───────────────────────────────────────────────────────────────

def test_generate_draft_builds_prompt_from_ticket(monkeypatch):
    """_generate_draft returns a non-empty string using ticket context."""
    ticket = {
        "ticket_id": "T1",
        "subject": "Cannot export invoices",
        "body_preview": "I have been trying to export my invoices for three days.",
        "customer_name": "Acme Corp",
        "customer_segment": "ENT",
        "plan": "ENTERPRISE",
        "previous_open_tickets_for_customer": 2,
    }
    replies = [
        {"author": "CUSTOMER", "body": "Still waiting for a response."},
    ]

    fake_completion = MagicMock()
    fake_completion.choices[0].message.content = "Dear Acme Corp, we apologize for the delay."

    with patch("services.ai_agent.client.chat.completions.create", return_value=fake_completion) as mock_create:
        draft = agent_module._generate_draft(ticket, replies)

    assert draft == "Dear Acme Corp, we apologize for the delay."
    mock_create.assert_called_once()


def test_execute_tool_draft_reply_sends_on_confirm(monkeypatch):
    """_execute_tool('draft_reply') posts reply to DB and logs audit event when draft_body provided."""
    ticket_row = {
        "ticket_id": "T1", "subject": "bug", "body_preview": "help",
        "customer_name": "Acme", "customer_segment": "SMB", "plan": "STARTER",
        "previous_open_tickets_for_customer": 0,
    }
    replies_rows = []

    call_count = [0]
    def fake_execute():
        r = MagicMock()
        if call_count[0] == 0:
            r.data = ticket_row        # get_ticket (single())
        elif call_count[0] == 1:
            r.data = replies_rows      # get replies
        else:
            r.data = [{"id": "R1", "ticket_id": "T1", "body": "drafted",
                       "author": "AI Agent", "created_at": "2026-01-01T00:00:00",
                       "is_draft": False, "source": "AGENT"}]
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

    result = agent_module._execute_tool("draft_reply", {
        "ticket_id": "T1",
        "draft_body": "Here is your answer.",
    })

    data = json.loads(result)
    assert data.get("success") is True
    assert "draft_body" in data
    # reply was inserted
    q.insert.assert_called()


def test_execute_tool_draft_reply_generates_draft(monkeypatch):
    """_execute_tool('draft_reply') without draft_body fetches ticket + replies and returns draft_body."""
    ticket_row = {
        "ticket_id": "T1", "subject": "bug", "body_preview": "help",
        "customer_name": "Acme", "customer_segment": "MID", "plan": "PRO",
        "previous_open_tickets_for_customer": 1,
    }
    replies_rows = [{"author": "CUSTOMER", "body": "Please help."}]

    call_count = [0]
    def fake_execute():
        r = MagicMock()
        r.data = ticket_row if call_count[0] == 0 else replies_rows
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

    fake_completion = MagicMock()
    fake_completion.choices[0].message.content = "Olá Acme, estamos investigando o problema."

    with patch("services.ai_agent.client.chat.completions.create", return_value=fake_completion):
        result = agent_module._execute_tool("draft_reply", {"ticket_id": "T1"})

    data = json.loads(result)
    assert data.get("draft_body") == "Olá Acme, estamos investigando o problema."
    assert data.get("ticket_id") == "T1"
