import { TriageFlag } from '@/types'

const FLAG_CONFIG: Record<TriageFlag, { label: string; color: string }> = {
  CHURN_SIGNAL:      { label: 'Churn', color: 'bg-red-600 text-white' },
  SLA_BREACH:        { label: 'SLA', color: 'bg-orange-500 text-white' },
  URGENT_UNATTENDED: { label: 'Urgente', color: 'bg-yellow-500 text-black' },
  MULTIPLE_OPEN:     { label: '3+ tickets', color: 'bg-purple-500 text-white' },
  STALE_IN_PROGRESS: { label: 'Parado', color: 'bg-gray-500 text-white' },
}

export function TriageBadge({ flag }: { flag: TriageFlag }) {
  const config = FLAG_CONFIG[flag]
  if (!config) return null
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.color}`}>
      {config.label}
    </span>
  )
}
