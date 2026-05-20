import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from main import app
import routers.tickets
import services.audit

client = TestClient(app)


def _chainable(execute_data):
    """Supabase-style chainable query mock with a single fixed execute result."""
    result = MagicMock()
    result.data = execute_data

    q = MagicMock()
    for m in ("select", "eq", "neq", "gte", "lte", "order", "limit", "range",
              "contains", "update", "insert"):
        getattr(q, m).return_value = q
    q.execute.return_value = result

    db = MagicMock()
    db.table.return_value = q
    return db, q


def _sequential(responses):
    """Supabase mock whose execute() returns different values on successive calls."""
    idx = [0]

    def _execute():
        r = MagicMock()
        r.data = responses[idx[0]]
        idx[0] += 1
        return r

    q = MagicMock()
    for m in ("select", "eq", "neq", "gte", "lte", "update", "insert"):
        getattr(q, m).return_value = q
    q.execute.side_effect = _execute

    db = MagicMock()
    db.table.return_value = q
    return db


def _base_ticket(**extra):
    return {
        "ticket_id": "TKT-001",
        "status": "NEW",
        "priority": "MEDIUM",
        "assigned_to": None,
        "customer_id": None,
        "customer_name": None,
        "customer_segment": None,
        "plan": None,
        "channel": None,
        "subject": "Test ticket",
        "body_preview": None,
        "created_at": "2024-01-08T10:00:00+00:00",
        "last_reply_at": None,
        "last_reply_by": None,
        "reply_count": 0,
        "category": None,
        "previous_open_tickets_for_customer": 0,
        "triage_flags": [],
        "risk_score": 0,
        "close_reason": None,
        "merged_into": None,
        **extra,
    }


# ─── Integration: volume-by-segment ──────────────────────────────────────────

OPEN_STATUSES = ["NEW", "TRIAGED", "IN_PROGRESS", "WAITING_CUSTOMER", "ESCALATED", "REOPENED"]
CLOSED_STATUSES = ["RESOLVED", "CLOSED"]

def test_volume_counts_total_open_closed(monkeypatch):
    rows = [
        {"customer_segment": "ENT", "status": "NEW"},
        {"customer_segment": "ENT", "status": "IN_PROGRESS"},
        {"customer_segment": "ENT", "status": "CLOSED"},
        {"customer_segment": "SMB", "status": "RESOLVED"},
    ]
    db, _ = _chainable(rows)
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    resp = client.get("/tickets/stats/volume-by-segment")
    assert resp.status_code == 200
    by_seg = {r["segment"]: r for r in resp.json()}
    assert by_seg["ENT"]["total"] == 3
    assert by_seg["ENT"]["open"] == 2
    assert by_seg["ENT"]["closed"] == 1
    assert by_seg["SMB"]["total"] == 1
    assert by_seg["SMB"]["open"] == 0
    assert by_seg["SMB"]["closed"] == 1


def test_volume_all_open_statuses_counted(monkeypatch):
    rows = [{"customer_segment": "MID", "status": s} for s in OPEN_STATUSES]
    db, _ = _chainable(rows)
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    resp = client.get("/tickets/stats/volume-by-segment")
    by_seg = {r["segment"]: r for r in resp.json()}
    assert by_seg["MID"]["open"] == len(OPEN_STATUSES)
    assert by_seg["MID"]["closed"] == 0


def test_volume_closed_statuses_not_counted_as_open(monkeypatch):
    rows = [{"customer_segment": "ENT", "status": s} for s in CLOSED_STATUSES]
    db, _ = _chainable(rows)
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    resp = client.get("/tickets/stats/volume-by-segment")
    by_seg = {r["segment"]: r for r in resp.json()}
    assert by_seg["ENT"]["open"] == 0
    assert by_seg["ENT"]["closed"] == len(CLOSED_STATUSES)


def test_volume_ignores_unknown_segments(monkeypatch):
    rows = [
        {"customer_segment": "VIP", "status": "NEW"},
        {"customer_segment": "ENT", "status": "NEW"},
    ]
    db, _ = _chainable(rows)
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    resp = client.get("/tickets/stats/volume-by-segment")
    segments = [r["segment"] for r in resp.json()]
    assert "VIP" not in segments
    assert "ENT" in segments


def test_volume_date_filter_sent_to_query(monkeypatch):
    db, query = _chainable([])
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    client.get("/tickets/stats/volume-by-segment?created_after=2024-01-01&created_before=2024-01-31")

    query.gte.assert_called_once_with("created_at", "2024-01-01")
    query.lte.assert_called_once_with("created_at", "2024-01-31T23:59:59.999999")


