VALID_TRANSITIONS: dict[str, list[str]] = {
    "NEW":              ["TRIAGED"],
    "TRIAGED":          ["IN_PROGRESS"],
    "IN_PROGRESS":      ["WAITING_CUSTOMER", "ESCALATED", "RESOLVED"],
    "WAITING_CUSTOMER": ["IN_PROGRESS"],
    "ESCALATED":        ["IN_PROGRESS", "RESOLVED"],
    # RESOLVED → IN_PROGRESS kept as a quick "un-resolve" path before formal closure;
    # agents who want a re-open event in the audit log should use REOPENED instead.
    "RESOLVED":         ["CLOSED", "REOPENED", "IN_PROGRESS"],
    "CLOSED":           ["REOPENED"],
    "REOPENED":         ["IN_PROGRESS", "TRIAGED"],
}

def can_transition(current: str, target: str) -> tuple[bool, str]:
    """
    Returns (ok, error_message).
    ok=True means the transition is allowed.
    """
    if current not in VALID_TRANSITIONS:
        return False, f"Unknown status '{current}'."
    allowed = VALID_TRANSITIONS[current]
    if target in allowed:
        return True, ""
    return (
        False,
        f"Cannot transition from '{current}' to '{target}'. "
        f"Allowed transitions from '{current}': {allowed or 'none'}",
    )
