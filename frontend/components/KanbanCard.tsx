'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Ticket, TriageFlag } from '@/types'
import { TriageBadge } from './TriageBadge'

interface KanbanCardProps {
  ticket: Ticket
  onClick: (ticket: Ticket) => void
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  return `${Math.floor(diff / 86400)}d atrás`
}

function cardBorderClass(ticket: Ticket): string {
  const unassigned = !ticket.assigned_to
  if (ticket.risk_score >= 70)
    return unassigned ? 'border-2 border-dashed border-red-500' : 'border-2 border-red-500'
  if (ticket.triage_flags.includes('CHURN_SIGNAL'))
    return unassigned ? 'border-2 border-dashed border-pink-500' : 'border-2 border-pink-500'
  return unassigned ? 'border border-dashed border-brand-border' : 'border border-brand-border'
}

function riskBarColor(score: number): string {
  if (score >= 70) return 'bg-brand-error'
  if (score >= 30) return 'bg-yellow-400'
  return 'bg-brand-success'
}

function riskTextColor(score: number): string {
  if (score >= 70) return 'text-brand-error'
  if (score >= 30) return 'text-yellow-400'
  return 'text-brand-success'
}

export function KanbanCard({ ticket, onClick }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket.ticket_id,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.35 : 1,
  }

  const isUnassigned = !ticket.assigned_to
  const isEscalated = ticket.status === 'ESCALATED'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(ticket)}
      className={`bg-brand-surface rounded-lg p-3 cursor-grab active:cursor-grabbing select-none hover:bg-brand-mid transition-colors ${cardBorderClass(ticket)}`}
    >
      {/* Row 1: id, segment, priority, urgent icon, escalated badge */}
      <div className="flex items-center gap-1 flex-wrap mb-1.5">
        <span className="text-[9px] text-brand-muted font-mono">#{ticket.ticket_id.slice(-6)}</span>
        {ticket.customer_segment && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
            ticket.customer_segment === 'ENT' ? 'bg-violet-500/20 text-violet-300'
            : ticket.customer_segment === 'MID' ? 'bg-blue-500/20 text-blue-300'
            : 'bg-brand-mid text-brand-muted'
          }`}>
            {ticket.customer_segment}
          </span>
        )}
        {ticket.priority && ticket.priority !== 'URGENT' && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-mid text-brand-muted">{ticket.priority}</span>
        )}
        {ticket.priority === 'URGENT' && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">URGENT 🔥</span>
        )}
        {isEscalated && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400">ESCALADO</span>
        )}
      </div>

      {/* Row 2: subject */}
      <p className="text-xs font-medium text-white line-clamp-2 mb-1 leading-snug">{ticket.subject}</p>

      {/* Row 3: customer + category */}
      <p className="text-[10px] text-brand-muted mb-2 truncate">
        {ticket.customer_name}{ticket.category ? ` · ${ticket.category}` : ''}
      </p>

      {/* Row 4: risk score bar */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 bg-brand-mid rounded-full h-1">
          <div
            className={`h-1 rounded-full ${riskBarColor(ticket.risk_score)}`}
            style={{ width: `${ticket.risk_score}%` }}
          />
        </div>
        <span className={`text-[10px] font-bold w-6 text-right ${riskTextColor(ticket.risk_score)}`}>
          {ticket.risk_score}
        </span>
      </div>

      {/* Row 5: time + assignee */}
      <div className="flex items-center justify-between text-[10px] text-brand-muted mb-1">
        <span>⏱ {timeAgo(ticket.last_reply_at ?? ticket.created_at)}</span>
        {isUnassigned
          ? <span className="bg-brand-mid text-brand-muted px-1.5 py-0.5 rounded text-[9px]">Não atribuído</span>
          : <span>👤 {ticket.assigned_to}</span>
        }
      </div>

      {/* Row 6: triage flags */}
      {ticket.triage_flags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {ticket.triage_flags.map(f => (
            <TriageBadge key={f} flag={f as TriageFlag} />
          ))}
        </div>
      )}
    </div>
  )
}