def test_volume_empty_returns_empty_list(monkeypatch):
    db, _ = _chainable([])
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    resp = client.get("/tickets/stats/volume-by-segment")
    assert resp.status_code == 200
    assert resp.json() == []


def test_volume_sorted_alphabetically(monkeypatch):
    rows = [
        {"customer_segment": "SMB", "status": "NEW"},
        {"customer_segment": "ENT", "status": "NEW"},
        {"customer_segment": "MID", "status": "NEW"},
    ]
    db, _ = _chainable(rows)
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    resp = client.get("/tickets/stats/volume-by-segment")
    segments = [r["segment"] for r in resp.json()]
    assert segments == sorted(segments)


# ─── Integration: risk-by-segment ────────────────────────────────────────────

def test_risk_computes_average_per_segment(monkeypatch):
    rows = [
        {"customer_segment": "ENT", "risk_score": 80},
        {"customer_segment": "ENT", "risk_score": 60},
        {"customer_segment": "SMB", "risk_score": 20},
    ]
    db, _ = _chainable(rows)
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    resp = client.get("/tickets/stats/risk-by-segment")
    assert resp.status_code == 200
    by_seg = {r["segment"]: r for r in resp.json()}
    assert by_seg["ENT"]["avg_risk"] == 70.0
    assert by_seg["ENT"]["count"] == 2
    assert by_seg["SMB"]["avg_risk"] == 20.0


def test_risk_null_score_treated_as_zero(monkeypatch):
    rows = [
        {"customer_segment": "MID", "risk_score": None},
        {"customer_segment": "MID", "risk_score": 40},
    ]
    db, _ = _chainable(rows)
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    resp = client.get("/tickets/stats/risk-by-segment")
    by_seg = {r["segment"]: r for r in resp.json()}
    assert by_seg["MID"]["avg_risk"] == 20.0   # (0 + 40) / 2


def test_risk_ignores_unknown_segments(monkeypatch):
    rows = [
        {"customer_segment": "VIP", "risk_score": 90},
        {"customer_segment": "ENT", "risk_score": 50},
    ]
    db, _ = _chainable(rows)
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    resp = client.get("/tickets/stats/risk-by-segment")
    segments = [r["segment"] for r in resp.json()]
    assert "VIP" not in segments


def test_risk_date_filter_sent_to_query(monkeypatch):
    db, query = _chainable([])
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    client.get("/tickets/stats/risk-by-segment?created_after=2024-01-01&created_before=2024-01-31")

    query.gte.assert_called_once_with("created_at", "2024-01-01")
    query.lte.assert_called_once_with("created_at", "2024-01-31T23:59:59.999999")


def test_risk_empty_returns_empty_list(monkeypatch):
    db, _ = _chainable([])
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    resp = client.get("/tickets/stats/risk-by-segment")
    assert resp.status_code == 200
    assert resp.json() == []


def test_risk_sorted_alphabetically(monkeypatch):
    rows = [
        {"customer_segment": "SMB", "risk_score": 10},
        {"customer_segment": "ENT", "risk_score": 70},
        {"customer_segment": "MID", "risk_score": 40},
    ]
    db, _ = _chainable(rows)
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    resp = client.get("/tickets/stats/risk-by-segment")
    segments = [r["segment"] for r in resp.json()]
    assert segments == sorted(segments)


# ─── Integration: agent stats aggregation ─────────────────────────────────────

def test_agent_stats_aggregates_priority_counts(monkeypatch):
    rows = [
        {"assigned_to": "Ana Souza", "priority": "URGENT", "status": "IN_PROGRESS"},
        {"assigned_to": "Ana Souza", "priority": "HIGH", "status": "IN_PROGRESS"},
        {"assigned_to": "Ana Souza", "priority": "HIGH", "status": "NEW"},
        {"assigned_to": "Bruno Lima", "priority": "LOW", "status": "IN_PROGRESS"},
    ]
    db, _ = _chainable(rows)
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    resp = client.get("/tickets/stats/agents")
    assert resp.status_code == 200
    by_agent = {r["agent"]: r for r in resp.json()}
    assert by_agent["Ana Souza"]["urgent"] == 1
    assert by_agent["Ana Souza"]["high"] == 2
    assert by_agent["Ana Souza"]["total"] == 3
    assert by_agent["Bruno Lima"]["low"] == 1
    assert by_agent["Bruno Lima"]["total"] == 1


def test_agent_stats_excludes_closed_and_resolved(monkeypatch):
    rows = [
        {"assigned_to": "Ana Souza", "priority": "URGENT", "status": "CLOSED"},
        {"assigned_to": "Ana Souza", "priority": "HIGH", "status": "RESOLVED"},
        {"assigned_to": "Ana Souza", "priority": "MEDIUM", "status": "IN_PROGRESS"},
    ]
    db, _ = _chainable(rows)
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    resp = client.get("/tickets/stats/agents")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["total"] == 1
    assert data[0]["medium"] == 1


