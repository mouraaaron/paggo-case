'use client'

import { useState } from 'react'
import { Ticket, TicketStatus, TicketPriority, TicketCategory } from '@/types'
import {
  updateStatus,
  classifyTicket,
  assignTicket,
  addReply,
  closeTicket,
  getTicket,
} from '@/lib/api'

const AGENTS = [
  'Ana Souza',
  'Bruno Lima',
  'Carla Mendes',
  'Diego Cruz',
  'Erica Tavares',
  'Felipe Nunes',
  'Giovana Reis',
  'Henrique Faria',
  'Isadora Pinto',
  'João Vargas',
  'Karina Melo',
]

const STATUS_OPTIONS: TicketStatus[] = [
  'NEW',
  'TRIAGED',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'RESOLVED',
  'CLOSED',
  'ESCALATED',
  'REOPENED',
]

const PRIORITY_OPTIONS: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

const CATEGORY_OPTIONS: Exclude<TicketCategory, null>[] = [
  'BILLING',
  'BUG',
  'FEATURE_REQUEST',
  'HOW_TO',
  'CHURN_SIGNAL',
  'OTHER',
]

const CLOSE_REASON_OPTIONS = ['RESOLVED', 'DUPLICATE', 'SPAM', 'NO_RESPONSE']

interface ActionButtonsProps {
  ticket: Ticket
  onUpdate: (t: Ticket) => void
}

