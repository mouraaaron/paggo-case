import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from main import app
import services.morning_briefing

client = TestClient(app)


def _mk_openai_mock(narrative="Período ok.", next_steps=["Verificar tickets"]):
    mock = MagicMock()
    mock.chat.completions.create.return_value.choices[0].message.content = json.dumps(
        {"narrative": narrative, "next_steps": next_steps}
    )
    return mock


def _sequential(responses):
    """Returns a db mock whose execute() yields responses in order."""
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


# --- Validation ---

def test_briefing_missing_params():
    resp = client.get("/tickets/stats/morning-briefing")
    assert resp.status_code == 400
    assert "obrigatórios" in resp.json()["detail"]


def test_briefing_missing_created_before():
    resp = client.get("/tickets/stats/morning-briefing?created_after=2026-05-19")
    assert resp.status_code == 400


def test_briefing_range_too_large():
    resp = client.get(
        "/tickets/stats/morning-briefing?created_after=2026-05-01&created_before=2026-05-10"
    )
    assert resp.status_code == 400
    assert "3 dias" in resp.json()["detail"]


def test_briefing_range_exactly_3_days_is_allowed(monkeypatch):
    db = _sequential([
        [{"customer_segment": "ENT", "status": "NEW", "priority": "HIGH", "assigned_to": None}],
        [],
    ])
    monkeypatch.setattr(services.morning_briefing, "get_db", lambda: db)
    monkeypatch.setattr(services.morning_briefing, "_get_client", lambda: _mk_openai_mock())

    resp = client.get(
        "/tickets/stats/morning-briefing?created_after=2026-05-19&created_before=2026-05-22"
    )
    assert resp.status_code == 200


# --- Response shape ---

def test_briefing_returns_correct_shape(monkeypatch):
    period_rows = [
        {"customer_segment": "ENT", "status": "NEW", "priority": "URGENT", "assigned_to": None},
        {"customer_segment": "ENT", "status": "IN_PROGRESS", "priority": "HIGH", "assigned_to": "Ana"},
        {"customer_segment": "MID", "status": "NEW", "priority": "LOW", "assigned_to": None},
    ]
    # 16 open tickets for Ana → overloaded (total >= 15)
    agent_rows = [{"assigned_to": "Ana", "priority": "URGENT", "status": "NEW"}] * 16

    db = _sequential([period_rows, agent_rows])
    monkeypatch.setattr(services.morning_briefing, "get_db", lambda: db)
    monkeypatch.setattr(
        services.morning_briefing, "_get_client",
        lambda: _mk_openai_mock("Período movimentado.", ["Atribuir urgente", "Checar ENT"]),
    )

    resp = client.get(
        "/tickets/stats/morning-briefing?created_after=2026-05-19&created_before=2026-05-21"
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["period_label"] == "19/05 - 21/05"
    assert data["new_tickets"]["total"] == 3
    assert data["new_tickets"]["ENT"] == 2
    assert data["new_tickets"]["MID"] == 1
    assert data["new_tickets"]["SMB"] == 0
    assert data["team_status"]["unassigned_urgent"] == 1
    assert "Ana" in data["team_status"]["overloaded_agents"]
    assert data["narrative"] == "Período movimentado."
    assert "Atribuir urgente" in data["next_steps"]


def test_briefing_segment_counts_only_ent_mid_smb(monkeypatch):
    period_rows = [
        {"customer_segment": "ENT", "status": "NEW", "priority": "LOW", "assigned_to": None},
        {"customer_segment": "UNKNOWN", "status": "NEW", "priority": "LOW", "assigned_to": None},
        {"customer_segment": None, "status": "NEW", "priority": "LOW", "assigned_to": None},
    ]
    db = _sequential([period_rows, []])
    monkeypatch.setattr(services.morning_briefing, "get_db", lambda: db)
    monkeypatch.setattr(services.morning_briefing, "_get_client", lambda: _mk_openai_mock())

    resp = client.get(
        "/tickets/stats/morning-briefing?created_after=2026-05-19&created_before=2026-05-21"
    )
    data = resp.json()
    assert data["new_tickets"]["ENT"] == 1
    assert data["new_tickets"]["MID"] == 0
    assert data["new_tickets"]["SMB"] == 0
    assert data["new_tickets"]["total"] == 3


def test_briefing_urgent_closed_not_counted_as_unassigned(monkeypatch):
    period_rows = [
        # URGENT + unassigned + open status → should be counted
        {"customer_segment": "ENT", "status": "NEW", "priority": "URGENT", "assigned_to": None},
        # URGENT + unassigned + CLOSED status → should NOT be counted
        {"customer_segment": "ENT", "status": "CLOSED", "priority": "URGENT", "assigned_to": None},
    ]
    db = _sequential([period_rows, []])
    monkeypatch.setattr(services.morning_briefing, "get_db", lambda: db)
    monkeypatch.setattr(services.morning_briefing, "_get_client", lambda: _mk_openai_mock())

    resp = client.get(
        "/tickets/stats/morning-briefing?created_after=2026-05-19&created_before=2026-05-21"
    )
    data = resp.json()
    assert data["team_status"]["unassigned_urgent"] == 1  # only the NEW one


def test_briefing_llm_parse_failure_returns_empty_narrative(monkeypatch):
    period_rows = [{"customer_segment": "ENT", "status": "NEW", "priority": "LOW", "assigned_to": None}]
    db = _sequential([period_rows, []])
    monkeypatch.setattr(services.morning_briefing, "get_db", lambda: db)

    # Mock returning invalid JSON from the LLM
    bad_mock = MagicMock()
    bad_mock.chat.completions.create.return_value.choices[0].message.content = "not valid json {{{"
    monkeypatch.setattr(services.morning_briefing, "_get_client", lambda: bad_mock)

    resp = client.get(
        "/tickets/stats/morning-briefing?created_after=2026-05-19&created_before=2026-05-21"
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["narrative"] == ""
    assert data["next_steps"] == []
