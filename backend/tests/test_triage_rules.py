# backend/tests/test_triage_rules.py
from datetime import datetime, timezone, timedelta
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from services.triage_rules import calculate_triage_flags

def make_ticket(**overrides):
    now = datetime.now(timezone.utc)
    base = {
        "ticket_id": "T001",
        "customer_segment": "SMB",
        "plan": "FREE",
        "status": "NEW",
        "subject": "help with login",
        "body_preview": "I can not log in",
        "created_at": now - timedelta(hours=1),
        "last_reply_at": None,
        "last_reply_by": None,
        "assigned_to": None,
        "previous_open_tickets_for_customer": 0,
    }
    return {**base, **overrides}

def test_no_flags_smb_normal():
    flags, score, priority = calculate_triage_flags(make_ticket())
    assert flags == []
    assert score == 0
    assert priority == "LOW"

def test_churn_unassigned_is_urgent():
    ticket = make_ticket(subject="pensando em cancelar", assigned_to=None)
    flags, score, priority = calculate_triage_flags(ticket)
    assert "CHURN_UNASSIGNED" in flags
    assert "CHURN_SIGNAL" not in flags
    assert score == 70
    assert priority == "URGENT"

def test_churn_with_agent_is_medium():
    ticket = make_ticket(subject="pensando em cancelar", assigned_to="Ana Souza")
    flags, score, priority = calculate_triage_flags(ticket)
    assert "CHURN_SIGNAL" in flags
    assert "CHURN_UNASSIGNED" not in flags
    assert score == 35
    assert priority == "MEDIUM"

def test_ent_no_reply_2h_is_urgent():
    now = datetime.now(timezone.utc)
    ticket = make_ticket(
        customer_segment="ENT",
        created_at=now - timedelta(hours=3),
        last_reply_by=None,
    )
    flags, score, priority = calculate_triage_flags(ticket)
    assert "ENT_NO_REPLY_2H" in flags
    assert score == 70
    assert priority == "URGENT"

def test_ent_replied_no_flag():
    now = datetime.now(timezone.utc)
    ticket = make_ticket(
        customer_segment="ENT",
        created_at=now - timedelta(hours=3),
        last_reply_by="AGENT",
    )
    flags, _, _ = calculate_triage_flags(ticket)
    assert "ENT_NO_REPLY_2H" not in flags

def test_ent_under_2h_no_flag():
    now = datetime.now(timezone.utc)
    ticket = make_ticket(
        customer_segment="ENT",
        created_at=now - timedelta(hours=1),
        last_reply_by=None,
    )
    flags, _, _ = calculate_triage_flags(ticket)
    assert "ENT_NO_REPLY_2H" not in flags

def test_mid_no_reply_2h_is_medium():
    now = datetime.now(timezone.utc)
    ticket = make_ticket(
        customer_segment="MID",
        created_at=now - timedelta(hours=3),
        last_reply_by=None,
    )
    flags, score, priority = calculate_triage_flags(ticket)
    assert "MID_NO_REPLY_2H" in flags
    assert score == 30
    assert priority == "MEDIUM"

def test_mid_churn_with_agent_is_high():
    now = datetime.now(timezone.utc)
    ticket = make_ticket(
        customer_segment="MID",
        created_at=now - timedelta(hours=3),
        last_reply_by=None,
        subject="pensando em cancelar",
        assigned_to="Ana Souza",
    )
    flags, score, priority = calculate_triage_flags(ticket)
    assert "MID_NO_REPLY_2H" in flags
    assert "CHURN_SIGNAL" in flags
    assert score == 65
    assert priority == "HIGH"

def test_multiple_open():
    ticket = make_ticket(previous_open_tickets_for_customer=3)
    flags, score, _ = calculate_triage_flags(ticket)
    assert "MULTIPLE_OPEN" in flags
    assert score == 15

def test_stale_in_progress():
    now = datetime.now(timezone.utc)
    ticket = make_ticket(
        status="IN_PROGRESS",
        last_reply_at=now - timedelta(hours=73),
    )
    flags, _, _ = calculate_triage_flags(ticket)
    assert "STALE_IN_PROGRESS" in flags

def test_score_capped_at_100():
    now = datetime.now(timezone.utc)
    ticket = make_ticket(
        customer_segment="ENT",
        created_at=now - timedelta(hours=5),
        last_reply_by=None,
        assigned_to=None,
        subject="pensando em cancelar",
        previous_open_tickets_for_customer=5,
        status="IN_PROGRESS",
        last_reply_at=now - timedelta(hours=80),
    )
    _, score, _ = calculate_triage_flags(ticket)
    assert score <= 100

def test_priority_high():
    now = datetime.now(timezone.utc)
    ticket = make_ticket(
        customer_segment="MID",
        created_at=now - timedelta(hours=3),
        last_reply_by=None,
        subject="pensando em cancelar",
        assigned_to="Ana Souza",
    )
    _, score, priority = calculate_triage_flags(ticket)
    assert score == 65
    assert priority == "HIGH"

def test_priority_low_zero_score():
    _, _, priority = calculate_triage_flags(make_ticket())
    assert priority == "LOW"

def test_multiple_open_boundary_below():
    ticket = make_ticket(previous_open_tickets_for_customer=2)
    flags, score, _ = calculate_triage_flags(ticket)
    assert "MULTIPLE_OPEN" not in flags
    assert score == 0

def test_stale_in_progress_exact_boundary():
    now = datetime.now(timezone.utc)
    # 72h minus 1 second: should NOT fire (rule is > 72h, not >= 72h)
    ticket = make_ticket(
        status="IN_PROGRESS",
        last_reply_at=now - timedelta(hours=72) + timedelta(seconds=1),
    )
    flags, _, _ = calculate_triage_flags(ticket)
    assert "STALE_IN_PROGRESS" not in flags
