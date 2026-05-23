import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import json
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from main import app
import routers.tickets

client = TestClient(app)


def _chainable(data):
    result = MagicMock()
    result.data = data
    q = MagicMock()
    for m in ("select", "eq", "neq", "gte", "lte", "order", "limit",
              "range", "contains", "update", "insert"):
        getattr(q, m).return_value = q
    q.execute.return_value = result
    db = MagicMock()
    db.table.return_value = q
    return db, q


def _mock_openai_client(category: str, priority: str, reasoning: str = "clear bug"):
    payload = json.dumps({"category": category, "priority": priority, "reasoning": reasoning})
    mock_oa = MagicMock()
    mock_oa.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content=payload))]
    )
    return mock_oa


def test_suggest_classify_returns_category_and_priority(monkeypatch):
    ticket = [{
        "ticket_id": "T1", "subject": "App crashes on login",
        "body_preview": "Every login attempt crashes the app",
        "customer_segment": "ENT", "plan": "ENTERPRISE",
    }]
    db, _ = _chainable(ticket)
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)
    monkeypatch.setattr(routers.tickets.openai, "OpenAI", lambda **kw: _mock_openai_client("BUG", "URGENT"))

    r = client.post("/tickets/T1/suggest-classify")
    assert r.status_code == 200
    data = r.json()
    assert data["category"] == "BUG"
    assert data["priority"] == "URGENT"
    assert "reasoning" in data


def test_suggest_classify_returns_404_when_ticket_missing(monkeypatch):
    db, _ = _chainable([])
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)
    monkeypatch.setattr(routers.tickets.openai, "OpenAI", lambda **kw: MagicMock())

    r = client.post("/tickets/GHOST/suggest-classify")
    assert r.status_code == 404


def test_suggest_classify_returns_503_when_openai_fails(monkeypatch):
    ticket = [{
        "ticket_id": "T1", "subject": "Test", "body_preview": "Body",
        "customer_segment": "SMB", "plan": "STARTER",
    }]
    db, _ = _chainable(ticket)
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    broken_oa = MagicMock()
    broken_oa.chat.completions.create.side_effect = Exception("network error")
    monkeypatch.setattr(routers.tickets.openai, "OpenAI", lambda **kw: broken_oa)

    r = client.post("/tickets/T1/suggest-classify")
    assert r.status_code == 503
