# Dark Theme Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar o frontend do Paggo Support para o visual dark premium aprovado no brainstorming — fundo preto `#0A0A0A`, verde ácido `#C8FF00` como accent, sidebar de ícones lateral, tipografia Inter.

**Architecture:** Puramente visual — nenhuma lógica de negócio, chamada de API ou estado é alterado. Task 1 define os tokens de cor no CSS (Tailwind v4 `@theme`) que todas as tasks seguintes consomem. Task 2 troca o top-navbar pelo sidebar, alterando o layout raiz. Tasks 3–10 reescrevem os className de cada componente para usar os tokens dark.

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4 (CSS-first, `@theme`), `next/font/google` (Inter), Lucide React (ícones SVG no sidebar).

---

## Mapeamento de arquivos

| Arquivo | Operação | Responsabilidade |
|---|---|---|
| `frontend/app/globals.css` | Modificar | Tokens Tailwind v4, Inter font, body dark |
| `frontend/app/layout.tsx` | Modificar | Trocar top-nav por sidebar de ícones |
| `frontend/components/KanbanBoard.tsx` | Modificar | Filtros, legenda, toggles de coluna — dark |
| `frontend/components/KanbanColumn.tsx` | Modificar | Cabeçalho e corpo da coluna — dark |
| `frontend/components/KanbanCard.tsx` | Modificar | Card dark (bg, texto, badges) |
| `frontend/components/TicketSidePanel.tsx` | Modificar | Painel lateral dark |
| `frontend/components/ActionButtons.tsx` | Modificar | Formulários, inputs, botões — dark |
| `frontend/components/AuditLog.tsx` | Modificar | Timeline dark |
| `frontend/components/TriageBadge.tsx` | Modificar | Badges adaptados ao fundo escuro |
| `frontend/components/AgentChat.tsx` | Modificar | Chat UI dark |
| `frontend/app/agent/page.tsx` | Modificar | Wrapper dark para o chat |
| `frontend/app/inbox/page.tsx` | Modificar | Remove padding/heading (sidebar cuida do contexto) |
| `frontend/app/tickets/[id]/page.tsx` | Modificar | Detalhe do ticket dark |

---

## Tokens de cor (referência para todas as tasks)

| Token Tailwind | Hex | Uso |
|---|---|---|
| `bg-brand-black` / `text-brand-black` | `#0A0A0A` | Background principal |
| `bg-brand-surface` | `#1A1A1A` | Cards, sidebar, colunas |
| `bg-brand-mid` | `#2E2E2E` | Inputs, borders pesados, hover |
| `text-brand-muted` | `#7A7A7A` | Labels secundários |
| `border-brand-border` | `#333333` | Divisores |
| `text-brand-green` / `bg-brand-green` | `#C8FF00` | CTA, active, accent |
| `text-brand-success` | `#4CAF50` | Sucesso |
| `text-brand-error` | `#FF5252` | Erro/risco |

---

## Task 1: CSS foundation — tokens Tailwind v4 + Inter font

**Arquivos:**
- Modificar: `frontend/app/globals.css`
- Modificar: `frontend/app/layout.tsx`

- [ ] **Step 1: Instalar lucide-react** (ícones SVG para o sidebar)

```powershell
cd frontend
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npm install lucide-react
```

Esperado: `added 1 package` (ou similar), sem erros.

- [ ] **Step 2: Substituir globals.css com tokens de cor e Inter**

```css
/* frontend/app/globals.css */
@import "tailwindcss";

@theme {
  --color-brand-green:   #C8FF00;
  --color-brand-black:   #0A0A0A;
  --color-brand-surface: #1A1A1A;
  --color-brand-mid:     #2E2E2E;
  --color-brand-muted:   #7A7A7A;
  --color-brand-border:  #333333;
  --color-brand-success: #4CAF50;
  --color-brand-error:   #FF5252;
}

body {
  background: #0A0A0A;
  color: #FFFFFF;
  font-family: var(--font-inter), Inter, sans-serif;
}
```

- [ ] **Step 3: Atualizar layout.tsx — trocar Geist por Inter, remover navbar**

```tsx
/* frontend/app/layout.tsx */
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'Paggo Support',
  description: 'Sistema de triagem de tickets de suporte',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-brand-black text-white">
        {children}
      </body>
    </html>
  )
}
```

