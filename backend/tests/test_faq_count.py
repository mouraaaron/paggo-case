import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from main import app
import routers.tickets

client = TestClient(app)


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


def test_faq_count_shape(monkeypatch):
    all_rows = [{"ticket_id": f"T{i}"} for i in range(10)]
    faq_rows = [{"ticket_id": "T1"}, {"ticket_id": "T2"}]
    db = _sequential([all_rows, faq_rows])
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    resp = client.get("/tickets/stats/faq-count")
    assert resp.status_code == 200
    data = resp.json()
    assert data["faq_count"] == 2
    assert data["total"] == 10
    assert data["percentage"] == 20.0


def test_faq_count_zero_total(monkeypatch):
    db = _sequential([[], []])
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    resp = client.get("/tickets/stats/faq-count")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["faq_count"] == 0
    assert data["percentage"] == 0.0


def test_faq_count_with_date_filter(monkeypatch):
    all_rows = [{"ticket_id": f"T{i}"} for i in range(3)]
    faq_rows = [{"ticket_id": "T0"}]
    db = _sequential([all_rows, faq_rows])
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    resp = client.get("/tickets/stats/faq-count?created_after=2026-05-01&created_before=2026-05-10")
    assert resp.status_code == 200
    data = resp.json()
    assert data["faq_count"] == 1
    assert data["total"] == 3
    assert data["percentage"] == round(1 / 3 * 100, 1)


def test_faq_count_percentage_calculation(monkeypatch):
    all_rows = [{"ticket_id": f"T{i}"} for i in range(4)]
    faq_rows = [{"ticket_id": "T0"}, {"ticket_id": "T1"}]
    db = _sequential([all_rows, faq_rows])
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    resp = client.get("/tickets/stats/faq-count")
    assert resp.status_code == 200
    assert resp.json()["percentage"] == 50.0
