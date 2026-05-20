'use client'

import { useState, useEffect } from 'react'
import { Ticket } from '@/types'
import { getTickets, getWeeklyStats, getAgentStats } from '@/lib/api'
import type { WeeklyStat, AgentStat } from '@/lib/api'

interface AlertPanelProps {
  onTicketClick: (ticket: Ticket) => void
}

type Tab = 'alerts' | 'agents' | 'trends'

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

function TrendsChart({ stats }: { stats: WeeklyStat[] }) {
  if (stats.length === 0) return <p className="text-xs text-brand-muted text-center py-4">Sem dados</p>

  const maxTotal = Math.max(...stats.map(s => s.total), 1)
  const chartH = 72
  const barW = 6
  const gap = 2

  const thisWeek = stats[stats.length - 1]
  const lastWeek = stats[stats.length - 2]
  const weekChange = lastWeek && lastWeek.total > 0
    ? Math.round(((thisWeek?.total ?? 0) - lastWeek.total) / lastWeek.total * 100)
    : 0
  const peakTotal = Math.max(...stats.map(s => s.total))

  return (
    <div>
      <svg
        width="100%"
        height={chartH}
        viewBox={`0 0 ${stats.length * (barW + gap)} ${chartH}`}
        preserveAspectRatio="none"
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
      <div className="flex justify-between text-[8px] text-brand-muted mt-1 mb-3">
        <span>{stats[0]?.week}</span>
        <span>{stats[stats.length - 1]?.week}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        <div>
          <p className="text-brand-green text-sm font-bold">{peakTotal}</p>
          <p className="text-[9px] text-brand-muted">pico/semana</p>
        </div>
        <div>
          <p className={`text-sm font-bold ${weekChange > 0 ? 'text-brand-error' : 'text-brand-success'}`}>
            {weekChange > 0 ? '+' : ''}{weekChange}%
          </p>
          <p className="text-[9px] text-brand-muted">vs anterior</p>
        </div>
        <div>
          <p className="text-brand-error text-sm font-bold">{thisWeek?.urgent ?? 0}</p>
          <p className="text-[9px] text-brand-muted">URGENT/sem.</p>
        </div>
      </div>
    </div>
  )
}

export function AlertPanel({ onTicketClick }: AlertPanelProps) {
  const [tab, setTab] = useState<Tab>('alerts')
  const [urgentTickets, setUrgentTickets] = useState<Ticket[]>([])
  const [agentStats, setAgentStats] = useState<AgentStat[]>([])
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [tickets, agents, weekly] = await Promise.all([
        getTickets({ sort_by: 'risk_score', sort_desc: true, limit: 100 }),
        getAgentStats(),
        getWeeklyStats(),
      ])
      if (cancelled) return
      setUrgentTickets(
        tickets.filter(t => t.risk_score >= 70 && t.status !== 'CLOSED' && t.status !== 'RESOLVED')
      )
      setAgentStats(agents)
      setWeeklyStats(weekly)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const tabClass = (t: Tab) =>
    `flex-1 py-2 text-[10px] font-bold text-center cursor-pointer transition-colors ${
      tab === t
        ? 'border-b-2 border-brand-green text-brand-green'
        : 'text-brand-muted hover:text-white border-b border-brand-border'
    }`

  return (
    <div className="flex flex-col h-full bg-brand-black">
      {/* Tab bar */}
      <div className="flex shrink-0">
        <button className={tabClass('alerts')} onClick={() => setTab('alerts')}>
          ⚡ Alertas{urgentTickets.length > 0 ? ` ${urgentTickets.length}` : ''}
        </button>
        <button className={tabClass('agents')} onClick={() => setTab('agents')}>
          Agentes
        </button>
        <button className={tabClass('trends')} onClick={() => setTab('trends')}>
          Tendências
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-brand-muted text-center py-6">Carregando...</p>
        ) : (
          <>
            {/* Tab: Alertas */}
            {tab === 'alerts' && (
              <div className="flex flex-col gap-2 p-3">
                {urgentTickets.length === 0 ? (
                  <div className="flex flex-col items-center py-8 gap-2">
                    <span className="text-brand-green text-2xl">✓</span>
                    <p className="text-xs text-brand-muted text-center">Nenhum ticket crítico no momento</p>
                  </div>
                ) : (
                  urgentTickets.map(t => (
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
                  ))
                )}
              </div>
            )}

            {/* Tab: Agentes */}
            {tab === 'agents' && (
              <div className="p-3">
                <p className="text-[9px] text-brand-muted uppercase tracking-wider mb-3">
                  Tickets abertos por agente
                </p>
                {agentStats.length === 0 ? (
                  <p className="text-xs text-brand-muted text-center py-4">Sem dados</p>
                ) : (
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="text-brand-muted text-[9px] uppercase">
                        <th className="text-left pb-2 font-semibold">Agente</th>
                        <th className="text-center pb-2 font-semibold text-red-400">URG</th>
                        <th className="text-center pb-2 font-semibold text-orange-400">HI</th>
                        <th className="text-center pb-2 font-semibold text-brand-muted">MED</th>
                        <th className="text-right pb-2 font-semibold text-white">Tot</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentStats.map(a => {
                        const overloaded = a.total >= 15 || a.urgent >= 3
                        return (
                          <tr
                            key={a.agent}
                            className={`border-t border-brand-border ${overloaded ? 'bg-red-500/5' : ''}`}
                          >
                            <td className="py-1.5 text-brand-muted truncate max-w-[80px]">
                              {a.agent.split(' ')[0]}
                            </td>
                            <td className={`py-1.5 text-center ${a.urgent > 0 ? 'text-red-400 font-bold' : 'text-brand-border'}`}>
                              {a.urgent || '—'}
                            </td>
                            <td className={`py-1.5 text-center ${a.high > 0 ? 'text-orange-400' : 'text-brand-border'}`}>
                              {a.high || '—'}
                            </td>
                            <td className="py-1.5 text-center text-brand-muted">{a.medium || '—'}</td>
                            <td className={`py-1.5 text-right font-bold ${overloaded ? 'text-red-400' : 'text-white'}`}>
                              {a.total}{overloaded ? ' ⚠' : ''}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Tab: Tendências */}
            {tab === 'trends' && (
              <div className="p-3">
                <p className="text-[9px] text-brand-muted uppercase tracking-wider mb-3">
                  Volume semanal
                </p>
                <TrendsChart stats={weeklyStats} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