export function ActionButtons({ ticket, onUpdate }: ActionButtonsProps) {
  // Section A — Change Status
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus>(ticket.status)
  const [statusError, setStatusError] = useState('')
  const [statusLoading, setStatusLoading] = useState(false)

  // Section B — Classify
  const [selectedPriority, setSelectedPriority] = useState<TicketPriority>(
    ticket.priority ?? 'MEDIUM'
  )
  const [selectedCategory, setSelectedCategory] = useState<Exclude<TicketCategory, null>>(
    ticket.category ?? 'OTHER'
  )
  const [classifyError, setClassifyError] = useState('')
  const [classifyLoading, setClassifyLoading] = useState(false)

  // Section C — Assign
  const [agentName, setAgentName] = useState(ticket.assigned_to ?? '')
  const [assignError, setAssignError] = useState('')
  const [assignLoading, setAssignLoading] = useState(false)

  // Section D — Add Reply
  const [replyBody, setReplyBody] = useState('')
  const [replyAuthor, setReplyAuthor] = useState('support-agent')
  const [replyError, setReplyError] = useState('')
  const [replyLoading, setReplyLoading] = useState(false)

  // Section E — Close Ticket
  const [closeReason, setCloseReason] = useState(CLOSE_REASON_OPTIONS[0])
  const [closeError, setCloseError] = useState('')
  const [closeLoading, setCloseLoading] = useState(false)

  async function handleStatusUpdate() {
    setStatusError('')
    setStatusLoading(true)
    try {
      const updated = await updateStatus(ticket.ticket_id, selectedStatus)
      onUpdate(updated)
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : 'Error updating status')
    } finally {
      setStatusLoading(false)
    }
  }

  async function handleClassify() {
    setClassifyError('')
    setClassifyLoading(true)
    try {
      const updated = await classifyTicket(ticket.ticket_id, selectedCategory, selectedPriority)
      onUpdate(updated)
    } catch (e) {
      setClassifyError(e instanceof Error ? e.message : 'Error classifying ticket')
    } finally {
      setClassifyLoading(false)
    }
  }

  async function handleAssign() {
    setAssignError('')
    setAssignLoading(true)
    try {
      const updated = await assignTicket(ticket.ticket_id, agentName || null)
      onUpdate(updated)
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : 'Error assigning ticket')
    } finally {
      setAssignLoading(false)
    }
  }

  async function handleReply() {
    setReplyError('')
    setReplyLoading(true)
    try {
      await addReply(ticket.ticket_id, replyBody)
      const freshTicket = await getTicket(ticket.ticket_id)
      onUpdate(freshTicket)
      setReplyBody('')
      setReplyAuthor('support-agent')
    } catch (e) {
      setReplyError(e instanceof Error ? e.message : 'Error sending reply')
    } finally {
      setReplyLoading(false)
    }
  }

  async function handleClose() {
    setCloseError('')
    setCloseLoading(true)
    try {
      const updated = await closeTicket(ticket.ticket_id, closeReason)
      onUpdate(updated)
    } catch (e) {
      setCloseError(e instanceof Error ? e.message : 'Error closing ticket')
    } finally {
      setCloseLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Section A — Change Status */}
      <section className="border border-brand-border rounded-lg p-3 bg-brand-black">
        <h3 className="text-xs font-bold text-brand-muted uppercase tracking-wide mb-2">Change Status</h3>
        <div className="flex gap-2 items-center">
          <select
            className="bg-brand-mid border border-brand-border rounded px-2 py-1.5 text-xs text-white flex-1 focus:outline-none focus:border-brand-green cursor-pointer"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as TicketStatus)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            className="bg-brand-green text-brand-black text-xs font-bold px-3 py-1.5 rounded hover:brightness-110 disabled:opacity-40 transition-all cursor-pointer"
            onClick={handleStatusUpdate}
            disabled={statusLoading}
          >
            {statusLoading ? '...' : 'Update'}
          </button>
        </div>
        {statusError && <p className="text-[10px] text-brand-error mt-1">{statusError}</p>}
      </section>

      {/* Section B — Classify */}
      <section className="border border-brand-border rounded-lg p-3 bg-brand-black">
        <h3 className="text-xs font-bold text-brand-muted uppercase tracking-wide mb-2">Classify</h3>
        <div className="flex gap-2 mb-2">
          <select
            className="bg-brand-mid border border-brand-border rounded px-2 py-1.5 text-xs text-white flex-1 focus:outline-none focus:border-brand-green cursor-pointer"
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value as TicketPriority)}
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            className="bg-brand-mid border border-brand-border rounded px-2 py-1.5 text-xs text-white flex-1 focus:outline-none focus:border-brand-green cursor-pointer"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as Exclude<TicketCategory, null>)}
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <button
          className="bg-brand-green text-brand-black text-xs font-bold px-3 py-1.5 rounded hover:brightness-110 disabled:opacity-40 transition-all cursor-pointer"
          onClick={handleClassify}
          disabled={classifyLoading}
        >
          {classifyLoading ? '...' : 'Classify'}
        </button>
        {classifyError && <p className="text-[10px] text-brand-error mt-1">{classifyError}</p>}
      </section>

      {/* Section C — Assign */}
      <section className="border border-brand-border rounded-lg p-3 bg-brand-black">
        <h3 className="text-xs font-bold text-brand-muted uppercase tracking-wide mb-2">Atribuir Agente</h3>
        <div className="flex gap-2 items-center">
          <select
            className="bg-brand-mid border border-brand-border rounded px-2 py-1.5 text-xs text-white flex-1 focus:outline-none focus:border-brand-green cursor-pointer"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
          >
            <option value="">— Não atribuído —</option>
            {AGENTS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <button
            className="bg-brand-green text-brand-black text-xs font-bold px-3 py-1.5 rounded hover:brightness-110 disabled:opacity-40 transition-all cursor-pointer"
            onClick={handleAssign}
            disabled={assignLoading}
          >
            {assignLoading ? '...' : 'Atribuir'}
          </button>
        </div>
        {assignError && <p className="text-[10px] text-brand-error mt-1">{assignError}</p>}
      </section>

      {/* Section D — Add Reply */}
      <section className="border border-brand-border rounded-lg p-3 bg-brand-black">
        <h3 className="text-xs font-bold text-brand-muted uppercase tracking-wide mb-2">Add Reply</h3>
        <input
          type="text"
          className="bg-brand-mid border border-brand-border rounded px-2 py-1.5 text-xs text-white w-full mb-2 focus:outline-none focus:border-brand-green"
          placeholder="Author"
          value={replyAuthor}
          onChange={(e) => setReplyAuthor(e.target.value)}
        />
        <textarea
          className="bg-brand-mid border border-brand-border rounded px-2 py-1.5 text-xs text-white w-full resize-none mb-2 focus:outline-none focus:border-brand-green"
          rows={3}
          placeholder="Reply body..."
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value)}
        />
        <button
          className="bg-brand-green text-brand-black text-xs font-bold px-3 py-1.5 rounded hover:brightness-110 disabled:opacity-40 transition-all cursor-pointer"
          onClick={handleReply}
          disabled={replyLoading || !replyBody.trim()}
        >
          {replyLoading ? '...' : 'Send Reply'}
        </button>
        {replyError && <p className="text-[10px] text-brand-error mt-1">{replyError}</p>}
      </section>

      {/* Section E — Close Ticket */}
      <section className="border border-brand-border rounded-lg p-3 bg-brand-black">
        <h3 className="text-xs font-bold text-brand-muted uppercase tracking-wide mb-2">Close Ticket</h3>
        <div className="flex gap-2 items-center">
          <select
            className="bg-brand-mid border border-brand-border rounded px-2 py-1.5 text-xs text-white flex-1 focus:outline-none focus:border-brand-green cursor-pointer"
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
          >
            {CLOSE_REASON_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            className="bg-brand-error/10 text-brand-error text-xs font-bold px-3 py-1.5 rounded border border-brand-error/25 hover:bg-brand-error/20 disabled:opacity-40 transition-colors cursor-pointer"
            onClick={handleClose}
            disabled={closeLoading}
          >
            {closeLoading ? '...' : 'Close'}
          </button>
        </div>
        {closeError && <p className="text-[10px] text-brand-error mt-1">{closeError}</p>}
      </section>
    </div>
  )
}
