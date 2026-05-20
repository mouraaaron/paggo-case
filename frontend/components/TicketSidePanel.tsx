'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
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
  const [activeTab, setActiveTab] = useState<'message' | 'actions' | 'audit'>('message')

  useEffect(() => {
    if (!ticket) return
    setActiveTab('message')
    setAuditEvents([])
    getAuditLog(ticket.ticket_id).then(setAuditEvents).catch(() => {})
  }, [ticket?.ticket_id])

  if (!ticket) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[480px] bg-brand-surface border-l border-brand-border shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-brand-border gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-white truncate text-sm">{ticket.subject}</h2>
            <p className="text-[10px] text-brand-muted mt-0.5 font-mono">{ticket.ticket_id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-brand-muted hover:text-white transition-colors shrink-0 mt-0.5 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Metadata grid */}
        <div className="px-4 py-3 bg-brand-black border-b border-brand-border grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div><span className="text-[9px] text-brand-muted block uppercase tracking-wide mb-0.5">Cliente</span><span className="font-medium text-white">{ticket.customer_name || '—'}</span></div>
          <div><span className="text-[9px] text-brand-muted block uppercase tracking-wide mb-0.5">Segmento</span><span className={`font-medium ${ticket.customer_segment === 'ENT' ? 'text-violet-300' : ticket.customer_segment === 'MID' ? 'text-blue-300' : 'text-brand-muted'}`}>{ticket.customer_segment || '—'}</span></div>
          <div><span className="text-[9px] text-brand-muted block uppercase tracking-wide mb-0.5">Plano</span><span className="font-medium text-white">{ticket.plan || '—'}</span></div>
          <div><span className="text-[9px] text-brand-muted block uppercase tracking-wide mb-0.5">Canal</span><span className="font-medium text-white">{ticket.channel || '—'}</span></div>
          <div><span className="text-[9px] text-brand-muted block uppercase tracking-wide mb-0.5">Status</span><span className="font-medium text-white">{ticket.status}</span></div>
          <div><span className="text-[9px] text-brand-muted block uppercase tracking-wide mb-0.5">Risk Score</span><span className={`font-bold ${ticket.risk_score >= 70 ? 'text-brand-error' : ticket.risk_score >= 30 ? 'text-yellow-400' : 'text-brand-success'}`}>{ticket.risk_score}</span></div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-brand-border">
          {(['message', 'actions', 'audit'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === tab
                  ? 'border-b-2 border-brand-green text-brand-green'
                  : 'text-brand-muted hover:text-white'
              }`}
            >
              {tab === 'message' ? 'Mensagem' : tab === 'actions' ? 'Ações' : 'Audit Log'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'message' ? (
            <div>
              <p className="text-[10px] text-brand-muted mb-2">
                {ticket.created_at ? new Date(ticket.created_at).toLocaleString('pt-BR') : '—'}
              </p>
              <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                {ticket.body_preview || '(sem conteúdo)'}
              </p>
            </div>
          ) : activeTab === 'actions' ? (
            <ActionButtons ticket={ticket} onUpdate={onUpdate} />
          ) : (
            <AuditLog events={auditEvents} />
          )}
        </div>
      </div>
    </>
  )
}
