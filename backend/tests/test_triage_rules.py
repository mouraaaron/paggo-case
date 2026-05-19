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
        "priority": "LOW",
        "status": "NEW",
        "subject": "help with login",
        "body_preview": "I can not log in to my account",
        "created_at": now - timedelta(hours=1),
        "last_reply_at": None,
        "last_reply_by": None,
        "previous_open_tickets_for_customer": 0,
    }
    return {**base, **overrides}

def test_no_flags_for_normal_smb_ticket():
    ticket = make_ticket()
    flags, score = calculate_triage_flags(ticket)
    assert flags == []
    assert score == 0

def test_sla_breach_ent_no_reply_over_4h():
    now = datetime.now(timezone.utc)
    ticket = make_ticket(
        customer_segment="ENT",
        created_at=now - timedelta(hours=5),
        last_reply_by=None,
    )
    flags, score = calculate_triage_flags(ticket)
    assert "SLA_BREACH" in flags
    assert score >= 40

def test_no_sla_breach_when_agent_replied():
    now = datetime.now(timezone.utc)
    ticket = make_ticket(
        customer_segment="ENT",
        created_at=now - timedelta(hours=5),
        last_reply_by="AGENT",
    )
    flags, _ = calculate_triage_flags(ticket)
    assert "SLA_BREACH" not in flags

def test_churn_signal_detected():
    ticket = make_ticket(subject="estamos pensando em cancelar o plano")
    flags, score = calculate_triage_flags(ticket)
    assert "CHURN_SIGNAL" in flags
    assert score >= 35

def test_urgent_unattended():
    now = datetime.now(timezone.utc)
    ticket = make_ticket(
        priority="URGENT",
        created_at=now - timedelta(hours=5),
        last_reply_by=None,
    )
    flags, _ = calculate_triage_flags(ticket)
    assert "URGENT_UNATTENDED" in flags

def test_multiple_open():
    ticket = make_ticket(previous_open_tickets_for_customer=3)
    flags, _ = calculate_triage_flags(ticket)
    assert "MULTIPLE_OPEN" in flags

def test_stale_in_progress():
    now = datetime.now(timezone.utc)
    ticket = make_ticket(
        status="IN_PROGRESS",
        last_reply_at=now - timedelta(hours=73),
    )
    flags, _ = calculate_triage_flags(ticket)
    assert "STALE_IN_PROGRESS" in flags

def test_score_capped_at_100():
    now = datetime.now(timezone.utc)
    ticket = make_ticket(
        customer_segment="ENT",
        priority="URGENT",
        created_at=now - timedelta(hours=10),
        last_reply_by=None,
        subject="pensando em cancelar",
        previous_open_tickets_for_customer=5,
        status="IN_PROGRESS",
        last_reply_at=now - timedelta(hours=80),
    )
    _, score = calculate_triage_flags(ticket)
    assert score <= 100
