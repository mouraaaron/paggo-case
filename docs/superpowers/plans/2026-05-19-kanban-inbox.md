# Kanban Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/inbox` table with a kanban board while preserving all filters, triage logic, and actions; add a toggle to switch back to table view.

**Architecture:** `KanbanBoard` owns all column data (6 parallel queries, 50 tickets each) and the DnD context. `KanbanColumn` is a pure presentational droppable. `KanbanCard` is a draggable card. `TicketSidePanel` is a slide-over that reuses existing `ActionButtons` and `AuditLog`. The inbox page becomes a client component with a localStorage-persisted toggle.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, @dnd-kit/core, @dnd-kit/utilities

---

## File Map

| Action | File |
|---|---|
| Create | `frontend/lib/stateMachine.ts` |
| Create | `frontend/components/KanbanCard.tsx` |
| Create | `frontend/components/KanbanColumn.tsx` |
| Create | `frontend/components/TicketSidePanel.tsx` |
| Create | `frontend/components/KanbanBoard.tsx` |
| Modify | `frontend/app/inbox/page.tsx` |
| Unchanged | `frontend/components/TicketTable.tsx` |

---

### Task 1: Install @dnd-kit and create stateMachine.ts

**Files:**
- Create: `frontend/lib/stateMachine.ts`

- [ ] **Step 1: Install @dnd-kit packages**

```powershell
cd C:\Users\aaron\paggo-case\frontend
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npm install @dnd-kit/core @dnd-kit/utilities
```

Expected output: packages added, no peer-dependency errors.

- [ ] **Step 2: Create `frontend/lib/stateMachine.ts`**

```typescript
export const VALID_TRANSITIONS: Record<string, string[]> = {
  NEW: ['TRIAGED'],
  TRIAGED: ['IN_PROGRESS'],
  IN_PROGRESS: ['WAITING_CUSTOMER', 'ESCALATED', 'RESOLVED'],
  WAITING_CUSTOMER: ['IN_PROGRESS'],
  ESCALATED: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: ['IN_PROGRESS'],
}

export function canTransition(current: string, target: string): boolean {
  return (VALID_TRANSITIONS[current] ?? []).includes(target)
}
```

- [ ] **Step 3: Build check**

```powershell
cd C:\Users\aaron\paggo-case\frontend
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npx next build 2>&1 | Select-Object -Last 10
```

Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```powershell
git add frontend/lib/stateMachine.ts frontend/package.json frontend/package-lock.json
git commit -m "feat: install @dnd-kit and add stateMachine util"
```

---

### Task 2: KanbanCard

**Files:**
- Create: `frontend/components/KanbanCard.tsx`

- [ ] **Step 1: Create `frontend/components/KanbanCard.tsx`**

