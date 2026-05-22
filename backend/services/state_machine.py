VALID_TRANSITIONS: dict[str, list[str]] = {
    "NEW":              ["TRIAGED"],
    "TRIAGED":          ["IN_PROGRESS"],
    "IN_PROGRESS":      ["WAITING_CUSTOMER", "ESCALATED", "RESOLVED"],
    "WAITING_CUSTOMER": ["IN_PROGRESS"],
    "ESCALATED":        ["IN_PROGRESS", "RESOLVED"],
    "RESOLVED":         ["CLOSED", "REOPENED", "IN_PROGRESS"],
    "CLOSED":           ["REOPENED"],
    "REOPENED":         ["IN_PROGRESS", "TRIAGED"],
}

def can_transition(current: str, target: str) -> tuple[bool, str]:
    """
    Returns (ok, error_message).
    ok=True means the transition is allowed.
    """
    allowed = VALID_TRANSITIONS.get(current, [])
    if target in allowed:
        return True, ""
    return (
        False,
        f"Cannot transition from '{current}' to '{target}'. "
        f"Allowed transitions from '{current}': {allowed or 'none'}",
    )
