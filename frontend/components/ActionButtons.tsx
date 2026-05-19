'use client'

import { useState } from 'react'
import { Ticket, TicketStatus, TicketPriority, TicketCategory } from '@/types'
import {
  updateStatus,
  classifyTicket,
  assignTicket,
  addReply,
  closeTicket,
} from '@/lib/api'

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
      await addReply(ticket.ticket_id, replyBody, replyAuthor)
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
      <section className="border border-gray-200 rounded p-3">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Change Status</h3>
        <div className="flex gap-2 items-center">
          <select
            className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
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
            className="bg-blue-600 text-white text-sm px-3 py-1 rounded disabled:opacity-50"
            onClick={handleStatusUpdate}
            disabled={statusLoading}
          >
            {statusLoading ? '...' : 'Update'}
          </button>
        </div>
        {statusError && <p className="text-xs text-red-500 mt-1">{statusError}</p>}
      </section>

      {/* Section B — Classify */}
      <section className="border border-gray-200 rounded p-3">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Classify</h3>
        <div className="flex gap-2 mb-2">
          <select
            className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
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
            className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
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
          className="bg-blue-600 text-white text-sm px-3 py-1 rounded disabled:opacity-50"
          onClick={handleClassify}
          disabled={classifyLoading}
        >
          {classifyLoading ? '...' : 'Classify'}
        </button>
        {classifyError && <p className="text-xs text-red-500 mt-1">{classifyError}</p>}
      </section>

      {/* Section C — Assign */}
      <section className="border border-gray-200 rounded p-3">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Assign</h3>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
            placeholder="Agent name"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
          />
          <button
            className="bg-blue-600 text-white text-sm px-3 py-1 rounded disabled:opacity-50"
            onClick={handleAssign}
            disabled={assignLoading}
          >
            {assignLoading ? '...' : 'Assign'}
          </button>
        </div>
        {assignError && <p className="text-xs text-red-500 mt-1">{assignError}</p>}
      </section>

      {/* Section D — Add Reply */}
      <section className="border border-gray-200 rounded p-3">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Add Reply</h3>
        <input
          type="text"
          className="border border-gray-300 rounded px-2 py-1 text-sm w-full mb-2"
          placeholder="Author"
          value={replyAuthor}
          onChange={(e) => setReplyAuthor(e.target.value)}
        />
        <textarea
          className="border border-gray-300 rounded px-2 py-1 text-sm w-full resize-none mb-2"
          rows={3}
          placeholder="Reply body..."
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value)}
        />
        <button
          className="bg-blue-600 text-white text-sm px-3 py-1 rounded disabled:opacity-50"
          onClick={handleReply}
          disabled={replyLoading || !replyBody.trim()}
        >
          {replyLoading ? '...' : 'Send Reply'}
        </button>
        {replyError && <p className="text-xs text-red-500 mt-1">{replyError}</p>}
      </section>

      {/* Section E — Close Ticket */}
      <section className="border border-gray-200 rounded p-3">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Close Ticket</h3>
        <div className="flex gap-2 items-center">
          <select
            className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
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
            className="bg-red-600 text-white text-sm px-3 py-1 rounded disabled:opacity-50"
            onClick={handleClose}
            disabled={closeLoading}
          >
            {closeLoading ? '...' : 'Close'}
          </button>
        </div>
        {closeError && <p className="text-xs text-red-500 mt-1">{closeError}</p>}
      </section>
    </div>
  )
}