```tsx
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

function leftBorderClass(ticket: Ticket): string {
  if (ticket.risk_score >= 70) return 'border-l-red-500'
  if (ticket.triage_flags.includes('CHURN_SIGNAL')) return 'border-l-pink-500'
  return 'border-l-gray-200'
}

function riskBarColor(score: number): string {
  if (score >= 70) return 'bg-red-500'
  if (score >= 30) return 'bg-yellow-400'
  return 'bg-green-500'
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

  const borderBase = isUnassigned
    ? 'border border-dashed border-gray-300'
    : 'border border-gray-100'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(ticket)}
      className={`bg-white rounded-lg shadow-sm p-3 cursor-grab active:cursor-grabbing select-none hover:shadow-md transition-shadow border-l-4 ${leftBorderClass(ticket)} ${borderBase}`}
    >
      {/* Row 1: id, segment, priority, urgent icon, escalated badge */}
      <div className="flex items-center gap-1 flex-wrap mb-1">
        <span className="text-xs text-gray-400">#{ticket.ticket_id.slice(-6)}</span>
        {ticket.customer_segment && (
          <span className={`text-xs font-bold px-1 rounded ${
            ticket.customer_segment === 'ENT' ? 'bg-purple-100 text-purple-700'
            : ticket.customer_segment === 'MID' ? 'bg-blue-100 text-blue-700'
            : 'bg-gray-100 text-gray-600'
          }`}>
            {ticket.customer_segment}
          </span>
        )}
        {ticket.priority && (
          <span className="text-xs px-1 rounded bg-gray-100 text-gray-600">{ticket.priority}</span>
        )}
        {ticket.priority === 'URGENT' && <span title="Urgente">🔥</span>}
        {isEscalated && (
          <span className="text-xs font-bold px-1 rounded bg-orange-100 text-orange-700">ESCALADO</span>
        )}
      </div>

      {/* Row 2: subject */}
      <p className="text-sm font-medium line-clamp-2 mb-1 leading-snug">{ticket.subject}</p>

      {/* Row 3: customer + category */}
      <p className="text-xs text-gray-500 mb-2 truncate">
        {ticket.customer_name}{ticket.category ? ` · ${ticket.category}` : ''}
      </p>

      {/* Row 4: risk score bar */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full ${riskBarColor(ticket.risk_score)}`}
            style={{ width: `${ticket.risk_score}%` }}
          />
        </div>
        <span className="text-xs font-bold text-gray-600 w-6 text-right">{ticket.risk_score}</span>
      </div>

      {/* Row 5: time + assignee */}
      <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
        <span>⏱ {timeAgo(ticket.last_reply_at ?? ticket.created_at)}</span>
        {isUnassigned
          ? <span className="bg-gray-100 text-gray-400 px-1 rounded">Não atribuído</span>
          : <span>👤 {ticket.assigned_to}</span>
        }
      </div>

      {/* Row 6: triage flags */}
      {ticket.triage_flags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {ticket.triage_flags.map(f => (
            <TriageBadge key={f} flag={f as TriageFlag} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build check**

```powershell
cd C:\Users\aaron\paggo-case\frontend
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npx next build 2>&1 | Select-Object -Last 10
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```powershell
git add frontend/components/KanbanCard.tsx
git commit -m "feat: KanbanCard draggable component with visual indicators"
```

---

### Task 3: KanbanColumn

**Files:**
- Create: `frontend/components/KanbanColumn.tsx`

- [ ] **Step 1: Create `frontend/components/KanbanColumn.tsx`**

```tsx
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
      {/* Column header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="font-semibold text-sm text-gray-700 uppercase tracking-wide">{label}</span>
        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
          {tickets.length}
        </span>
      </div>

      {/* Drop zone */}
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
```

- [ ] **Step 2: Build check**

```powershell
cd C:\Users\aaron\paggo-case\frontend
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npx next build 2>&1 | Select-Object -Last 10
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```powershell
git add frontend/components/KanbanColumn.tsx
git commit -m "feat: KanbanColumn droppable component"
```

---

### Task 4: TicketSidePanel

**Files:**
- Create: `frontend/components/TicketSidePanel.tsx`

`ActionButtons` props: `ticket: Ticket, onUpdate: (t: Ticket) => void`
`AuditLog` props: `events: AuditEvent[]`
`getAuditLog` signature: `getAuditLog(ticketId: string): Promise<AuditEvent[]>`

- [ ] **Step 1: Create `frontend/components/TicketSidePanel.tsx`**

```tsx
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/25 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[480px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
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

        {/* Customer context */}
        <div className="px-4 py-3 bg-gray-50 border-b grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div>
            <span className="text-xs text-gray-400 block">Cliente</span>
            <span className="font-medium">{ticket.customer_name || '—'}</span>
          </div>
          <div>
            <span className="text-xs text-gray-400 block">Segmento</span>
            <span className="font-medium">{ticket.customer_segment || '—'}</span>
          </div>
          <div>
            <span className="text-xs text-gray-400 block">Plano</span>
            <span className="font-medium">{ticket.plan || '—'}</span>
          </div>
          <div>
            <span className="text-xs text-gray-400 block">Canal</span>
            <span className="font-medium">{ticket.channel || '—'}</span>
          </div>
          <div>
            <span className="text-xs text-gray-400 block">Status atual</span>
            <span className="font-medium">{ticket.status}</span>
          </div>
          <div>
            <span className="text-xs text-gray-400 block">Risk score</span>
            <span className="font-medium">{ticket.risk_score}</span>
          </div>
        </div>

        {/* Tabs */}
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

        {/* Tab content */}
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
```

- [ ] **Step 2: Build check**

```powershell
cd C:\Users\aaron\paggo-case\frontend
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npx next build 2>&1 | Select-Object -Last 10
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```powershell
git add frontend/components/TicketSidePanel.tsx
git commit -m "feat: TicketSidePanel slide-over with actions and audit log"
```

---

### Task 5: KanbanBoard

**Files:**
- Create: `frontend/components/KanbanBoard.tsx`

`getTickets` signature: `getTickets(filters: TicketFilters): Promise<Ticket[]>`
`updateStatus` signature: `updateStatus(ticketId: string, newStatus: string, reason?: string): Promise<Ticket>`
`canTransition` signature: `canTransition(current: string, target: string): boolean`

- [ ] **Step 1: Create `frontend/components/KanbanBoard.tsx`**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
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

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

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
  }, [JSON.stringify(filters)]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadColumns()
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

    // Optimistic update
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
      // Revert
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
      {/* Filters */}
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

        {/* Column visibility toggles */}
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

      {/* Board */}
      <DndContext
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

        <DragOverlay dropAnimation={null}>
          {draggingTicket && (
            <div className="rotate-1 opacity-90">
              <KanbanCard ticket={draggingTicket} onClick={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Side panel */}
      <TicketSidePanel
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onUpdate={handleTicketUpdate}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-600 text-white text-sm px-5 py-2.5 rounded-lg shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build check**

```powershell
cd C:\Users\aaron\paggo-case\frontend
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npx next build 2>&1 | Select-Object -Last 15
```

Expected: `✓ Compiled successfully` with no TypeScript errors.

- [ ] **Step 3: Commit**

```powershell
git add frontend/components/KanbanBoard.tsx
git commit -m "feat: KanbanBoard with DnD, parallel column queries, side panel"
```

---

### Task 6: Update InboxPage with toggle

**Files:**
- Modify: `frontend/app/inbox/page.tsx`

Current content:
```tsx
import { TicketTable } from '@/components/TicketTable'

export default function InboxPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-1">Inbox de Suporte</h1>
      <p className="text-gray-500 text-sm mb-4">Tickets ordenados por risco — os mais críticos aparecem primeiro</p>
      <TicketTable />
    </main>
  )
}
```

- [ ] **Step 1: Replace `frontend/app/inbox/page.tsx`**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { TicketTable } from '@/components/TicketTable'
import { KanbanBoard } from '@/components/KanbanBoard'

type ViewMode = 'kanban' | 'table'

export default function InboxPage() {
  const [view, setView] = useState<ViewMode>('kanban')

  useEffect(() => {
    const saved = localStorage.getItem('inbox_view') as ViewMode | null
    if (saved === 'kanban' || saved === 'table') setView(saved)
  }, [])

  function switchView(v: ViewMode) {
    setView(v)
    localStorage.setItem('inbox_view', v)
  }

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Inbox de Suporte</h1>
          <p className="text-gray-500 text-sm">
            Tickets ordenados por risco — os mais críticos aparecem primeiro
          </p>
        </div>
        <div className="flex rounded overflow-hidden border border-gray-200">
          <button
            onClick={() => switchView('kanban')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              view === 'kanban'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Kanban
          </button>
          <button
            onClick={() => switchView('table')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-200 ${
              view === 'table'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Tabela
          </button>
        </div>
      </div>

      {view === 'kanban' ? <KanbanBoard /> : <TicketTable />}
    </main>
  )
}
```

- [ ] **Step 2: Build check**

```powershell
cd C:\Users\aaron\paggo-case\frontend
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npx next build 2>&1 | Select-Object -Last 15
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: Final commit**

```powershell
git add frontend/app/inbox/page.tsx
git commit -m "feat: inbox kanban/table toggle with localStorage persistence"
git push origin master
```