> Nota: o sidebar será adicionado na Task 2. Por agora o layout apenas aplica o fundo dark.

- [ ] **Step 4: Verificar build**

```powershell
cd frontend
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npx next build
```

Esperado: `✓ Compiled successfully` e `✓ Generating static pages`.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/globals.css frontend/app/layout.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat: dark theme foundation — brand tokens, Inter font, black body"
```

---

## Task 2: Sidebar de navegação

**Arquivos:**
- Modificar: `frontend/app/layout.tsx`
- Modificar: `frontend/app/inbox/page.tsx`
- Modificar: `frontend/app/agent/page.tsx`

- [ ] **Step 1: Substituir layout.tsx pelo shell com sidebar**

```tsx
/* frontend/app/layout.tsx */
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import { LayoutGrid, MessageSquare, Settings } from 'lucide-react'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'Paggo Support',
  description: 'Sistema de triagem de tickets de suporte',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-brand-black text-white flex">
        {/* ─── Sidebar ─── */}
        <aside className="w-[60px] min-h-screen bg-brand-black border-r border-brand-border flex flex-col items-center py-4 gap-2 shrink-0 fixed left-0 top-0 bottom-0 z-30">
          {/* Logo */}
          <div className="mb-4 text-center">
            <span className="text-brand-green font-black text-[11px] tracking-[2px] leading-none block">PU</span>
            <span className="text-brand-muted text-[8px] tracking-wider">paggo</span>
          </div>

          {/* Nav items */}
          <NavItem href="/inbox" icon={<LayoutGrid size={18} />} label="Inbox" />
          <NavItem href="/agent" icon={<MessageSquare size={18} />} label="Agente IA" />

          {/* Bottom */}
          <div className="mt-auto">
            <NavItem href="#" icon={<Settings size={16} />} label="Config" />
          </div>
        </aside>

        {/* ─── Main content offset by sidebar width ─── */}
        <main className="ml-[60px] flex-1 min-h-screen flex flex-col">
          {children}
        </main>
      </body>
    </html>
  )
}

function NavItem({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link
      href={href}
      title={label}
      className="w-10 h-10 rounded-lg flex items-center justify-center text-brand-muted hover:text-white hover:bg-brand-surface transition-colors duration-150 cursor-pointer"
    >
      {icon}
    </Link>
  )
}
```

> Nota: active state visual (verde ácido) será adicionado depois se necessário. Por agora o hover já diferencia o item.

- [ ] **Step 2: Simplificar inbox/page.tsx — remover heading redundante**

```tsx
/* frontend/app/inbox/page.tsx */
import { KanbanBoard } from '@/components/KanbanBoard'

export default function InboxPage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <KanbanBoard />
    </div>
  )
}
```

- [ ] **Step 3: Ajustar agent/page.tsx para usar h-screen**

```tsx
/* frontend/app/agent/page.tsx */
import AgentChat from '@/components/AgentChat'

