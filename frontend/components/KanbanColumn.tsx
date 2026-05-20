'use client'

import { useDroppable } from '@dnd-kit/core'
import { Ticket } from '@/types'
import { KanbanCard } from './KanbanCard'

interface KanbanColumnProps {
  status: string
  label: string
  tickets: Ticket[]
  onCardClick: (ticket: Ticket) => void
}

export function KanbanColumn({ status, label, tickets, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="flex flex-col w-[220px] shrink-0">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="font-bold text-[10px] text-brand-muted uppercase tracking-[1.5px]">{label}</span>
        <span className="text-[9px] bg-brand-green/10 text-brand-green border border-brand-green/20 px-1.5 py-0.5 rounded font-bold">
          {tickets.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 rounded-lg p-1.5 min-h-[120px] overflow-y-auto max-h-[calc(100vh-260px)] flex flex-col gap-2 transition-colors duration-150 ${
          isOver
            ? 'bg-brand-green/5 ring-1 ring-brand-green/30'
            : 'bg-brand-surface/50'
        }`}
      >
        {tickets.map(ticket => (
          <KanbanCard
            key={ticket.ticket_id}
            ticket={ticket}
            onClick={onCardClick}
          />
        ))}
        {tickets.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[10px] text-brand-muted">Sem tickets</span>
          </div>
        )}
      </div>
    </div>
  )
}