def test_agent_stats_date_filter_sent_to_query(monkeypatch):
    db, query = _chainable([])
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    client.get("/tickets/stats/agents?created_after=2024-01-01&created_before=2024-01-31")

    query.gte.assert_called_once_with("created_at", "2024-01-01")
    query.lte.assert_called_once_with("created_at", "2024-01-31T23:59:59.999999")


def test_agent_stats_no_date_filter_skips_gte_lte(monkeypatch):
    db, query = _chainable([])
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    client.get("/tickets/stats/agents")

    query.gte.assert_not_called()
    query.lte.assert_not_called()


def test_agent_stats_sorted_by_total_descending(monkeypatch):
    rows = [
        {"assigned_to": "Bruno Lima", "priority": "LOW", "status": "NEW"},
        {"assigned_to": "Ana Souza", "priority": "HIGH", "status": "NEW"},
        {"assigned_to": "Ana Souza", "priority": "URGENT", "status": "NEW"},
        {"assigned_to": "Ana Souza", "priority": "LOW", "status": "NEW"},
    ]
    db, _ = _chainable(rows)
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    resp = client.get("/tickets/stats/agents")
    agents = [r["agent"] for r in resp.json()]
    assert agents[0] == "Ana Souza"
    assert agents[1] == "Bruno Lima"


def test_agent_stats_unknown_priority_falls_back_to_low(monkeypatch):
    rows = [
        {"assigned_to": "Ana Souza", "priority": "BOGUS", "status": "NEW"},
    ]
    db, _ = _chainable(rows)
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    resp = client.get("/tickets/stats/agents")
    assert resp.status_code == 200
    assert resp.json()[0]["low"] == 1


def test_agent_stats_null_priority_falls_back_to_low(monkeypatch):
    rows = [
        {"assigned_to": "Ana Souza", "priority": None, "status": "NEW"},
    ]
    db, _ = _chainable(rows)
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    resp = client.get("/tickets/stats/agents")
    assert resp.json()[0]["low"] == 1


def test_agent_stats_empty_returns_empty_list(monkeypatch):
    db, _ = _chainable([])
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    resp = client.get("/tickets/stats/agents")
    assert resp.status_code == 200
    assert resp.json() == []


# ─── Integration: PATCH /tickets/{id}/assign ──────────────────────────────────

def test_assign_ticket_sets_agent_and_returns_ticket(monkeypatch):
    updated = _base_ticket(assigned_to="Ana Souza")
    db = _sequential([
        [{"assigned_to": None}],   # select assigned_to
        [],                         # update assigned_to
        [{"id": "log1"}],           # audit_log insert
        [updated],                  # get_ticket select *
    ])
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)
    monkeypatch.setattr(services.audit, "get_db", lambda: db)

    resp = client.patch(
        "/tickets/TKT-001/assign",
        json={"agent_name": "Ana Souza", "actor": "leader"},
    )
    assert resp.status_code == 200
    assert resp.json()["assigned_to"] == "Ana Souza"


def test_assign_ticket_to_none_unassigns(monkeypatch):
    updated = _base_ticket(assigned_to=None)
    db = _sequential([
        [{"assigned_to": "Ana Souza"}],
        [],
        [{"id": "log1"}],
        [updated],
    ])
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)
    monkeypatch.setattr(services.audit, "get_db", lambda: db)

    resp = client.patch(
        "/tickets/TKT-001/assign",
        json={"agent_name": None, "actor": "leader"},
    )
    assert resp.status_code == 200
    assert resp.json()["assigned_to"] is None


def test_assign_ticket_not_found_returns_404(monkeypatch):
    db, _ = _chainable([])   # empty data → ticket not found
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    resp = client.patch(
        "/tickets/NONEXISTENT/assign",
        json={"agent_name": "Ana Souza", "actor": "leader"},
    )
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_assign_ticket_response_includes_all_ticket_fields(monkeypatch):
    updated = _base_ticket(assigned_to="Bruno Lima", risk_score=75, priority="URGENT")
    db = _sequential([
        [{"assigned_to": None}],
        [],
        [{"id": "log1"}],
        [updated],
    ])
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)
    monkeypatch.setattr(services.audit, "get_db", lambda: db)

    resp = client.patch(
        "/tickets/TKT-001/assign",
        json={"agent_name": "Bruno Lima", "actor": "leader"},
    )
    body = resp.json()
    assert body["ticket_id"] == "TKT-001"
    assert body["risk_score"] == 75
    assert body["priority"] == "URGENT"
    assert body["assigned_to"] == "Bruno Lima"
