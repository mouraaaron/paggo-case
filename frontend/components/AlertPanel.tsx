'use client'

import { useState, useEffect, useRef } from 'react'
import { Ticket } from '@/types'
import { getTickets, getWeeklyStats, getAgentStats } from '@/lib/api'
import type { WeeklyStat, AgentStat } from '@/lib/api'

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function flagLabel(flags: string[]): string {
  if (flags.includes('CHURN_UNASSIGNED')) return 'CHURN · SEM AGENTE'
  if (flags.includes('ENT_NO_REPLY_2H')) return 'ENT · SEM REPLY'
  if (flags.includes('CHURN_SIGNAL')) return 'CHURN · COM AGENTE'
  if (flags.includes('MID_NO_REPLY_2H')) return 'MID · SEM REPLY'
  if (flags.includes('MULTIPLE_OPEN')) return 'MÚLTIPLOS ABERTOS'
  if (flags.includes('STALE_IN_PROGRESS')) return 'PARADO'
  return 'RISCO ALTO'
}

// --- AlertsSidebar: right sidebar, alerts list only ---

interface AlertsSidebarProps {
  onTicketClick: (ticket: Ticket) => void
  createdAfter?: string
  createdBefore?: string
}

export function AlertsSidebar({ onTicketClick, createdAfter, createdBefore }: AlertsSidebarProps) {
  const [urgentTickets, setUrgentTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(false)
      try {
        const tickets = await getTickets({
          sort_by: 'risk_score',
          sort_desc: true,
          limit: 100,
          created_after: createdAfter,
          created_before: createdBefore,
        })
        if (cancelled) return
        setUrgentTickets(
          tickets.filter(t => t.risk_score >= 70 && t.status !== 'CLOSED' && t.status !== 'RESOLVED')
        )
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [createdAfter, createdBefore])

  return (
    <div className="flex flex-col h-full bg-brand-black">
      <div className="px-3 py-2 border-b border-brand-border shrink-0">
        <span className="text-[10px] font-bold text-brand-green uppercase tracking-wider">
          ⚡ Alertas{urgentTickets.length > 0 ? ` (${urgentTickets.length})` : ''}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-brand-muted text-center py-6">Carregando...</p>
        ) : error ? (
          <p className="text-xs text-brand-error text-center py-6">Erro ao carregar</p>
        ) : urgentTickets.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-2">
            <span className="text-brand-green text-2xl">✓</span>
            <p className="text-xs text-brand-muted text-center">Nenhum ticket crítico</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-3">
            {urgentTickets.map(t => (
              <button
                key={t.ticket_id}
                onClick={() => onTicketClick(t)}
                className={`w-full text-left rounded-lg p-3 cursor-pointer transition-colors hover:brightness-110 ${
                  t.risk_score >= 80
                    ? 'bg-red-500/10 border border-red-500'
                    : 'bg-red-500/8 border border-dashed border-red-500/60'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[9px] font-bold text-red-400 uppercase tracking-wide">
                    {flagLabel(t.triage_flags)}
                  </span>
                  <span className="text-[10px] font-bold text-red-400">{t.risk_score}</span>
                </div>
                <p className="text-[11px] text-white line-clamp-1 mb-1">{t.subject}</p>
                <div className="flex justify-between">
                  <span className="text-[9px] text-brand-muted">
                    {t.customer_segment} · #{t.ticket_id.slice(-5)}
                  </span>
                  <span className="text-[9px] text-red-400">
                    {timeAgo(t.created_at)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// --- TrendsChart: SVG bar chart used by StatsBottomBar ---

function TrendsChart({ stats }: { stats: WeeklyStat[] }) {
  if (stats.length === 0) return <p className="text-xs text-brand-muted text-center py-2">Sem dados</p>

  const maxTotal = Math.max(...stats.map(s => s.total), 1)
  const chartH = 80
  const barW = 6
  const gap = 2

  const thisWeek = stats[stats.length - 1]
  const lastWeek = stats[stats.length - 2]
  const weekChange = lastWeek && lastWeek.total > 0
    ? Math.round(((thisWeek?.total ?? 0) - lastWeek.total) / lastWeek.total * 100)
    : 0
  const peakTotal = Math.max(...stats.map(s => s.total))

  return (
    <div className="flex gap-6 items-start pt-1">
      <svg
        height={chartH}
        viewBox={`0 0 ${stats.length * (barW + gap)} ${chartH}`}
        preserveAspectRatio="none"
        className="flex-1 min-w-0"
      >
        {stats.map((s, i) => {
          const h = Math.max(2, Math.round((s.total / maxTotal) * (chartH - 4)))
          return (
            <rect
              key={s.week}
              x={i * (barW + gap)}
              y={chartH - h}
              width={barW}
              height={h}
              fill="#C8FF0050"
              rx={1}
            />
          )
        })}
      </svg>
      <div className="flex flex-col gap-3 shrink-0 min-w-[120px]">
        <div>
          <p className="text-brand-green text-base font-bold">{peakTotal}</p>
          <p className="text-[9px] text-brand-muted">pico/semana</p>
        </div>
        <div>
          <p className={`text-base font-bold ${weekChange > 0 ? 'text-brand-error' : 'text-brand-success'}`}>
            {weekChange > 0 ? '+' : ''}{weekChange}%
          </p>
          <p className="text-[9px] text-brand-muted">vs semana anterior</p>
        </div>
        <div>
          <p className="text-brand-error text-base font-bold">{thisWeek?.urgent ?? 0}</p>
          <p className="text-[9px] text-brand-muted">URGENT esta semana</p>
        </div>
      </div>
    </div>
  )
}

// --- StatsBottomBar: horizontal section below kanban with Agentes + Tendências ---

interface StatsBottomBarProps {
  createdAfter?: string
  createdBefore?: string
  refreshKey?: number
}

export function StatsBottomBar({ createdAfter, createdBefore, refreshKey }: StatsBottomBarProps) {
  const [agentStats, setAgentStats] = useState<AgentStat[]>([])
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStat[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const hasData = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      // First load: show full loading screen. Subsequent re-fetches: keep data, show subtle spinner.
      if (!hasData.current) {
        setInitialLoading(true)
      } else {
        setRefreshing(true)
      }
      setError(false)
      try {
        const [agents, weekly] = await Promise.all([
          getAgentStats({ createdAfter, createdBefore }),
          getWeeklyStats(),
        ])
        if (cancelled) return
        setAgentStats(agents)
        setWeeklyStats(weekly)
        hasData.current = true
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) {
          setInitialLoading(false)
          setRefreshing(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [createdAfter, createdBefore, refreshKey])

  if (initialLoading) {
    return (
      <div className="border-t border-brand-border py-10 flex items-center justify-center">
        <p className="text-xs text-brand-muted">Carregando estatísticas...</p>
      </div>
    )
  }

  if (error && !hasData.current) {
    return (
      <div className="border-t border-brand-border py-10 flex items-center justify-center">
        <p className="text-xs text-brand-error">Erro ao carregar estatísticas</p>
      </div>
    )
  }

  return (
    <div className="border-t border-brand-border flex">
      {/* Agentes */}
      <div className="flex-1 border-r border-brand-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <p className="text-[10px] text-brand-muted uppercase tracking-wider font-semibold">
            Balanceamento de agentes
          </p>
          {refreshing && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
          )}
        </div>
        {agentStats.length === 0 ? (
          <p className="text-xs text-brand-muted py-4">Sem dados para o período selecionado</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[9px] uppercase border-b border-brand-border">
                <th className="text-left pb-2 font-semibold text-brand-muted">Agente</th>
                <th className="text-center pb-2 font-semibold text-red-400">URGENT</th>
                <th className="text-center pb-2 font-semibold text-orange-400">HIGH</th>
                <th className="text-center pb-2 font-semibold text-brand-muted">MEDIUM</th>
                <th className="text-center pb-2 font-semibold text-[#555555]">LOW</th>
                <th className="text-right pb-2 font-semibold text-white">Total</th>
              </tr>
            </thead>
            <tbody>
              {agentStats.map(a => {
                const overloaded = a.total >= 15 || a.urgent >= 3
                return (
                  <tr
                    key={a.agent}
                    className={`border-b border-brand-border last:border-0 ${overloaded ? 'bg-red-500/5' : ''}`}
                  >
                    <td className="py-2 text-white font-medium">{a.agent}</td>
                    <td className={`py-2 text-center ${a.urgent > 0 ? 'text-red-400 font-bold' : 'text-brand-border'}`}>
                      {a.urgent || '—'}
                    </td>
                    <td className={`py-2 text-center ${a.high > 0 ? 'text-orange-400' : 'text-brand-border'}`}>
                      {a.high || '—'}
                    </td>
                    <td className="py-2 text-center text-brand-muted">{a.medium || '—'}</td>
                    <td className="py-2 text-center text-[#555555]">{a.low || '—'}</td>
                    <td className={`py-2 text-right font-bold ${overloaded ? 'text-red-400' : 'text-white'}`}>
                      {a.total}{overloaded ? ' ⚠' : ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Tendências */}
      <div className="flex-1 p-5">
        <p className="text-[10px] text-brand-muted uppercase tracking-wider mb-4 font-semibold">
          Tendências de volume semanal
        </p>
        <TrendsChart stats={weeklyStats} />
      </div>
    </div>
  )
}
