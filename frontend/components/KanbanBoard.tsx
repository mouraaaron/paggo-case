'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { Ticket, TicketStatus } from '@/types'
import { getTickets, updateStatus } from '@/lib/api'
import { canTransition } from '@/lib/stateMachine'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCard } from './KanbanCard'
import { TicketSidePanel } from './TicketSidePanel'

const COLUMNS = [
  { status: 'NEW', label: 'Novo' },
  { status: 'TRIAGED', label: 'Triado' },
  { status: 'IN_PROGRESS', label: 'Em Andamento' },
  { status: 'WAITING_CUSTOMER', label: 'Aguardando' },
  { status: 'RESOLVED', label: 'Resolvido' },
  { status: 'CLOSED', label: 'Encerrado' },
  { status: 'REOPENED', label: 'Reaberto' },
]

const PRIORITIES = ['', 'LOW', 'MEDIUM', 'HIGH', 'URGENT']
const SEGMENTS = ['', 'SMB', 'MID', 'ENT']
const FLAGS = ['', 'CHURN_SIGNAL', 'SLA_BREACH', 'URGENT_UNATTENDED', 'MULTIPLE_OPEN', 'STALE_IN_PROGRESS']

type ColumnData = Record<string, Ticket[]>
type GlobalFilters = { priority?: string; segment?: string; has_flag?: string }

export function KanbanBoard() {
  const [columns, setColumns] = useState<ColumnData>(
    Object.fromEntries(COLUMNS.map(c => [c.status, []]))
  )
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<GlobalFilters>({})
  const [visibleStatuses, setVisibleStatuses] = useState<Set<string>>(
    new Set(COLUMNS.map(c => c.status))
  )
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [draggingTicket, setDraggingTicket] = useState<Ticket | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const filtersKey = JSON.stringify(filters)

  const loadColumns = useCallback(() => {
    setLoading(true)
    const queries = COLUMNS.map(col => {
      const statuses =
        col.status === 'IN_PROGRESS' ? ['IN_PROGRESS', 'ESCALATED'] : [col.status]
      return Promise.all(
        statuses.map(s =>
          getTickets({
            ...filters,
            status: s,
            limit: 50,
            sort_by: 'risk_score',
            sort_desc: true,
          })
        )
      ).then(results => ({
        key: col.status,
        tickets: results.flat().sort((a, b) => b.risk_score - a.risk_score),
      }))
    })

    Promise.all(queries)
      .then(results =>
        setColumns(Object.fromEntries(results.map(r => [r.key, r.tickets])))
      )
      .finally(() => setLoading(false))
  }, [filtersKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(() => loadColumns(), 300)
    return () => clearTimeout(timer)
  }, [loadColumns])

  function setFilter(key: keyof GlobalFilters, value: string) {
    setFilters(f => ({ ...f, [key]: value || undefined }))
  }

  function toggleColumn(status: string) {
    setVisibleStatuses(prev => {
      const next = new Set(prev)
      next.has(status) ? next.delete(status) : next.add(status)
      return next
    })
  }

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string
    for (const tickets of Object.values(columns)) {
      const found = tickets.find(t => t.ticket_id === id)
      if (found) { setDraggingTicket(found); return }
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDraggingTicket(null)
    const { active, over } = event
    if (!over) return

    const ticketId = active.id as string
    const targetStatus = over.id as string

    let sourceColKey: string | null = null
    let ticket: Ticket | null = null
    for (const [key, tickets] of Object.entries(columns)) {
      const found = tickets.find(t => t.ticket_id === ticketId)
      if (found) { sourceColKey = key; ticket = found; break }
    }

    if (!ticket || !sourceColKey || sourceColKey === targetStatus) return

    if (!canTransition(ticket.status, targetStatus)) {
      showToast(`Transição inválida: ${ticket.status} → ${targetStatus}`)
      return
    }

    const optimistic: Ticket = { ...ticket, status: targetStatus as TicketStatus }
    setColumns(prev => {
      const next = { ...prev }
      next[sourceColKey!] = prev[sourceColKey!].filter(t => t.ticket_id !== ticketId)
      next[targetStatus] = [...prev[targetStatus], optimistic].sort(
        (a, b) => b.risk_score - a.risk_score
      )
      return next
    })

    try {
      const fresh = await updateStatus(ticketId, targetStatus)
      setColumns(prev => ({
        ...prev,
        [targetStatus]: prev[targetStatus].map(t =>
          t.ticket_id === ticketId ? fresh : t
        ),
      }))
    } catch (err) {
      setColumns(prev => {
        const next = { ...prev }
        next[targetStatus] = prev[targetStatus].filter(t => t.ticket_id !== ticketId)
        next[sourceColKey!] = [...prev[sourceColKey!], ticket!].sort(
          (a, b) => b.risk_score - a.risk_score
        )
        return next
      })
      showToast(err instanceof Error ? err.message : 'Erro ao atualizar status')
    }
  }

  function handleTicketUpdate(updated: Ticket) {
    setSelectedTicket(updated)
    setColumns(prev => {
      const next: ColumnData = Object.fromEntries(
        Object.entries(prev).map(([k, v]) => [
          k,
          v.filter(t => t.ticket_id !== updated.ticket_id),
        ])
      )
      const targetCol =
        updated.status === 'ESCALATED' ? 'IN_PROGRESS' : updated.status
      if (next[targetCol]) {
        next[targetCol] = [...next[targetCol], updated].sort(
          (a, b) => b.risk_score - a.risk_score
        )
      }
      return next
    })
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <select
          className="border rounded px-2 py-1 text-sm"
          onChange={e => setFilter('priority', e.target.value)}
        >
          {PRIORITIES.map(p => <option key={p} value={p}>{p || 'Prioridade'}</option>)}
        </select>
        <select
          className="border rounded px-2 py-1 text-sm"
          onChange={e => setFilter('segment', e.target.value)}
        >
          {SEGMENTS.map(s => <option key={s} value={s}>{s || 'Segmento'}</option>)}
        </select>
        <select
          className="border rounded px-2 py-1 text-sm"
          onChange={e => setFilter('has_flag', e.target.value)}
        >
          {FLAGS.map(f => <option key={f} value={f}>{f || 'Flag'}</option>)}
        </select>

        <div className="flex gap-1 flex-wrap">
          {COLUMNS.map(col => (
            <button
              key={col.status}
              onClick={() => toggleColumn(col.status)}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                visibleStatuses.has(col.status)
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-gray-50 border-gray-200 text-gray-400'
              }`}
            >
              {col.label}
            </button>
          ))}
        </div>

        {loading && <span className="text-sm text-gray-400 ml-1">Carregando...</span>}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-6">
          {COLUMNS.filter(col => visibleStatuses.has(col.status)).map(col => (
            <KanbanColumn
              key={col.status}
              status={col.status}
              label={col.label}
              tickets={columns[col.status] ?? []}
              onCardClick={setSelectedTicket}
            />
          ))}
        </div>

        <DragOverlay>
          {draggingTicket && (
            <div className="rotate-1 opacity-90">
              <KanbanCard ticket={draggingTicket} onClick={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <TicketSidePanel
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onUpdate={handleTicketUpdate}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-600 text-white text-sm px-5 py-2.5 rounded-lg shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
