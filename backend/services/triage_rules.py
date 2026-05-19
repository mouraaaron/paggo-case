from datetime import datetime, timezone

CHURN_KEYWORDS = [
    "cancelar", "cancel", "trocar", "switch", "reembolso", "refund",
    "concorrente", "competitor", "desativar", "encerrar conta",
    "pensando em", "outro fornecedor", "outra solução", "deixar de usar",
    "pensando em mudar", "avaliando alternativas",
]

def _parse_dt(value) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None

def _age_hours(dt: datetime | None) -> float:
    if dt is None:
        return 0.0
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return (now - dt).total_seconds() / 3600

def calculate_triage_flags(ticket: dict) -> tuple[list[str], int]:
    """
    Returns (flags, risk_score 0-100) for a ticket dict.
    Each rule adds points; score is capped at 100.
    """
    flags: list[str] = []
    score = 0

    created_at = _parse_dt(ticket.get("created_at"))
    last_reply_at = _parse_dt(ticket.get("last_reply_at"))
    last_reply_by = ticket.get("last_reply_by")
    age_h = _age_hours(created_at)
    segment = ticket.get("customer_segment", "")
    priority = ticket.get("priority", "")
    status = ticket.get("status", "")
    prev_open = ticket.get("previous_open_tickets_for_customer", 0) or 0

    # Rule 1: SLA_BREACH — ENT or MID client, no first response, open > 4h
    if segment in ("ENT", "MID") and last_reply_by is None and age_h > 4:
        flags.append("SLA_BREACH")
        score += 40 if segment == "ENT" else 25

    # Rule 2: CHURN_SIGNAL — churn keywords in subject or body
    text = f"{ticket.get('subject', '')} {ticket.get('body_preview', '')}".lower()
    if any(kw in text for kw in CHURN_KEYWORDS):
        flags.append("CHURN_SIGNAL")
        score += 35

    # Rule 3: URGENT_UNATTENDED — URGENT priority, no reply, open > 4h
    if priority == "URGENT" and last_reply_by is None and age_h > 4:
        flags.append("URGENT_UNATTENDED")
        score += 20

    # Rule 4: MULTIPLE_OPEN — customer has 3+ other open tickets
    if int(prev_open) >= 3:
        flags.append("MULTIPLE_OPEN")
        score += 15

    # Rule 5: STALE_IN_PROGRESS — IN_PROGRESS with no activity for 72h
    if status == "IN_PROGRESS" and last_reply_at is not None:
        if _age_hours(last_reply_at) > 72:
            flags.append("STALE_IN_PROGRESS")
            score += 15

    return flags, min(score, 100)
