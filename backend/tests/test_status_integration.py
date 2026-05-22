import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def _make_db(responses: list):
    """
    Returns a mocked Supabase DB where successive execute() calls return
    items from `responses` (each item becomes result.data).
    """
    idx = [0]

    def _execute():
        r = MagicMock()
        r.data = responses[idx[0]]
        idx[0] += 1
        return r

    q = MagicMock()
    for m in ("select", "eq", "neq", "gte", "lte", "order", "limit",
              "range", "contains", "update", "insert"):
        getattr(q, m).return_value = q
    q.execute.side_effect = _execute

    db = MagicMock()
    db.table.return_value = q
    return db


def _ticket(status: str) -> dict:
    return {
        "ticket_id": "TKT-INT-001",
        "status": status,
        "priority": "HIGH",
        "assigned_to": None,
        "customer_id": "CUST-001",
        "customer_name": "Test Corp",
        "customer_segment": "ENT",
        "plan": "ENTERPRISE",
        "channel": "EMAIL",
        "subject": "Test ticket",
        "body_preview": "Test body",
        "created_at": "2026-03-29T10:00:00+00:00",
        "last_reply_at": None,
        "last_reply_by": None,
        "reply_count": 0,
        "category": None,
        "previous_open_tickets_for_customer": 0,
        "triage_flags": [],
        "risk_score": 50,
        "close_reason": None,
        "merged_into": None,
        "is_faq": False,
    }


# ---- New valid transitions ----

def test_resolved_to_reopened_returns_200():
    db = _make_db([
        [_ticket("RESOLVED")],          # SELECT status
        [],                              # UPDATE (result ignored)
        [_ticket("REOPENED")],           # SELECT * inside get_ticket
    ])
    with patch("routers.tickets.get_db", return_value=db), \
         patch("routers.tickets.log_event"):
        resp = client.patch("/tickets/TKT-INT-001/status", json={"new_status": "REOPENED"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "REOPENED"


def test_closed_to_reopened_returns_200():
    db = _make_db([
        [_ticket("CLOSED")],
        [],
        [_ticket("REOPENED")],
    ])
    with patch("routers.tickets.get_db", return_value=db), \
         patch("routers.tickets.log_event"):
        resp = client.patch("/tickets/TKT-INT-001/status", json={"new_status": "REOPENED"})
    assert resp.status_code == 200


def test_reopened_to_in_progress_returns_200():
    db = _make_db([
        [_ticket("REOPENED")],
        [],
        [_ticket("IN_PROGRESS")],
    ])
    with patch("routers.tickets.get_db", return_value=db), \
         patch("routers.tickets.log_event"):
        resp = client.patch("/tickets/TKT-INT-001/status", json={"new_status": "IN_PROGRESS"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "IN_PROGRESS"


def test_reopened_to_triaged_returns_200():
    db = _make_db([
        [_ticket("REOPENED")],
        [],
        [_ticket("TRIAGED")],
    ])
    with patch("routers.tickets.get_db", return_value=db), \
         patch("routers.tickets.log_event"):
        resp = client.patch("/tickets/TKT-INT-001/status", json={"new_status": "TRIAGED"})
    assert resp.status_code == 200


# ---- Transitions that must now be rejected ----

def test_closed_to_in_progress_returns_422():
    db = _make_db([[_ticket("CLOSED")]])
    with patch("routers.tickets.get_db", return_value=db), \
         patch("routers.tickets.log_event"):
        resp = client.patch("/tickets/TKT-INT-001/status", json={"new_status": "IN_PROGRESS"})
    assert resp.status_code == 422
    assert "CLOSED" in resp.json()["detail"]
    assert "IN_PROGRESS" in resp.json()["detail"]


def test_new_to_resolved_returns_422():
    db = _make_db([[_ticket("NEW")]])
    with patch("routers.tickets.get_db", return_value=db), \
         patch("routers.tickets.log_event"):
        resp = client.patch("/tickets/TKT-INT-001/status", json={"new_status": "RESOLVED"})
    assert resp.status_code == 422


def test_reopened_to_closed_returns_422():
    db = _make_db([[_ticket("REOPENED")]])
    with patch("routers.tickets.get_db", return_value=db), \
         patch("routers.tickets.log_event"):
        resp = client.patch("/tickets/TKT-INT-001/status", json={"new_status": "CLOSED"})
    assert resp.status_code == 422


# ---- Ticket not found ----

def test_status_update_returns_404_when_ticket_missing():
    db = _make_db([[]])  # empty result
    with patch("routers.tickets.get_db", return_value=db), \
         patch("routers.tickets.log_event"):
        resp = client.patch("/tickets/TKT-MISSING/status", json={"new_status": "TRIAGED"})
    assert resp.status_code == 404
