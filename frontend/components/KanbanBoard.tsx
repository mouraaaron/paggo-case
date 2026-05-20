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
import { DateRangePicker } from './DateRangePicker'
import { AlertsSidebar, StatsBottomBar } from './AlertPanel'

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
const FLAGS = ['', 'CHURN_UNASSIGNED', 'ENT_NO_REPLY_2H', 'CHURN_SIGNAL', 'MID_NO_REPLY_2H', 'MULTIPLE_OPEN', 'STALE_IN_PROGRESS']

type ColumnData = Record<string, Ticket[]>
type GlobalFilters = { priority?: string; segment?: string; has_flag?: string; created_after?: string; created_before?: string }
type PendingTransition = { ticket: Ticket; sourceColKey: string; targetStatus: string }

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
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [statsRefreshKey, setStatsRefreshKey] = useState(0)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function statusLabel(status: string): string {
    return COLUMNS.find(c => c.status === status)?.label ?? status
  }

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

  function handleDragEnd(event: DragEndEvent) {
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

    setPendingTransition({ ticket, sourceColKey, targetStatus })
  }

  async function confirmTransition() {
    if (!pendingTransition) return
    const { ticket, sourceColKey, targetStatus } = pendingTransition
    const ticketId = ticket.ticket_id
    setPendingTransition(null)

    const optimistic: Ticket = { ...ticket, status: targetStatus as TicketStatus }
    setColumns(prev => {
      const next = { ...prev }
      next[sourceColKey] = prev[sourceColKey].filter(t => t.ticket_id !== ticketId)
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
        next[sourceColKey] = [...prev[sourceColKey], ticket].sort(
          (a, b) => b.risk_score - a.risk_score
        )
        return next
      })
      showToast(err instanceof Error ? err.message : 'Erro ao atualizar status')
    }
  }

  function cancelTransition() {
    setPendingTransition(null)
  }

  function handleTicketUpdate(updated: Ticket) {
    setSelectedTicket(updated)
    setStatsRefreshKey(k => k + 1)
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
    <div className="flex flex-col">
      <div className="px-5 py-4 border-b border-brand-border">
        <h1 className="text-lg font-bold text-white">Inbox de Suporte</h1>
        <p className="text-xs text-brand-muted mt-0.5">Tickets ordenados por risco — os mais críticos aparecem primeiro</p>
      </div>
      <div className="flex flex-wrap gap-2 px-5 py-3 items-center border-b border-brand-border bg-brand-black">
        <select
          className="bg-brand-mid border border-brand-border text-brand-muted px-2 py-1.5 rounded text-xs focus:outline-none focus:border-brand-green cursor-pointer"
          onChange={e => setFilter('priority', e.target.value)}
        >
          {PRIORITIES.map(p => <option key={p} value={p}>{p || 'Prioridade'}</option>)}
        </select>
        <select
          className="bg-brand-mid border border-brand-border text-brand-muted px-2 py-1.5 rounded text-xs focus:outline-none focus:border-brand-green cursor-pointer"
          onChange={e => setFilter('segment', e.target.value)}
        >
          {SEGMENTS.map(s => <option key={s} value={s}>{s || 'Segmento'}</option>)}
        </select>
        <select
          className="bg-brand-mid border border-brand-border text-brand-muted px-2 py-1.5 rounded text-xs focus:outline-none focus:border-brand-green cursor-pointer"
          onChange={e => setFilter('has_flag', e.target.value)}
        >
          {FLAGS.map(f => <option key={f} value={f}>{f || 'Flag'}</option>)}
        </select>

        <DateRangePicker
          onRangeChange={(from, to) => {
            setFilters(f => ({ ...f, created_after: from, created_before: to }))
          }}
        />

        <div className="flex gap-1 flex-wrap">
          {COLUMNS.map(col => (
            <button
              key={col.status}
              onClick={() => toggleColumn(col.status)}
              className={`text-xs px-2 py-1 rounded border transition-colors cursor-pointer ${
                visibleStatuses.has(col.status)
                  ? 'bg-brand-green/10 border-brand-green/30 text-brand-green'
                  : 'bg-transparent border-brand-border text-brand-muted hover:border-brand-muted'
              }`}
            >
              {col.label}
            </button>
          ))}
        </div>

        {loading && <span className="text-xs text-brand-muted ml-1">Carregando...</span>}
      </div>

      <div className="flex flex-wrap gap-4 px-5 py-2 border-b border-brand-border text-xs text-brand-muted">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-4 rounded-sm border-2 border-pink-500 bg-brand-surface" />
          Sinal de churn detectado
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-4 rounded-sm border-2 border-dashed border-pink-500 bg-brand-surface" />
          Sinal de churn + sem responsável
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-4 rounded-sm border-2 border-red-500 bg-brand-surface" />
          Risco alto (score ≥ 70)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-4 rounded-sm border border-dashed border-brand-muted bg-brand-surface" />
          Sem responsável
        </div>
      </div>

      {/* Top row: kanban columns + alerts sidebar — height fixed to viewport */}
      <div className="flex h-[calc(100vh-13rem)] min-h-[480px]">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto flex-1 px-5 py-4">
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
              <div className="rotate-1 opacity-80 scale-105">
                <KanbanCard ticket={draggingTicket} onClick={() => {}} />
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {/* Alertas sidebar — fixed 320px, vertical, respects date filter */}
        <div className="w-80 shrink-0 border-l border-brand-border flex flex-col overflow-hidden">
          <AlertsSidebar
            onTicketClick={setSelectedTicket}
            createdAfter={filters.created_after}
            createdBefore={filters.created_before}
          />
        </div>
      </div>

      {/* Bottom section: Agentes + Tendências — grows to full content, page scrolls */}
      <StatsBottomBar
        createdAfter={filters.created_after}
        createdBefore={filters.created_before}
        refreshKey={statsRefreshKey}
      />

      <TicketSidePanel
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onUpdate={handleTicketUpdate}
      />

      {pendingTransition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={cancelTransition} />
          <div className="relative bg-brand-surface border border-brand-border rounded-xl shadow-2xl p-6 w-80">
            <h2 className="text-sm font-semibold text-white mb-1">Confirmar mudança de status</h2>
            <p className="text-xs text-brand-muted mb-4 truncate">
              #{pendingTransition.ticket.ticket_id.slice(-6)} — {pendingTransition.ticket.subject}
            </p>
            <div className="flex items-center justify-center gap-3 text-xs font-medium mb-6">
              <span className="px-2 py-1 rounded bg-brand-mid text-gray-300">
                {statusLabel(pendingTransition.ticket.status)}
              </span>
              <span className="text-brand-muted">→</span>
              <span className="px-2 py-1 rounded bg-brand-green/10 text-brand-green border border-brand-green/20">
                {statusLabel(pendingTransition.targetStatus)}
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={cancelTransition}
                className="flex-1 px-4 py-2 rounded-lg border border-brand-border text-xs text-brand-muted hover:border-white hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmTransition}
                className="flex-1 px-4 py-2 rounded-lg bg-brand-green text-brand-black text-xs font-bold hover:brightness-110 transition-all cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-brand-surface border border-brand-error/40 text-brand-error text-xs px-5 py-2.5 rounded-lg shadow-2xl z-50 border-l-2">
          {toast}
        </div>
      )}
    </div>
  )
}
