from fastapi import APIRouter, Query, HTTPException
from models import TicketOut, StatusUpdate, ClassifyUpdate, AssignUpdate, ReplyCreate, CloseTicket, MergeTickets, ReplyOut, MorningBriefingOut
from database import get_db
from services.state_machine import can_transition
from services.audit import log_event
from services.morning_briefing import generate_morning_briefing
from datetime import datetime
from collections import defaultdict
import openai
import json as _json
import os

router = APIRouter(prefix="/tickets", tags=["tickets"])


@router.get("", response_model=list[TicketOut])
def list_tickets(
    status: str | None = Query(None),
    priority: str | None = Query(None),
    segment: str | None = Query(None),
    channel: str | None = Query(None),
    assigned_to: str | None = Query(None),
    category: str | None = Query(None),
    has_flag: str | None = Query(None),
    created_after: str | None = Query(None),
    created_before: str | None = Query(None),
    sort_by: str = Query("risk_score"),
    sort_desc: bool = Query(True),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
):
    db = get_db()
    query = db.table("tickets").select("*")

    if status:
        query = query.eq("status", status)
    if priority:
        query = query.eq("priority", priority)
    if segment:
        query = query.eq("customer_segment", segment)
    if channel:
        query = query.eq("channel", channel)
    if assigned_to:
        query = query.eq("assigned_to", assigned_to)
    if category:
        query = query.eq("category", category)
    if has_flag:
        query = query.contains("triage_flags", [has_flag])
    if created_after:
        query = query.gte("created_at", created_after)
    if created_before:
        query = query.lte("created_at", f"{created_before}T23:59:59.999999")

    query = query.order(sort_by, desc=sort_desc).range(offset, offset + limit - 1)
    result = query.execute()
    return result.data


