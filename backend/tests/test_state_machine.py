import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from services.state_machine import can_transition

def test_new_to_triaged_allowed():
    ok, _ = can_transition("NEW", "TRIAGED")
    assert ok is True

def test_new_to_resolved_rejected():
    ok, msg = can_transition("NEW", "RESOLVED")
    assert ok is False
    assert "RESOLVED" in msg

def test_in_progress_to_escalated_allowed():
    ok, _ = can_transition("IN_PROGRESS", "ESCALATED")
    assert ok is True

def test_closed_to_in_progress_allowed():
    # REOPENED is modeled as CLOSED → IN_PROGRESS
    ok, _ = can_transition("CLOSED", "IN_PROGRESS")
    assert ok is True

def test_closed_to_new_rejected():
    ok, _ = can_transition("CLOSED", "NEW")
    assert ok is False

def test_resolved_to_closed_allowed():
    ok, _ = can_transition("RESOLVED", "CLOSED")
    assert ok is True

def test_unknown_status_rejected():
    ok, _ = can_transition("MADE_UP_STATUS", "NEW")
    assert ok is False
