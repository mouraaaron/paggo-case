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
      <div className="flex border-b border-gray-200 mb-3">
        <button
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'actions'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('actions')}
        >
          Actions
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'audit'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
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
