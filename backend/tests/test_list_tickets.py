import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

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


def test_get_tickets_filters_by_channel(monkeypatch):
    db, q = _chainable([])
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    client.get("/tickets?channel=EMAIL")

    q.eq.assert_any_call("channel", "EMAIL")


def test_get_tickets_filters_by_assigned_to(monkeypatch):
    db, q = _chainable([])
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    client.get("/tickets?assigned_to=Ana%20Souza")

    q.eq.assert_any_call("assigned_to", "Ana Souza")


def test_get_tickets_no_channel_param_skips_channel_filter(monkeypatch):
    db, q = _chainable([])
    monkeypatch.setattr(routers.tickets, "get_db", lambda: db)

    client.get("/tickets")

    # channel filter must NOT have been applied
    channel_calls = [c for c in q.eq.call_args_list if c.args and c.args[0] == "channel"]
    assert len(channel_calls) == 0
