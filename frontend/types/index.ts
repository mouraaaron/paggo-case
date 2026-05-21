export type CustomerSegment = 'SMB' | 'MID' | 'ENT'
export type TicketStatus = 'NEW' | 'TRIAGED' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED' | 'ESCALATED' | 'REOPENED'
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type TicketCategory = 'BILLING' | 'BUG' | 'FEATURE_REQUEST' | 'HOW_TO' | 'CHURN_SIGNAL' | 'OTHER' | null
export type TriageFlag =
  | 'CHURN_UNASSIGNED'
  | 'ENT_NO_REPLY_2H'
  | 'CHURN_SIGNAL'
  | 'MID_NO_REPLY_2H'
  | 'MULTIPLE_OPEN'
  | 'STALE_IN_PROGRESS'

export interface Ticket {
  ticket_id: string
  customer_id: string | null
  customer_name: string | null
  customer_segment: CustomerSegment | null
  plan: string | null
  channel: string | null
  subject: string | null
  body_preview: string | null
  created_at: string | null
  last_reply_at: string | null
  last_reply_by: 'CUSTOMER' | 'AGENT' | null
  reply_count: number
  status: TicketStatus
  priority: TicketPriority | null
  assigned_to: string | null
  category: TicketCategory
  previous_open_tickets_for_customer: number
  triage_flags: TriageFlag[]
  risk_score: number
  close_reason: string | null
  merged_into: string | null
  is_faq: boolean
}

export interface AuditEvent {
  id: string
  ticket_id: string
  action: string
  old_value: string | null
  new_value: string | null
  actor: string
  source: 'USER' | 'AGENT'
  reason: string | null
  created_at: string
}

export interface TicketReply {
  id: string
  ticket_id: string
  body: string
  author: string
  created_at: string
  is_draft: boolean
  source: 'USER' | 'AGENT'
}

export interface AgentChatMessage {
  role: 'user' | 'assistant'
  content: string
  pending_actions?: PendingAction[]
}

export interface PendingAction {
  tool: string
  params: Record<string, unknown>
  description: string
}
