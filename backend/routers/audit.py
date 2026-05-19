from fastapi import APIRouter
from models import AuditEventOut
from database import get_db

router = APIRouter(prefix="/tickets", tags=["audit"])


@router.get("/{ticket_id}/audit", response_model=list[AuditEventOut])
def get_audit_log(ticket_id: str):
    db = get_db()
    result = (
        db.table("audit_log")
        .select("*")
        .eq("ticket_id", ticket_id)
        .order("created_at", desc=False)
        .execute()
    )
    return result.data
