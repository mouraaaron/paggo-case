'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Ticket, TriageFlag } from '@/types'
import { getTickets, TicketFilters } from '@/lib/api'
import { TriageBadge } from './TriageBadge'

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  return `${Math.floor(diff / 86400)}d atrás`
}

const STATUSES = ['', 'NEW', 'TRIAGED', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'ESCALATED', 'RESOLVED', 'CLOSED']
const PRIORITIES = ['', 'LOW', 'MEDIUM', 'HIGH', 'URGENT']
const SEGMENTS = ['', 'SMB', 'MID', 'ENT']
const FLAGS = ['', 'CHURN_SIGNAL', 'SLA_BREACH', 'URGENT_UNATTENDED', 'MULTIPLE_OPEN', 'STALE_IN_PROGRESS']

export function TicketTable() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [filters, setFilters] = useState<TicketFilters>({ limit: 100, sort_by: 'risk_score', sort_desc: true })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getTickets(filters)
      .then(setTickets)
      .finally(() => setLoading(false))
  }, [filters])

  function setFilter(key: keyof TicketFilters, value: string) {
    setFilters(f => ({ ...f, [key]: value || undefined, offset: 0 }))
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select className="border rounded px-2 py-1 text-sm" onChange={e => setFilter('status', e.target.value)}>
          {STATUSES.map(s => <option key={s} value={s}>{s || 'Status'}</option>)}
        </select>
        <select className="border rounded px-2 py-1 text-sm" onChange={e => setFilter('priority', e.target.value)}>
          {PRIORITIES.map(p => <option key={p} value={p}>{p || 'Prioridade'}</option>)}
        </select>
        <select className="border rounded px-2 py-1 text-sm" onChange={e => setFilter('segment', e.target.value)}>
          {SEGMENTS.map(s => <option key={s} value={s}>{s || 'Segmento'}</option>)}
        </select>
        <select className="border rounded px-2 py-1 text-sm" onChange={e => setFilter('has_flag', e.target.value)}>
          {FLAGS.map(f => <option key={f} value={f}>{f || 'Flag'}</option>)}
        </select>
        <span className="text-sm text-gray-500 self-center">{loading ? 'Carregando...' : `${tickets.length} tickets`}</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-2 border">Score</th>
              <th className="p-2 border">Assunto</th>
              <th className="p-2 border">Cliente</th>
              <th className="p-2 border">Seg.</th>
              <th className="p-2 border">Status</th>
              <th className="p-2 border">Prioridade</th>
              <th className="p-2 border">Flags</th>
              <th className="p-2 border">Idade</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(t => (
              <tr
                key={t.ticket_id}
                className={`hover:bg-gray-50 ${t.triage_flags.length > 0 ? 'border-l-4 border-l-red-400' : ''}`}
              >
                <td className="p-2 border font-bold text-center">{t.risk_score}</td>
                <td className="p-2 border max-w-xs truncate">
                  <Link href={`/tickets/${t.ticket_id}`} className="text-blue-600 hover:underline">
                    {t.subject}
                  </Link>
                </td>
                <td className="p-2 border">{t.customer_name}</td>
                <td className="p-2 border">{t.customer_segment}</td>
                <td className="p-2 border">{t.status}</td>
                <td className="p-2 border">{t.priority}</td>
                <td className="p-2 border">
                  <div className="flex flex-wrap gap-1">
                    {t.triage_flags.map(f => (
                      <TriageBadge key={f} flag={f as TriageFlag} />
                    ))}
                  </div>
                </td>
                <td className="p-2 border whitespace-nowrap">{timeAgo(t.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
