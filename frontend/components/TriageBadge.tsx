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
