'use client'

import type { MorningBriefingData } from '@/lib/api'

const SEGMENT_COLORS: Record<string, string> = {
  ENT: '#C8FF00',
  MID: '#FB923C',
  SMB: '#60A5FA',
}

interface MorningBriefingModalProps {
  data: MorningBriefingData | null
  onClose: () => void
}

export function MorningBriefingModal({ data, onClose }: MorningBriefingModalProps) {
  if (!data) return null

  const { unassigned_urgent, overloaded_agents } = data.team_status

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative bg-brand-black border border-brand-border rounded-xl w-full max-w-lg mx-4 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 text-brand-muted hover:text-white transition-colors cursor-pointer text-lg leading-none"
        >
          ✕
        </button>

        {/* Header */}
        <div className="mb-5 pr-6">
          <p className="text-[10px] text-brand-green uppercase tracking-wider font-bold mb-1">
            Morning Briefing
          </p>
          <p className="text-sm text-brand-muted">{data.period_label}</p>
        </div>

        {/* Narrative */}
        {data.narrative && (
          <p className="text-sm text-white mb-5 leading-relaxed">{data.narrative}</p>
        )}

        {/* New Tickets */}
        <div className="mb-5">
          <p className="text-[10px] text-brand-muted uppercase tracking-wider mb-3 font-semibold">
            Novos tickets
          </p>
          <div className="flex items-end gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-white leading-none">{data.new_tickets.total}</p>
              <p className="text-[9px] text-brand-muted uppercase mt-1">Total</p>
            </div>
            {(['ENT', 'MID', 'SMB'] as const).map(seg => (
              <div key={seg} className="text-center">
                <p className="text-xl font-bold leading-none" style={{ color: SEGMENT_COLORS[seg] }}>
                  {data.new_tickets[seg]}
                </p>
                <p className="text-[9px] text-brand-muted uppercase mt-1">{seg}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Team Status */}
        <div className="mb-5">
          <p className="text-[10px] text-brand-muted uppercase tracking-wider mb-3 font-semibold">
            Status da equipe
          </p>
          {unassigned_urgent === 0 && overloaded_agents.length === 0 ? (
            <p className="text-sm text-brand-green">Equipe balanceada ✓</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {unassigned_urgent > 0 && (
                <p className="text-sm text-red-400">
                  <strong>{unassigned_urgent}</strong> urgente{unassigned_urgent !== 1 ? 's' : ''} sem responsável
                </p>
              )}
              {overloaded_agents.length > 0 && (
                <p className="text-sm text-orange-400">
                  Sobrecarregados: {overloaded_agents.join(', ')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Next Steps */}
        {data.next_steps.length > 0 && (
          <div>
            <p className="text-[10px] text-brand-muted uppercase tracking-wider mb-3 font-semibold">
              Próximos passos
            </p>
            <ul className="flex flex-col gap-2.5">
              {data.next_steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-white">
                  <span className="text-brand-green mt-0.5 shrink-0 font-bold">→</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
