import { TriageFlag } from '@/types'

const FLAG_CONFIG: Record<TriageFlag, { label: string; color: string }> = {
  CHURN_UNASSIGNED: { label: 'Churn s/ agente', color: 'bg-red-500/15 text-red-400 border border-red-500/20' },
  ENT_NO_REPLY_2H:  { label: 'ENT sem reply',   color: 'bg-orange-500/15 text-orange-400 border border-orange-500/20' },
  CHURN_SIGNAL:     { label: 'Churn',            color: 'bg-pink-500/15 text-pink-400 border border-pink-500/20' },
  MID_NO_REPLY_2H:  { label: 'MID sem reply',    color: 'bg-blue-500/15 text-blue-400 border border-blue-500/20' },
  MULTIPLE_OPEN:    { label: '3+ tickets',        color: 'bg-violet-500/15 text-violet-400 border border-violet-500/20' },
  STALE_IN_PROGRESS:{ label: 'Parado',            color: 'bg-brand-mid text-brand-muted border border-brand-border' },
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
