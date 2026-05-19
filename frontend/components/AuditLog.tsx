'use client'

import { AuditEvent } from '@/types'

export function AuditLog({ events }: { events: AuditEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-gray-500 italic">No audit events yet.</p>
  }

  return (
    <ol className="relative border-l border-gray-200 space-y-4 ml-3">
      {events.map((event) => (
        <li key={event.id} className="relative ml-4">
          {/* Timeline dot */}
          <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-gray-300" />

          <div className="flex items-center gap-2 flex-wrap">
            <time className="text-xs text-gray-400">
              {new Date(event.created_at).toLocaleString()}
            </time>
            <span className="text-xs font-medium text-gray-700">{event.actor}</span>
            {event.source === 'AGENT' ? (
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                AI
              </span>
            ) : (
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                User
              </span>
            )}
          </div>

          <p className="text-sm text-gray-800 mt-0.5">{event.action}</p>

          {(event.old_value || event.new_value) && (
            <p className="text-xs text-gray-400 mt-0.5">
              {event.old_value ?? '—'} → {event.new_value ?? '—'}
            </p>
          )}

          {event.reason && (
            <p className="text-xs italic text-gray-500 mt-0.5">{event.reason}</p>
          )}
        </li>
      ))}
    </ol>
  )
}
