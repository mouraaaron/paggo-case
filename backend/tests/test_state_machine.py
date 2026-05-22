import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from services.state_machine import can_transition


# --- Existing valid transitions (must stay working) ---

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

def test_resolved_to_closed_allowed():
    ok, _ = can_transition("RESOLVED", "CLOSED")
    assert ok is True

def test_resolved_to_in_progress_allowed():
    ok, _ = can_transition("RESOLVED", "IN_PROGRESS")
    assert ok is True

def test_unknown_status_rejected():
    ok, _ = can_transition("MADE_UP_STATUS", "NEW")
    assert ok is False

def test_closed_to_new_rejected():
    ok, _ = can_transition("CLOSED", "NEW")
    assert ok is False


# --- New REOPENED transitions ---

def test_resolved_to_reopened_allowed():
    ok, _ = can_transition("RESOLVED", "REOPENED")
    assert ok is True

def test_closed_to_reopened_allowed():
    ok, _ = can_transition("CLOSED", "REOPENED")
    assert ok is True

def test_reopened_to_in_progress_allowed():
    ok, _ = can_transition("REOPENED", "IN_PROGRESS")
    assert ok is True

def test_reopened_to_triaged_allowed():
    ok, _ = can_transition("REOPENED", "TRIAGED")
    assert ok is True


# --- CLOSED → IN_PROGRESS is now blocked (must go through REOPENED) ---

def test_closed_to_in_progress_rejected():
    ok, msg = can_transition("CLOSED", "IN_PROGRESS")
    assert ok is False
    assert "IN_PROGRESS" in msg


# --- REOPENED has no path back to CLOSED or RESOLVED directly ---

def test_reopened_to_closed_rejected():
    ok, _ = can_transition("REOPENED", "CLOSED")
    assert ok is False

def test_reopened_to_resolved_rejected():
    ok, _ = can_transition("REOPENED", "RESOLVED")
    assert ok is False
