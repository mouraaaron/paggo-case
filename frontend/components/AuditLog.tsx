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
