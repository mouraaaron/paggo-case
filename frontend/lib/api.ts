import { Ticket, AuditEvent, TicketReply } from '@/types'

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options)
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail || 'Request failed')
  }
  return res.json()
}

// --- Read ---
export interface TicketFilters {
  status?: string
  priority?: string
  segment?: string
  channel?: string
  assigned_to?: string
  category?: string
  has_flag?: string
  created_after?: string
  created_before?: string
  sort_by?: string
  sort_desc?: boolean
  limit?: number
  offset?: number
}

export function getTickets(filters: TicketFilters = {}): Promise<Ticket[]> {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.set(k, String(v))
  })
  return req<Ticket[]>(`/tickets?${params}`)
}

export function getFlaggedTickets(): Promise<Ticket[]> {
  return req<Ticket[]>('/tickets/flagged')
}

export function getTicket(id: string): Promise<Ticket> {
  return req<Ticket>(`/tickets/${id}`)
}

export function getAuditLog(ticketId: string): Promise<AuditEvent[]> {
  return req<AuditEvent[]>(`/tickets/${ticketId}/audit`)
}

// --- Write ---
export function updateStatus(ticketId: string, newStatus: string, reason?: string): Promise<Ticket> {
  return req<Ticket>(`/tickets/${ticketId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_status: newStatus, reason, actor: 'leader' }),
  })
}

export function classifyTicket(ticketId: string, category?: string, priority?: string): Promise<Ticket> {
  return req<Ticket>(`/tickets/${ticketId}/classify`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, priority, actor: 'leader' }),
  })
}

export function assignTicket(ticketId: string, agentName: string | null): Promise<Ticket> {
  return req<Ticket>(`/tickets/${ticketId}/assign`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_name: agentName, actor: 'leader' }),
  })
}

export function addReply(ticketId: string, body: string): Promise<TicketReply> {
  return req<TicketReply>(`/tickets/${ticketId}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body, author: 'leader', source: 'USER' }),
  })
}

export function closeTicket(ticketId: string, closeReason: string): Promise<Ticket> {
  return req<Ticket>(`/tickets/${ticketId}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ close_reason: closeReason, actor: 'leader' }),
  })
}

export function getAgents(): Promise<string[]> {
  return req<string[]>('/tickets/agents')
}

export function mergeTickets(primaryId: string, secondaryId: string): Promise<Ticket> {
  return req<Ticket>('/tickets/merge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ primary_ticket_id: primaryId, secondary_ticket_id: secondaryId, actor: 'leader' }),
  })
}

// --- Agent ---
export interface AgentHistoryEntry {
  role: string;
  content?: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
}

export interface AgentPendingAction {
  name: string;
  args: Record<string, unknown>;
  tool_call_id: string;
}

export async function sendAgentMessage(
  message: string,
  history: AgentHistoryEntry[],
  confirmedAction?: AgentPendingAction | null
): Promise<{ reply: string; pending_action: AgentPendingAction | null; updated_history: AgentHistoryEntry[] }> {
  const res = await fetch(`${BASE}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      history,
      confirmed_action: confirmedAction ?? null,
    }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
