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

def calculate_triage_flags(ticket: dict, has_churn: bool | None = None) -> tuple[list[str], int, str]:
    """
    Returns (flags, risk_score 0-100, priority) for a ticket dict.
    Rules are additive; score is capped at 100.
    Priority derived from score: >=70=URGENT, 40-69=HIGH, 10-39=MEDIUM, <10=LOW.
    Pass has_churn=True/False to override keyword-based detection (e.g. from LLM).
    """
    flags: list[str] = []
    score = 0

    created_at = _parse_dt(ticket.get("created_at"))
    last_reply_at = _parse_dt(ticket.get("last_reply_at"))
    last_reply_by = ticket.get("last_reply_by")
    age_h = _age_hours(created_at)
    segment = ticket.get("customer_segment", "")
    status = ticket.get("status", "")
    assigned_to = ticket.get("assigned_to")
    try:
        prev_open = int(ticket.get("previous_open_tickets_for_customer") or 0)
    except (ValueError, TypeError):
        prev_open = 0

    if has_churn is None:
        text = f"{ticket.get('subject', '')} {ticket.get('body_preview', '')}".lower()
        has_churn = any(kw in text for kw in CHURN_KEYWORDS)

    # Rule 1: CHURN_UNASSIGNED — churn signal + no agent assigned
    if has_churn and not assigned_to:
        flags.append("CHURN_UNASSIGNED")
        score += 70

    # Rule 2: ENT_NO_REPLY_2H — ENT client, no first reply, open > 2h
    if segment == "ENT" and last_reply_by is None and age_h > 2:
        flags.append("ENT_NO_REPLY_2H")
        score += 70

    # Rule 3: CHURN_WITH_AGENT — churn signal + agent assigned (flag stored as CHURN_SIGNAL)
    if has_churn and assigned_to:
        flags.append("CHURN_SIGNAL")
        score += 35

    # Rule 4: MID_NO_REPLY_2H — MID client, no first reply, open > 2h
    if segment == "MID" and last_reply_by is None and age_h > 2:
        flags.append("MID_NO_REPLY_2H")
        score += 30

    # Rule 5: MULTIPLE_OPEN — customer has 3+ other open tickets
    if prev_open >= 3:
        flags.append("MULTIPLE_OPEN")
        score += 15

    # Rule 6: STALE_IN_PROGRESS — IN_PROGRESS with no activity for 72h
    if status == "IN_PROGRESS" and last_reply_at is not None:
        if _age_hours(last_reply_at) > 72:
            flags.append("STALE_IN_PROGRESS")
            score += 15

    capped = min(score, 100)
    priority = "URGENT" if capped >= 70 else "HIGH" if capped >= 40 else "MEDIUM" if capped >= 10 else "LOW"
    return flags, capped, priority