export default function AgentPage() {
  return (
    <div className="h-screen flex flex-col">
      <AgentChat />
    </div>
  )
}
```

- [ ] **Step 4: Verificar build**

```powershell
cd frontend
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npx next build
```

Esperado: `✓ Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/layout.tsx frontend/app/inbox/page.tsx frontend/app/agent/page.tsx
git commit -m "feat: icon sidebar replaces top navbar"
```

---

## Task 3: KanbanBoard — filtros, legenda e header dark

**Arquivo:**
- Modificar: `frontend/components/KanbanBoard.tsx`

Substitua apenas os className — não altere nenhuma lógica (useState, useEffect, handlers). As únicas mudanças são de aparência.

- [ ] **Step 1: Substituir o bloco de filtros (linha ~190–227 do arquivo atual)**

Localize o `<div className="flex flex-wrap gap-2 mb-4 items-center">` e substitua por:

```tsx
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

  <div className="flex items-center gap-1 text-xs">
    <label className="text-brand-muted whitespace-nowrap">De</label>
    <input
      type="date"
      className="bg-brand-mid border border-brand-border text-brand-muted px-2 py-1.5 rounded text-xs focus:outline-none focus:border-brand-green"
      onChange={e => setFilter('created_after', e.target.value)}
    />
    <label className="text-brand-muted whitespace-nowrap">até</label>
    <input
      type="date"
      className="bg-brand-mid border border-brand-border text-brand-muted px-2 py-1.5 rounded text-xs focus:outline-none focus:border-brand-green"
      onChange={e => setFilter('created_before', e.target.value)}
    />
  </div>

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
```

- [ ] **Step 2: Substituir o bloco da legenda (logo abaixo dos filtros)**

```tsx
<div className="flex flex-wrap gap-4 px-5 py-2 border-b border-brand-border text-xs text-brand-muted">
  <div className="flex items-center gap-1.5">
    <span className="inline-block w-3 h-4 rounded-sm border-2 border-pink-500 bg-brand-surface" />
    Sinal de churn
  </div>
  <div className="flex items-center gap-1.5">
    <span className="inline-block w-3 h-4 rounded-sm border-2 border-dashed border-pink-500 bg-brand-surface" />
    Churn + sem responsável
  </div>
  <div className="flex items-center gap-1.5">
    <span className="inline-block w-3 h-4 rounded-sm border-2 border-brand-error bg-brand-surface" />
    Risco alto (score ≥ 70)
  </div>
  <div className="flex items-center gap-1.5">
    <span className="inline-block w-3 h-4 rounded-sm border border-dashed border-brand-border bg-brand-surface" />
    Sem responsável
  </div>
</div>
```

- [ ] **Step 3: Substituir o kanban area wrapper**

Localize `<div className="flex gap-4 overflow-x-auto pb-6">` e troque por:

```tsx
<div className="flex gap-3 overflow-x-auto flex-1 px-5 py-4">
```

- [ ] **Step 4: Atualizar o DragOverlay**

```tsx
<DragOverlay>
  {draggingTicket && (
    <div className="rotate-1 opacity-80 scale-105">
      <KanbanCard ticket={draggingTicket} onClick={() => {}} />
    </div>
  )}