@router.get("/flagged", response_model=list[TicketOut])
def get_flagged_tickets(limit: int = Query(50)):
    db = get_db()
    result = (
        db.table("tickets")
        .select("*")
        .neq("triage_flags", "{}")
        .order("risk_score", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data


@router.get("/agents", response_model=list[str])
def list_agents():
    db = get_db()
    result = db.table("tickets").select("assigned_to").neq("assigned_to", None).execute()
    agents = sorted({r["assigned_to"] for r in result.data if r["assigned_to"]})
    return agents


@router.get("/stats/volume-by-segment")
def get_volume_by_segment(
    created_after: str | None = Query(None),
    created_before: str | None = Query(None),
):
    OPEN_STATUSES = {"NEW", "TRIAGED", "IN_PROGRESS", "WAITING_CUSTOMER", "ESCALATED", "REOPENED"}
    db = get_db()
    query = db.table("tickets").select("customer_segment,status").neq("customer_segment", None)
    if created_after:
        query = query.gte("created_at", created_after)
    if created_before:
        query = query.lte("created_at", f"{created_before}T23:59:59.999999")
    result = query.execute()

    by_segment: dict[str, dict] = defaultdict(lambda: {"total": 0, "open": 0, "closed": 0})
    for row in result.data:
        seg = row.get("customer_segment")
        if seg not in ("ENT", "MID", "SMB"):
            continue
        by_segment[seg]["total"] += 1
        if row.get("status") in OPEN_STATUSES:
            by_segment[seg]["open"] += 1
        else:
            by_segment[seg]["closed"] += 1

    return [
        {"segment": seg, **d}
        for seg, d in sorted(by_segment.items())
    ]


@router.get("/stats/risk-by-segment")
def get_risk_by_segment(
    created_after: str | None = Query(None),
    created_before: str | None = Query(None),
):
    db = get_db()
    query = db.table("tickets").select("customer_segment,risk_score").neq("customer_segment", None)
    if created_after:
        query = query.gte("created_at", created_after)
    if created_before:
        query = query.lte("created_at", f"{created_before}T23:59:59.999999")
    result = query.execute()

    by_segment: dict[str, list[int]] = defaultdict(list)
    for row in result.data:
        seg = row.get("customer_segment")
        if seg not in ("ENT", "MID", "SMB"):
            continue
        by_segment[seg].append(row.get("risk_score") or 0)

    return [
        {
            "segment": seg,
            "avg_risk": round(sum(scores) / len(scores), 1) if scores else None,
            "count": len(scores),
        }
        for seg, scores in sorted(by_segment.items())
    ]


@router.get("/stats/volume-by-day")
def get_volume_by_day(
    created_after: str | None = Query(None),
    created_before: str | None = Query(None),
):
    db = get_db()
    query = db.table("tickets").select("created_at")
    if created_after:
        query = query.gte("created_at", created_after)
    if created_before:
        query = query.lte("created_at", f"{created_before}T23:59:59.999999")
    result = query.execute()

    counts: dict[str, int] = {}
    for row in result.data:
        raw = row.get("created_at")
        if not raw:
            continue
        date_str = str(raw)[:10]  # "YYYY-MM-DD"
        counts[date_str] = counts.get(date_str, 0) + 1

    return sorted(
        [{"date": d, "count": c} for d, c in counts.items()],
        key=lambda x: x["date"],
    )


@router.get("/stats/agents")
def get_agent_stats(
    created_after: str | None = Query(None),
    created_before: str | None = Query(None),
):
    db = get_db()
    query = (
        db.table("tickets")
        .select("assigned_to,priority,status")
        .neq("assigned_to", None)
    )
    if created_after:
        query = query.gte("created_at", created_after)
    if created_before:
        query = query.lte("created_at", f"{created_before}T23:59:59.999999")
    result = query.execute()

    rows = [
        r for r in result.data
        if r.get("status") not in ("CLOSED", "RESOLVED")
    ]

    agent_data: dict[str, dict] = defaultdict(
        lambda: {"urgent": 0, "high": 0, "medium": 0, "low": 0, "total": 0}
    )
    for row in rows:
        agent = row.get("assigned_to")
        if not agent:
            continue
        p = (row.get("priority") or "LOW").lower()
        if p not in ("urgent", "high", "medium", "low"):
            p = "low"
        agent_data[agent][p] += 1
        agent_data[agent]["total"] += 1

    return [
        {"agent": a, **d}
        for a, d in sorted(agent_data.items(), key=lambda x: -x[1]["total"])
    ]


@router.get("/stats/morning-briefing", response_model=MorningBriefingOut)
def get_morning_briefing(
    created_after: str | None = Query(None),
    created_before: str | None = Query(None),
):
    if not created_after or not created_before:
        raise HTTPException(status_code=400, detail="created_after e created_before são obrigatórios")
    try:
        d_from = datetime.fromisoformat(created_after)
        d_to = datetime.fromisoformat(created_before)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de data inválido (use YYYY-MM-DD)")
    if (d_to - d_from).days > 3:
        raise HTTPException(status_code=400, detail="Intervalo máximo de 3 dias")
    return generate_morning_briefing(created_after, created_before)


@router.get("/stats/faq-count")
def get_faq_count(
    created_after: str | None = Query(None),
    created_before: str | None = Query(None),
):
    db = get_db()
    q = db.table("tickets").select("is_faq")
    if created_after:
        q = q.gte("created_at", created_after)
    if created_before:
        q = q.lte("created_at", f"{created_before}T23:59:59.999999")
    rows = q.execute().data
    total = len(rows)
    faq_count = sum(1 for r in rows if r.get("is_faq"))
    percentage = round(faq_count / total * 100, 1) if total > 0 else 0.0
    return {"faq_count": faq_count, "total": total, "percentage": percentage}


@router.post("/{ticket_id}/suggest-classify")
def suggest_classify(ticket_id: str):
    db = get_db()
    result = db.table("tickets").select(
        "ticket_id,subject,body_preview,customer_segment,plan"
    ).eq("ticket_id", ticket_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Ticket not found")

    t = result.data[0]
    prompt = (
        "You are a B2B SaaS support triage assistant. "
        "Analyze this support ticket and suggest the best category and priority.\n\n"
        f"Customer segment: {t.get('customer_segment', 'unknown')}\n"
        f"Plan: {t.get('plan', 'unknown')}\n"
        f"Subject: {t.get('subject', '')}\n"
        f"Body: {t.get('body_preview', '')}\n\n"
        "Valid categories: BILLING, BUG, FEATURE_REQUEST, HOW_TO, CHURN_SIGNAL, OTHER\n"
        "Valid priorities: LOW, MEDIUM, HIGH, URGENT\n\n"
        'Respond with JSON only: {"category": "...", "priority": "...", "reasoning": "one sentence"}'
    )

    try:
        oa = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        resp = oa.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=150,
        )
        data = _json.loads(resp.choices[0].message.content)
        return {
            "category": data.get("category", "OTHER"),
            "priority": data.get("priority", "MEDIUM"),
            "reasoning": data.get("reasoning", ""),
        }
    except Exception:
        raise HTTPException(status_code=503, detail="AI suggestion unavailable")


@router.get("/{ticket_id}", response_model=TicketOut)
def get_ticket(ticket_id: str):
    db = get_db()
    result = db.table("tickets").select("*").eq("ticket_id", ticket_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return result.data[0]


@router.patch("/{ticket_id}/status", response_model=TicketOut)
def update_status(ticket_id: str, body: StatusUpdate):
    db = get_db()
    result = db.table("tickets").select("status").eq("ticket_id", ticket_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Ticket not found")

    current_status = result.data[0]["status"]
    ok, error = can_transition(current_status, body.new_status)
    if not ok:
        raise HTTPException(status_code=422, detail=error)

    db.table("tickets").update({"status": body.new_status}).eq("ticket_id", ticket_id).execute()
    log_event(
        ticket_id=ticket_id,
        action="STATUS_CHANGED",
        actor=body.actor,
        old_value=current_status,
        new_value=body.new_status,
        reason=body.reason,
    )
    return get_ticket(ticket_id)


@router.patch("/{ticket_id}/classify", response_model=TicketOut)
def classify_ticket(ticket_id: str, body: ClassifyUpdate):
    db = get_db()
    result = db.table("tickets").select("category,priority").eq("ticket_id", ticket_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Ticket not found")

    old = result.data[0]
    update: dict = {}
    if body.category is not None:
        update["category"] = body.category
    if body.priority is not None:
        update["priority"] = body.priority

    if update:
        db.table("tickets").update(update).eq("ticket_id", ticket_id).execute()
        log_event(
            ticket_id=ticket_id,
            action="CLASSIFIED",
            actor=body.actor,
            old_value=str(old),
            new_value=str(update),
        )
    return get_ticket(ticket_id)


@router.patch("/{ticket_id}/assign", response_model=TicketOut)
def assign_ticket(ticket_id: str, body: AssignUpdate):
    db = get_db()
    result = db.table("tickets").select("assigned_to").eq("ticket_id", ticket_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Ticket not found")

    old_agent = result.data[0]["assigned_to"]
    db.table("tickets").update({"assigned_to": body.agent_name}).eq("ticket_id", ticket_id).execute()
    log_event(
        ticket_id=ticket_id,
        action="ASSIGNED",
        actor=body.actor,
        old_value=old_agent,
        new_value=body.agent_name,
    )
    return get_ticket(ticket_id)


@router.post("/{ticket_id}/reply", response_model=ReplyOut)
def add_reply(ticket_id: str, body: ReplyCreate):
    db = get_db()
    result = db.table("ticket_replies").insert({
        "ticket_id": ticket_id,
        "body": body.body,
        "author": body.author,
        "source": body.source,
        "is_draft": False,
    }).execute()
    db.table("tickets").update({
        "last_reply_by": "AGENT",
    }).eq("ticket_id", ticket_id).execute()
    log_event(ticket_id=ticket_id, action="REPLY_ADDED", actor=body.author, source=body.source)
    return result.data[0]


@router.post("/{ticket_id}/close", response_model=TicketOut)
def close_ticket(ticket_id: str, body: CloseTicket):
    db = get_db()
    result = db.table("tickets").select("status").eq("ticket_id", ticket_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Ticket not found")

    current_status = result.data[0]["status"]
    ok, error = can_transition(current_status, "CLOSED")
    if not ok:
        raise HTTPException(status_code=422, detail=error)

    db.table("tickets").update({
        "status": "CLOSED",
        "close_reason": body.close_reason,
    }).eq("ticket_id", ticket_id).execute()
    log_event(
        ticket_id=ticket_id,
        action="CLOSED",
        actor=body.actor,
        old_value=current_status,
        new_value="CLOSED",
        reason=body.close_reason,
    )
    return get_ticket(ticket_id)


@router.post("/merge", response_model=TicketOut)
def merge_tickets(body: MergeTickets):
    db = get_db()
    primary = db.table("tickets").select("*").eq("ticket_id", body.primary_ticket_id).execute()
    secondary = db.table("tickets").select("*").eq("ticket_id", body.secondary_ticket_id).execute()
    if not primary.data or not secondary.data:
        raise HTTPException(status_code=404, detail="One or both tickets not found")

    p = primary.data[0]
    s = secondary.data[0]
    if p["customer_id"] != s["customer_id"]:
        raise HTTPException(status_code=400, detail="Cannot merge tickets from different customers")

    db.table("ticket_replies").update({"ticket_id": body.primary_ticket_id}).eq("ticket_id", body.secondary_ticket_id).execute()
    db.table("tickets").update({
        "status": "CLOSED",
        "merged_into": body.primary_ticket_id,
        "close_reason": "DUPLICATE",
    }).eq("ticket_id", body.secondary_ticket_id).execute()

    log_event(ticket_id=body.primary_ticket_id, action="MERGED", actor=body.actor, new_value=body.secondary_ticket_id)
    log_event(ticket_id=body.secondary_ticket_id, action="MERGED_INTO", actor=body.actor, new_value=body.primary_ticket_id)
    return get_ticket(body.primary_ticket_id)
