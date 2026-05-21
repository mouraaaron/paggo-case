'use client'

import { useState, useEffect, useRef } from 'react'
import { Ticket } from '@/types'
import { getTickets, getVolumeBySegment, getRiskBySegment, getAgentStats, getMorningBriefing, getFaqCount } from '@/lib/api'
import type { SegmentVolumeStat, SegmentRiskStat, AgentStat, MorningBriefingData, FaqCountData } from '@/lib/api'
import { MorningBriefingModal } from '@/components/MorningBriefingModal'

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export function flagLabel(flags: string[]): string {
  if (flags.includes('CHURN_UNASSIGNED')) return 'CHURN · SEM AGENTE'
  if (flags.includes('ENT_NO_REPLY_2H')) return 'ENT · SEM REPLY'
  if (flags.includes('CHURN_SIGNAL')) return 'CHURN · COM AGENTE'
  if (flags.includes('MID_NO_REPLY_2H')) return 'MID · SEM REPLY'
  if (flags.includes('MULTIPLE_OPEN')) return 'MÚLTIPLOS ABERTOS'
  if (flags.includes('STALE_IN_PROGRESS')) return 'PARADO'
  return 'RISCO ALTO'
}

function isValidBriefingRange(after?: string, before?: string): boolean {
  if (!after || !before) return false
  const diffDays = (new Date(before).getTime() - new Date(after).getTime()) / (1000 * 60 * 60 * 24)
  return diffDays <= 3
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

// --- shared segment color palette ---

const SEGMENT_COLORS: Record<string, string> = {
  ENT: '#C8FF00',
  MID: '#FB923C',
  SMB: '#60A5FA',
}

const ALL_SEGMENTS = ['ENT', 'MID', 'SMB']

// --- VolumeBySegmentChart ---

function VolumeBySegmentChart({ stats }: { stats: SegmentVolumeStat[] }) {
  const maxTotal = Math.max(...stats.map(s => s.total), 1)

  if (stats.length === 0 || stats.every(s => s.total === 0)) {
    return <p className="text-xs text-brand-muted text-center py-2">Sem dados</p>
  }

  return (
    <div className="flex flex-col gap-2.5">
      {ALL_SEGMENTS.map(seg => {
        const data = stats.find(s => s.segment === seg)
        const total = data?.total ?? 0
        const open = data?.open ?? 0
        const color = SEGMENT_COLORS[seg]
        const totalPct = total > 0 ? Math.max(3, (total / maxTotal) * 100) : 0
        const openPct = total > 0 ? (open / total) * 100 : 0

        return (
          <div key={seg} className="flex items-center gap-3">
            <span className="text-[10px] font-bold w-8 shrink-0" style={{ color: total > 0 ? color : '#555' }}>
              {seg}
            </span>
            <div className="flex-1 h-4 rounded-sm bg-brand-mid/50 overflow-hidden">
              {total > 0 && (
                <div className="flex h-full" style={{ width: `${totalPct}%` }}>
                  <div className="h-full" style={{ width: `${openPct}%`, backgroundColor: `${color}70` }} />
                  <div className="h-full flex-1" style={{ backgroundColor: `${color}20` }} />
                </div>
              )}
            </div>
            <span className="text-[10px] font-mono w-8 text-right shrink-0 text-white font-bold">
              {total || '—'}
            </span>
            <span className="text-[11px] font-semibold w-20 shrink-0 text-right" style={{ color: total > 0 ? color : 'transparent' }}>
              {total > 0 ? `${open} abertos` : ''}
            </span>
          </div>
        )
      })}
      <p className="text-[8px] text-brand-border pt-0.5">
        barra: <span style={{ color: '#C8FF0070' }}>■</span> abertos + <span style={{ color: '#C8FF0020' }}>■</span> fechados
      </p>
    </div>
  )
}

// --- RiskBySegmentChart ---

function riskColor(score: number): string {
  if (score >= 60) return '#FF5252'
  if (score >= 30) return '#FB923C'
  return '#C8FF00'
}

function RiskBySegmentChart({ stats }: { stats: SegmentRiskStat[] }) {
  const maxRisk = Math.max(...stats.map(s => s.avg_risk ?? 0), 1)

  if (stats.length === 0 || stats.every(s => s.avg_risk === null)) {
    return <p className="text-xs text-brand-muted text-center py-2">Sem dados</p>
  }

  return (
    <div className="flex flex-col gap-2.5">
      {ALL_SEGMENTS.map(seg => {
        const data = stats.find(s => s.segment === seg)
        const val = data?.avg_risk ?? null
        const pct = val !== null ? Math.max(3, (val / maxRisk) * 100) : 0
        const color = val !== null ? riskColor(val) : '#333'

        return (
          <div key={seg} className="flex items-center gap-3">
            <span className="text-[10px] font-bold w-8 shrink-0 text-brand-muted">
              {seg}
            </span>
            <div className="flex-1 h-4 rounded-sm bg-brand-mid/50 overflow-hidden">
              <div
                className="h-full rounded-sm"
                style={{
                  width: `${pct}%`,
                  backgroundColor: `${color}35`,
                  borderRight: val !== null ? `2px solid ${color}` : 'none',
                }}
              />
            </div>
            <span className="text-[10px] font-mono w-8 text-right shrink-0 font-bold" style={{ color: val !== null ? color : '#555' }}>
              {val !== null ? val.toFixed(1) : '—'}
            </span>
            <span className="text-[9px] text-brand-border w-12 shrink-0 text-right">
              n={data?.count ?? 0}
            </span>
          </div>
        )
      })}
      <p className="text-[8px] text-brand-border pt-0.5">
        <span className="text-brand-green">■</span> baixo · <span style={{ color: '#FB923C' }}>■</span> médio · <span className="text-brand-error">■</span> alto
      </p>
    </div>
  )
}

// --- StatsBottomBar: horizontal section below kanban with Agentes + Response Time ---

interface StatsBottomBarProps {
  createdAfter?: string
  createdBefore?: string
  refreshKey?: number
}

export function StatsBottomBar({ createdAfter, createdBefore, refreshKey }: StatsBottomBarProps) {
  const [agentStats, setAgentStats] = useState<AgentStat[]>([])
  const [volumeStats, setVolumeStats] = useState<SegmentVolumeStat[]>([])
  const [riskStats, setRiskStats] = useState<SegmentRiskStat[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const hasData = useRef(false)

  const [faqStats, setFaqStats] = useState<FaqCountData>({ faq_count: 0, total: 0, percentage: 0 })

  const [briefingData, setBriefingData] = useState<MorningBriefingData | null>(null)
  const [briefingOpen, setBriefingOpen] = useState(false)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [briefingError, setBriefingError] = useState(false)

  const canBriefing = isValidBriefingRange(createdAfter, createdBefore)

  useEffect(() => {
    setBriefingData(null)
    setBriefingError(false)
  }, [createdAfter, createdBefore])

  async function handleBriefingClick() {
    if (briefingData) {
      setBriefingOpen(true)
      return
    }
    if (!createdAfter || !createdBefore) return
    setBriefingLoading(true)
    setBriefingError(false)
    try {
      const data = await getMorningBriefing(createdAfter, createdBefore)
      setBriefingData(data)
      setBriefingOpen(true)
    } catch {
      setBriefingError(true)
    } finally {
      setBriefingLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!hasData.current) {
        setInitialLoading(true)
      } else {
        setRefreshing(true)
      }
      setError(false)
      try {
        const [agents, volume, risk, faq] = await Promise.all([
          getAgentStats({ createdAfter, createdBefore }),
          getVolumeBySegment({ createdAfter, createdBefore }),
          getRiskBySegment({ createdAfter, createdBefore }),
          getFaqCount({ createdAfter, createdBefore }),
        ])
        if (cancelled) return
        setAgentStats(agents)
        setVolumeStats(volume)
        setRiskStats(risk)
        setFaqStats(faq)
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
    <>
      <MorningBriefingModal
        data={briefingOpen ? briefingData : null}
        onClose={() => setBriefingOpen(false)}
      />
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

      {/* Volume por Segmento */}
      <div className="flex-1 border-r border-brand-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <p className="text-[10px] text-brand-muted uppercase tracking-wider font-semibold">
            Volume por segmento
          </p>
          {refreshing && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
          )}
        </div>
        <VolumeBySegmentChart stats={volumeStats} />

        <div className="mt-4 border-t border-brand-border/40 pt-4">
          {briefingError && (
            <p className="text-[10px] text-brand-error mb-2">Erro ao gerar briefing</p>
          )}
          <button
            onClick={handleBriefingClick}
            disabled={!canBriefing || briefingLoading}
            className={`w-full text-[11px] font-semibold py-2 px-3 rounded-md border transition-colors ${
              canBriefing && !briefingLoading
                ? 'border-brand-green text-brand-green hover:bg-brand-green/10 cursor-pointer'
                : 'border-brand-border text-brand-border cursor-not-allowed'
            }`}
          >
            {briefingLoading
              ? 'Gerando...'
              : briefingData
                ? 'Ver Morning Briefing'
                : canBriefing
                  ? 'Gerar Morning Briefing'
                  : 'Selecione até 3 dias'}
          </button>
        </div>
      </div>

      {/* Score de Risco por Segmento */}
      <div className="flex-1 border-r border-brand-border p-5">
        <p className="text-[10px] text-brand-muted uppercase tracking-wider mb-4 font-semibold">
          Score de risco médio por segmento
        </p>
        <RiskBySegmentChart stats={riskStats} />
      </div>

      {/* Tickets FAQ */}
      <div className="flex-1 p-5">
        <div className="flex items-center gap-2 mb-4">
          <p className="text-[10px] text-brand-muted uppercase tracking-wider font-semibold">
            Tickets FAQ
          </p>
          {refreshing && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
          )}
        </div>
        {faqStats.total === 0 ? (
          <p className="text-xs text-brand-muted py-4">Sem dados para o período selecionado</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <span className="text-3xl font-bold text-white">
                {faqStats.faq_count.toLocaleString('pt-BR')}
              </span>
              <span className="text-sm text-brand-muted ml-2">tickets</span>
            </div>
            <div>
              <span className="text-xl font-semibold text-brand-green">
                {faqStats.percentage.toFixed(1).replace('.', ',')}%
              </span>
              <span className="text-xs text-brand-muted ml-2">do total</span>
            </div>
            <p className="text-[9px] text-brand-border mt-1">
              perguntas simples sem necessidade de ação humana
            </p>
          </div>
        )}
      </div>
    </div>
    </>
  )
}
