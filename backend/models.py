from pydantic import BaseModel
from typing import Optional

class TicketOut(BaseModel):
    ticket_id: str
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_segment: Optional[str] = None
    plan: Optional[str] = None
    channel: Optional[str] = None
    subject: Optional[str] = None
    body_preview: Optional[str] = None
    created_at: Optional[str] = None
    last_reply_at: Optional[str] = None
    last_reply_by: Optional[str] = None
    reply_count: int = 0
    status: str
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    category: Optional[str] = None
    previous_open_tickets_for_customer: int = 0
    triage_flags: list[str] = []
    risk_score: int = 0
    close_reason: Optional[str] = None
    merged_into: Optional[str] = None

class StatusUpdate(BaseModel):
    new_status: str
    reason: Optional[str] = None
    actor: str = "leader"

class ClassifyUpdate(BaseModel):
    category: Optional[str] = None
    priority: Optional[str] = None
    actor: str = "leader"

class AssignUpdate(BaseModel):
    agent_name: Optional[str] = None
    actor: str = "leader"

class ReplyCreate(BaseModel):
    body: str
    author: str = "leader"
    source: str = "USER"

class CloseTicket(BaseModel):
    close_reason: str
    actor: str = "leader"

class MergeTickets(BaseModel):
    primary_ticket_id: str
    secondary_ticket_id: str
    actor: str = "leader"

class AuditEventOut(BaseModel):
    id: str
    ticket_id: str
    action: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    actor: str
    source: str
    reason: Optional[str] = None
    created_at: str

class AgentMessage(BaseModel):
    message: str
    pending_actions: list[dict] = []

class ReplyOut(BaseModel):
    id: str
    ticket_id: str
    body: str
    author: str
    created_at: str
    is_draft: bool
    source: str

class NewTicketsBreakdown(BaseModel):
    total: int
    ENT: int
    MID: int
    SMB: int

class TeamStatus(BaseModel):
    overloaded_agents: list[str]
    unassigned_urgent: int

class MorningBriefingOut(BaseModel):
    period_label: str
    new_tickets: NewTicketsBreakdown
    team_status: TeamStatus
    narrative: str
    next_steps: list[str]
