'use client'

import { useState } from 'react'
import { Ticket, AuditEvent } from '@/types'
import { ActionButtons } from '@/components/ActionButtons'
import { AuditLog } from '@/components/AuditLog'

type Tab = 'actions' | 'audit'

interface TicketDetailPanelProps {
  initialTicket: Ticket
  auditEvents: AuditEvent[]
}

export function TicketDetailPanel({ initialTicket, auditEvents }: TicketDetailPanelProps) {
  const [ticket, setTicket] = useState<Ticket>(initialTicket)
  const [activeTab, setActiveTab] = useState<Tab>('actions')

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-brand-border mb-3">
        <button
          className={`px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === 'actions'
              ? 'border-b-2 border-brand-green text-brand-green'
              : 'text-brand-muted hover:text-white'
          }`}
          onClick={() => setActiveTab('actions')}
        >
          Ações
        </button>
        <button
          className={`px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === 'audit'
              ? 'border-b-2 border-brand-green text-brand-green'
              : 'text-brand-muted hover:text-white'
          }`}
          onClick={() => setActiveTab('audit')}
        >
          Audit Log
        </button>
      </div>

      {/* Tab content */}
      <div className="overflow-y-auto flex-1">
        {activeTab === 'actions' ? (
          <ActionButtons ticket={ticket} onUpdate={setTicket} />
        ) : (
          <AuditLog events={auditEvents} />
        )}
      </div>
    </div>
  )
}