</DragOverlay>
```

- [ ] **Step 5: Atualizar o modal de confirmação**

Localize o bloco `{pendingTransition && (` e substitua o JSX interno:

```tsx
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
```

- [ ] **Step 6: Atualizar o toast**

```tsx
{toast && (
  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-brand-surface border border-brand-error/40 text-brand-error text-xs px-5 py-2.5 rounded-lg shadow-2xl z-50 border-l-2">
    {toast}
  </div>
)}
```

- [ ] **Step 7: Adicionar o page header dentro do KanbanBoard**

Logo antes do `<div className="flex flex-wrap gap-2 ...">` de filtros, adicione:

```tsx
<div className="px-5 py-4 border-b border-brand-border">
  <h1 className="text-lg font-bold text-white">Inbox de Suporte</h1>
  <p className="text-xs text-brand-muted mt-0.5">Tickets ordenados por risco — os mais críticos aparecem primeiro</p>
</div>
```

- [ ] **Step 8: Verificar build**

```powershell
cd frontend
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npx next build
```

Esperado: `✓ Compiled successfully`.

- [ ] **Step 9: Commit**

```bash
git add frontend/components/KanbanBoard.tsx
git commit -m "feat: KanbanBoard dark theme — filters, legend, modals, toast"
```

---

## Task 4: KanbanColumn dark

**Arquivo:**
- Modificar: `frontend/components/KanbanColumn.tsx`

- [ ] **Step 1: Reescrever KanbanColumn.tsx**

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
```

- [ ] **Step 2: Verificar build**

```powershell
cd frontend
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npx next build
```

Esperado: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/KanbanColumn.tsx
git commit -m "feat: KanbanColumn dark theme"
```

---

## Task 5: KanbanCard dark

**Arquivo:**
- Modificar: `frontend/components/KanbanCard.tsx`

- [ ] **Step 1: Reescrever KanbanCard.tsx**

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

function cardBorderClass(ticket: Ticket): string {
  const unassigned = !ticket.assigned_to
  if (ticket.risk_score >= 70)
    return unassigned ? 'border-2 border-dashed border-red-500' : 'border-2 border-red-500'
  if (ticket.triage_flags.includes('CHURN_SIGNAL'))
    return unassigned ? 'border-2 border-dashed border-pink-500' : 'border-2 border-pink-500'
  return unassigned ? 'border border-dashed border-brand-border' : 'border border-brand-border'
}

function riskBarColor(score: number): string {
  if (score >= 70) return 'bg-brand-error'
  if (score >= 30) return 'bg-yellow-400'
  return 'bg-brand-success'
}

function riskTextColor(score: number): string {
  if (score >= 70) return 'text-brand-error'
  if (score >= 30) return 'text-yellow-400'
  return 'text-brand-success'
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(ticket)}
      className={`bg-brand-surface rounded-lg p-3 cursor-grab active:cursor-grabbing select-none hover:bg-brand-mid transition-colors ${cardBorderClass(ticket)}`}
    >
      {/* Row 1: id, segment, priority, urgent icon, escalated badge */}
      <div className="flex items-center gap-1 flex-wrap mb-1.5">
        <span className="text-[9px] text-brand-muted font-mono">#{ticket.ticket_id.slice(-6)}</span>
        {ticket.customer_segment && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
            ticket.customer_segment === 'ENT' ? 'bg-violet-500/20 text-violet-300'
            : ticket.customer_segment === 'MID' ? 'bg-blue-500/20 text-blue-300'
            : 'bg-brand-mid text-brand-muted'
          }`}>
            {ticket.customer_segment}
          </span>
        )}
        {ticket.priority && ticket.priority !== 'URGENT' && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-mid text-brand-muted">{ticket.priority}</span>
        )}
        {ticket.priority === 'URGENT' && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">URGENT 🔥</span>
        )}
        {isEscalated && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400">ESCALADO</span>
        )}
      </div>

      {/* Row 2: subject */}
      <p className="text-xs font-medium text-white line-clamp-2 mb-1 leading-snug">{ticket.subject}</p>

      {/* Row 3: customer + category */}
      <p className="text-[10px] text-brand-muted mb-2 truncate">
        {ticket.customer_name}{ticket.category ? ` · ${ticket.category}` : ''}
      </p>

      {/* Row 4: risk score bar */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 bg-brand-mid rounded-full h-1">
          <div
            className={`h-1 rounded-full ${riskBarColor(ticket.risk_score)}`}
            style={{ width: `${ticket.risk_score}%` }}
          />
        </div>
        <span className={`text-[10px] font-bold w-6 text-right ${riskTextColor(ticket.risk_score)}`}>
          {ticket.risk_score}
        </span>
      </div>

      {/* Row 5: time + assignee */}
      <div className="flex items-center justify-between text-[10px] text-brand-muted mb-1">
        <span>⏱ {timeAgo(ticket.last_reply_at ?? ticket.created_at)}</span>
        {isUnassigned
          ? <span className="bg-brand-mid text-brand-muted px-1.5 py-0.5 rounded text-[9px]">Não atribuído</span>
          : <span>👤 {ticket.assigned_to}</span>
        }
      </div>

      {/* Row 6: triage flags */}
      {ticket.triage_flags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {ticket.triage_flags.map(f => (
            <TriageBadge key={f} flag={f as TriageFlag} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar build**

```powershell
cd frontend
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npx next build
```

Esperado: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/KanbanCard.tsx
git commit -m "feat: KanbanCard dark theme"
```

---

## Task 6: TicketSidePanel dark

**Arquivo:**
- Modificar: `frontend/components/TicketSidePanel.tsx`

- [ ] **Step 1: Reescrever TicketSidePanel.tsx**

```tsx
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
```

- [ ] **Step 2: Verificar build**

```powershell
cd frontend
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npx next build
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/TicketSidePanel.tsx
git commit -m "feat: TicketSidePanel dark theme"
```

---

## Task 7: ActionButtons dark

**Arquivo:**
- Modificar: `frontend/components/ActionButtons.tsx`

Não altere nenhuma lógica (useState, handlers). Substitua apenas os className das sections, inputs, selects e buttons.

- [ ] **Step 1: Trocar className de todos os `<section>`**

De:
```tsx
<section className="border border-gray-200 rounded p-3">
  <h3 className="text-sm font-semibold text-gray-700 mb-2">
```

Para (aplique em **todas as 5 sections**):
```tsx
<section className="border border-brand-border rounded-lg p-3 bg-brand-black">
  <h3 className="text-xs font-bold text-brand-muted uppercase tracking-wide mb-2">
```

- [ ] **Step 2: Trocar className de todos os `<select>` e `<input>`**

De:
```tsx
className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
```

Para:
```tsx
className="bg-brand-mid border border-brand-border rounded px-2 py-1.5 text-xs text-white flex-1 focus:outline-none focus:border-brand-green cursor-pointer"
```

- [ ] **Step 3: Trocar o `<textarea>` (seção Reply)**

De:
```tsx
className="border border-gray-300 rounded px-2 py-1 text-sm w-full resize-none mb-2"
```

Para:
```tsx
className="bg-brand-mid border border-brand-border rounded px-2 py-1.5 text-xs text-white w-full resize-none mb-2 focus:outline-none focus:border-brand-green"
```

- [ ] **Step 4: Trocar todos os botões `bg-blue-600`** (Status, Classify, Assign, Reply)

De:
```tsx
className="bg-blue-600 text-white text-sm px-3 py-1 rounded disabled:opacity-50"
```

Para:
```tsx
className="bg-brand-green text-brand-black text-xs font-bold px-3 py-1.5 rounded hover:brightness-110 disabled:opacity-40 transition-all cursor-pointer"
```

- [ ] **Step 5: Trocar o botão Close (vermelho)**

De:
```tsx
className="bg-red-600 text-white text-sm px-3 py-1 rounded disabled:opacity-50"
```

Para:
```tsx
className="bg-brand-error/10 text-brand-error text-xs font-bold px-3 py-1.5 rounded border border-brand-error/25 hover:bg-brand-error/20 disabled:opacity-40 transition-colors cursor-pointer"
```

- [ ] **Step 6: Trocar as mensagens de erro**

De:
```tsx
<p className="text-xs text-red-500 mt-1">
```

Para:
```tsx
<p className="text-[10px] text-brand-error mt-1">
```

- [ ] **Step 7: Verificar build**

```powershell
cd frontend
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npx next build
```

- [ ] **Step 8: Commit**

```bash
git add frontend/components/ActionButtons.tsx
git commit -m "feat: ActionButtons dark theme"
```

---

## Task 8: AuditLog + TriageBadge dark

**Arquivos:**
- Modificar: `frontend/components/AuditLog.tsx`
- Modificar: `frontend/components/TriageBadge.tsx`

- [ ] **Step 1: Reescrever AuditLog.tsx**

```tsx
'use client'

import { AuditEvent } from '@/types'

export function AuditLog({ events }: { events: AuditEvent[] }) {
  if (events.length === 0) {
    return <p className="text-xs text-brand-muted italic">Sem eventos ainda.</p>
  }

  return (
    <ol className="relative border-l border-brand-border space-y-4 ml-3">
      {events.map((event) => (
        <li key={event.id} className="relative ml-4">
          <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border border-brand-surface bg-brand-mid" />

          <div className="flex items-center gap-2 flex-wrap">
            <time className="text-[10px] text-brand-muted">
              {new Date(event.created_at).toLocaleString('pt-BR')}
            </time>
            <span className="text-[10px] font-medium text-gray-300">{event.actor}</span>
            {event.source === 'AGENT' ? (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">
                AI
              </span>
            ) : (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-mid text-brand-muted">
                User
              </span>
            )}
          </div>

          <p className="text-xs text-white mt-0.5">{event.action}</p>

          {(event.old_value || event.new_value) && (
            <p className="text-[10px] text-brand-muted mt-0.5 font-mono">
              {event.old_value ?? '—'} → {event.new_value ?? '—'}
            </p>
          )}

          {event.reason && (
            <p className="text-[10px] italic text-brand-muted mt-0.5">{event.reason}</p>
          )}
        </li>
      ))}
    </ol>
  )
}
```

- [ ] **Step 2: Reescrever TriageBadge.tsx**

```tsx
import { TriageFlag } from '@/types'

const FLAG_CONFIG: Record<TriageFlag, { label: string; color: string }> = {
  CHURN_SIGNAL:      { label: 'Churn',    color: 'bg-pink-500/15 text-pink-400 border border-pink-500/20' },
  SLA_BREACH:        { label: 'SLA',      color: 'bg-orange-500/15 text-orange-400 border border-orange-500/20' },
  URGENT_UNATTENDED: { label: 'Urgente',  color: 'bg-red-500/15 text-red-400 border border-red-500/20' },
  MULTIPLE_OPEN:     { label: '3+ tickets', color: 'bg-violet-500/15 text-violet-400 border border-violet-500/20' },
  STALE_IN_PROGRESS: { label: 'Parado',   color: 'bg-brand-mid text-brand-muted border border-brand-border' },
}

export function TriageBadge({ flag }: { flag: TriageFlag }) {
  const config = FLAG_CONFIG[flag]
  if (!config) return null
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${config.color}`}>
      {config.label}
    </span>
  )
}
```

- [ ] **Step 3: Verificar build**

```powershell
cd frontend
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npx next build
```

- [ ] **Step 4: Commit**

```bash
git add frontend/components/AuditLog.tsx frontend/components/TriageBadge.tsx
git commit -m "feat: AuditLog + TriageBadge dark theme"
```

---

## Task 9: AgentChat dark

**Arquivo:**
- Modificar: `frontend/components/AgentChat.tsx`

Não altere nenhuma lógica. Substitua apenas os className.

- [ ] **Step 1: Trocar header do chat**

De:
```tsx
<div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
  <h1 className="text-lg font-semibold text-gray-900">AI Triage Assistant</h1>
  <p className="text-sm text-gray-500">Ask me to triage, assign, classify, or manage tickets.</p>
</div>
```

Para:
```tsx
<div className="bg-brand-surface border-b border-brand-border px-4 py-3 flex-shrink-0">
  <h1 className="text-base font-bold text-white">Assistente de Triagem</h1>
  <p className="text-xs text-brand-muted">Pergunte sobre tickets, atribuições, status e classificações.</p>
</div>
```

- [ ] **Step 2: Trocar área de mensagens**

De:
```tsx
<div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
  {messages.length === 0 && (
    <p className="text-center text-gray-400 text-sm mt-8">
      Start a conversation with the AI Triage Assistant.
    </p>
  )}
```

Para:
```tsx
<div className="flex-1 overflow-y-auto p-4 space-y-3 bg-brand-black">
  {messages.length === 0 && (
    <p className="text-center text-brand-muted text-xs mt-8">
      Inicie uma conversa com o assistente de triagem.
    </p>
  )}
```

- [ ] **Step 3: Trocar bubbles das mensagens**

De:
```tsx
className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words ${
  msg.role === 'user'
    ? 'bg-blue-600 text-white rounded-br-sm'
    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm'
}`}
```

Para:
```tsx
className={`max-w-[75%] rounded-2xl px-4 py-2 text-xs whitespace-pre-wrap break-words ${
  msg.role === 'user'
    ? 'bg-brand-green text-brand-black font-medium rounded-br-sm'
    : 'bg-brand-surface text-gray-200 border border-brand-border rounded-bl-sm'
}`}
```

- [ ] **Step 4: Trocar bubble de "Thinking..."**

De:
```tsx
<div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-2 text-sm text-gray-400 shadow-sm">
  Thinking...
</div>
```

Para:
```tsx
<div className="bg-brand-surface border border-brand-border rounded-2xl rounded-bl-sm px-4 py-2 text-xs text-brand-muted">
  Pensando...
</div>
```

- [ ] **Step 5: Trocar o banner de pending action**

De:
```tsx
<div className="flex-shrink-0 bg-amber-50 border-t border-amber-200 px-4 py-3">
  <p className="text-sm font-medium text-amber-800 mb-1">
  ...
  <pre className="text-xs text-amber-700 bg-amber-100 rounded p-2 mb-2 overflow-x-auto">
  ...
  <button ... className="px-3 py-1.5 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg ...">
    Confirm
  </button>
  <button ... className="px-3 py-1.5 text-sm font-medium bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg ...">
    Cancel
  </button>
```

Para:
```tsx
<div className="flex-shrink-0 bg-brand-surface border-t border-brand-green/30 px-4 py-3">
  <p className="text-xs font-semibold text-brand-green mb-1">
    O agente quer executar:{' '}
    <span className="font-bold">{pendingAction.name ?? 'ação desconhecida'}</span>
  </p>
  {pendingAction.args && (
    <pre className="text-[10px] text-gray-300 bg-brand-mid rounded p-2 mb-2 overflow-x-auto border border-brand-border">
      {JSON.stringify(pendingAction.args, null, 2)}
    </pre>
  )}
  <div className="flex gap-2">
    <button
      onClick={handleConfirm}
      disabled={loading}
      className="px-3 py-1.5 text-xs font-bold bg-brand-green text-brand-black rounded-lg disabled:opacity-40 hover:brightness-110 transition-all cursor-pointer"
    >
      Confirmar
    </button>
    <button
      onClick={handleCancel}
      disabled={loading}
      className="px-3 py-1.5 text-xs font-medium bg-transparent text-brand-muted border border-brand-border rounded-lg disabled:opacity-40 hover:text-white hover:border-white transition-colors cursor-pointer"
    >
      Cancelar
    </button>
  </div>
</div>
```

- [ ] **Step 6: Trocar a área de input**

De:
```tsx
<div className="flex-shrink-0 border-t border-gray-200 bg-white p-3 flex gap-2 items-end">
  <textarea ... className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 leading-5" .../>
  <button ... className="flex-shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors">
    Send
  </button>
</div>
```

Para:
```tsx
<div className="flex-shrink-0 border-t border-brand-border bg-brand-surface p-3 flex gap-2 items-end">
  <textarea
    value={input}
    onChange={e => setInput(e.target.value)}
    onKeyDown={handleKeyDown}
    disabled={loading}
    placeholder="Digite uma mensagem… (Enter para enviar, Shift+Enter para nova linha)"
    rows={1}
    className="flex-1 resize-none rounded-xl bg-brand-mid border border-brand-border px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-green disabled:opacity-50 leading-5 placeholder:text-brand-muted"
    style={{ maxHeight: '120px', overflowY: 'auto' }}
  />
  <button
    onClick={handleSend}
    disabled={loading || !input.trim()}
    className="flex-shrink-0 px-4 py-2 bg-brand-green hover:brightness-110 text-brand-black text-xs font-bold rounded-xl disabled:opacity-40 transition-all cursor-pointer"
  >
    Enviar
  </button>
</div>
```

- [ ] **Step 7: Verificar build**

```powershell
cd frontend
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npx next build
```

- [ ] **Step 8: Commit**

```bash
git add frontend/components/AgentChat.tsx
git commit -m "feat: AgentChat dark theme"
```

---

## Task 10: Ticket detail page dark (`/tickets/[id]`)

**Arquivo:**
- Modificar: `frontend/app/tickets/[id]/page.tsx`

- [ ] **Step 1: Substituir o arquivo completo**

```tsx
import Link from 'next/link'
import { getTicket, getAuditLog } from '@/lib/api'
import { TriageBadge } from '@/components/TriageBadge'
import { TicketDetailPanel } from '@/components/TicketDetailPanel'
import { CustomerSegment, TicketStatus } from '@/types'

function segmentColor(segment: CustomerSegment | null) {
  switch (segment) {
    case 'ENT': return 'bg-violet-500/20 text-violet-300'
    case 'MID': return 'bg-blue-500/20 text-blue-300'
    case 'SMB': return 'bg-brand-mid text-brand-muted'
    default:    return 'bg-brand-mid text-brand-muted'
  }
}

function statusColor(status: TicketStatus) {
  switch (status) {
    case 'NEW':              return 'bg-blue-500/15 text-blue-300'
    case 'TRIAGED':          return 'bg-yellow-500/15 text-yellow-300'
    case 'IN_PROGRESS':      return 'bg-orange-500/15 text-orange-300'
    case 'WAITING_CUSTOMER': return 'bg-purple-500/15 text-purple-300'
    case 'RESOLVED':         return 'bg-brand-success/15 text-green-300'
    case 'CLOSED':           return 'bg-brand-mid text-brand-muted'
    case 'ESCALATED':        return 'bg-brand-error/15 text-red-300'
    case 'REOPENED':         return 'bg-pink-500/15 text-pink-300'
    default:                 return 'bg-brand-mid text-brand-muted'
  }
}

function riskColor(score: number) {
  if (score < 30) return 'text-brand-success'
  if (score <= 70) return 'text-yellow-400'
  return 'text-brand-error'
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [ticket, auditEvents] = await Promise.all([getTicket(id), getAuditLog(id)])

  return (
    <div className="min-h-screen bg-brand-black p-6">
      <Link
        href="/inbox"
        className="text-xs text-brand-green hover:brightness-125 transition-all mb-4 inline-block"
      >
        ← Voltar ao Inbox
      </Link>

      <div className="flex gap-5 mt-2">
        {/* ── Left: Customer context ── */}
        <aside className="w-1/4 bg-brand-surface border border-brand-border rounded-xl p-4 self-start">
          <h2 className="text-base font-bold text-white mb-1">
            {ticket.customer_name ?? '—'}
          </h2>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${segmentColor(ticket.customer_segment)}`}>
            {ticket.customer_segment ?? 'Unknown'}
          </span>

          <dl className="mt-3 space-y-2 text-xs">
            <div>
              <dt className="text-[9px] text-brand-muted uppercase tracking-wide">Plano</dt>
              <dd className="text-white mt-0.5">{ticket.plan ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[9px] text-brand-muted uppercase tracking-wide">Canal</dt>
              <dd className="text-white mt-0.5">{ticket.channel ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[9px] text-brand-muted uppercase tracking-wide">Tickets abertos anteriores</dt>
              <dd className="text-white mt-0.5">{ticket.previous_open_tickets_for_customer}</dd>
            </div>
            <div>
              <dt className="text-[9px] text-brand-muted uppercase tracking-wide">Risk Score</dt>
              <dd className={`font-bold mt-0.5 ${riskColor(ticket.risk_score)}`}>
                {ticket.risk_score}
              </dd>
            </div>
          </dl>

          {ticket.triage_flags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {ticket.triage_flags.map((flag) => (
                <TriageBadge key={flag} flag={flag} />
              ))}
            </div>
          )}
        </aside>

        {/* ── Middle: Ticket body ── */}
        <section className="w-1/2 bg-brand-surface border border-brand-border rounded-xl p-4 self-start">
          <div className="flex items-start gap-3 mb-3">
            <h1 className="text-lg font-bold text-white flex-1">
              {ticket.subject ?? '(sem assunto)'}
            </h1>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${statusColor(ticket.status)}`}>
              {ticket.status}
            </span>
          </div>

          <dl className="text-[10px] text-brand-muted space-y-0.5 mb-4">
            <div>
              <span>Criado: </span>
              <span className="text-gray-400">
                {ticket.created_at ? new Date(ticket.created_at).toLocaleString('pt-BR') : '—'}
              </span>
            </div>
            <div>
              <span>Última resposta: </span>
              <span className="text-gray-400">
                {ticket.last_reply_at
                  ? new Date(ticket.last_reply_at).toLocaleString('pt-BR')
                  : '—'}
              </span>
            </div>
            <div>
              <span>Respostas: </span>
              <span className="text-gray-400">{ticket.reply_count}</span>
            </div>
          </dl>

          <div className="bg-brand-black border border-brand-border rounded-lg p-3 text-xs text-gray-300 whitespace-pre-wrap leading-relaxed font-mono">
            {ticket.body_preview ?? '(sem conteúdo)'}
          </div>
        </section>

        {/* ── Right: Actions + Audit Log ── */}
        <div className="w-1/4 bg-brand-surface border border-brand-border rounded-xl p-4 self-start">
          <TicketDetailPanel initialTicket={ticket} auditEvents={auditEvents} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar build**

```powershell
cd frontend
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npx next build
```

Esperado: `✓ Compiled successfully`.

- [ ] **Step 3: Commit + push**

```bash
git add frontend/app/tickets/[id]/page.tsx
git commit -m "feat: ticket detail page dark theme"
git push origin master
```

---

## Verificação final

Após todos os commits, abra `http://localhost:3000` com o dev server rodando e verifique:

- [ ] Sidebar visível com ícones, navegação entre Inbox e Agente IA
- [ ] Kanban: fundo preto, colunas em `#1A1A1A`, cards dark com bordas coloridas
- [ ] Side panel abre ao clicar num card, tema dark, tabs funcionam
- [ ] Formulários em ActionButtons com inputs dark
- [ ] Chat do agente dark, mensagens do usuário em verde ácido
- [ ] Detalhe do ticket dark (acessar `/tickets/[qualquer-id]`)
- [ ] `npx next build` passa sem erros TypeScript
