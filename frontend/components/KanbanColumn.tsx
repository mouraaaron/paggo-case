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
    <div className="flex flex-col w-72 shrink-0">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="font-semibold text-sm text-gray-700 uppercase tracking-wide">{label}</span>
        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
          {tickets.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 rounded-xl p-2 min-h-[120px] overflow-y-auto max-h-[calc(100vh-240px)] flex flex-col gap-2 transition-colors duration-150 ${
          isOver ? 'bg-blue-50 ring-2 ring-blue-200' : 'bg-gray-100/60'
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
            <span className="text-xs text-gray-400">Sem tickets</span>
          </div>
        )}
      </div>
    </div>
  )
}
