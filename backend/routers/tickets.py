from fastapi import APIRouter, Query, HTTPException
from models import TicketOut
from database import get_db

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


@router.get("/{ticket_id}", response_model=TicketOut)
def get_ticket(ticket_id: str):
    db = get_db()
    result = db.table("tickets").select("*").eq("ticket_id", ticket_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return result.data[0]
