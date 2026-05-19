'use client'

import { useState, useEffect } from 'react'
import { Ticket, AuditEvent } from '@/types'
import { getAuditLog } from '@/lib/api'
import { ActionButtons } from './ActionButtons'
import { AuditLog } from './AuditLog'

interface TicketSidePanelProps {
  ticket: Ticket | null
  onClose: () => void
  onUpdate: (t: Ticket) => void
}

export function TicketSidePanel({ ticket, onClose, onUpdate }: TicketSidePanelProps) {
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [activeTab, setActiveTab] = useState<'actions' | 'audit'>('actions')

  useEffect(() => {
    if (!ticket) return
    setActiveTab('actions')
    setAuditEvents([])
    getAuditLog(ticket.ticket_id).then(setAuditEvents).catch(() => {})
  }, [ticket?.ticket_id])

  if (!ticket) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/25 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[480px] bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-start justify-between p-4 border-b gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-800 truncate">{ticket.subject}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{ticket.ticket_id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0 mt-0.5"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-3 bg-gray-50 border-b grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div><span className="text-xs text-gray-400 block">Cliente</span><span className="font-medium">{ticket.customer_name || '—'}</span></div>
          <div><span className="text-xs text-gray-400 block">Segmento</span><span className="font-medium">{ticket.customer_segment || '—'}</span></div>
          <div><span className="text-xs text-gray-400 block">Plano</span><span className="font-medium">{ticket.plan || '—'}</span></div>
          <div><span className="text-xs text-gray-400 block">Canal</span><span className="font-medium">{ticket.channel || '—'}</span></div>
          <div><span className="text-xs text-gray-400 block">Status</span><span className="font-medium">{ticket.status}</span></div>
          <div><span className="text-xs text-gray-400 block">Risk score</span><span className="font-medium">{ticket.risk_score}</span></div>
        </div>

        <div className="flex border-b">
          {(['actions', 'audit'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'actions' ? 'Ações' : 'Audit Log'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'actions'
            ? <ActionButtons ticket={ticket} onUpdate={onUpdate} />
            : <AuditLog events={auditEvents} />
          }
        </div>
      </div>
    </>
  )
}
