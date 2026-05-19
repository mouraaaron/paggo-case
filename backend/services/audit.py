from database import get_db


def log_event(
    ticket_id: str,
    action: str,
    actor: str,
    source: str = "USER",
    old_value: str | None = None,
    new_value: str | None = None,
    reason: str | None = None,
):
    db = get_db()
    db.table("audit_log").insert({
        "ticket_id": ticket_id,
        "action": action,
        "actor": actor,
        "source": source,
        "old_value": old_value,
        "new_value": new_value,
        "reason": reason,
    }).execute()
