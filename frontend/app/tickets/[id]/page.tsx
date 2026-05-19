import Link from 'next/link'
import { getTicket, getAuditLog } from '@/lib/api'
import { TriageBadge } from '@/components/TriageBadge'
import { TicketDetailPanel } from '@/components/TicketDetailPanel'
import { CustomerSegment, TicketStatus } from '@/types'

// ---- helpers ---------------------------------------------------------------

function segmentColor(segment: CustomerSegment | null) {
  switch (segment) {
    case 'ENT':
      return 'bg-indigo-100 text-indigo-700'
    case 'MID':
      return 'bg-blue-100 text-blue-700'
    case 'SMB':
      return 'bg-gray-100 text-gray-700'
    default:
      return 'bg-gray-100 text-gray-500'
  }
}

function statusColor(status: TicketStatus) {
  switch (status) {
    case 'NEW':
      return 'bg-blue-100 text-blue-700'
    case 'TRIAGED':
      return 'bg-yellow-100 text-yellow-700'
    case 'IN_PROGRESS':
      return 'bg-orange-100 text-orange-700'
    case 'WAITING_CUSTOMER':
      return 'bg-purple-100 text-purple-700'
    case 'RESOLVED':
      return 'bg-green-100 text-green-700'
    case 'CLOSED':
      return 'bg-gray-200 text-gray-600'
    case 'ESCALATED':
      return 'bg-red-100 text-red-700'
    case 'REOPENED':
      return 'bg-pink-100 text-pink-700'
    default:
      return 'bg-gray-100 text-gray-500'
  }
}

function riskColor(score: number) {
  if (score < 30) return 'text-green-600'
  if (score <= 70) return 'text-yellow-600'
  return 'text-red-600'
}

// ---- page ------------------------------------------------------------------

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [ticket, auditEvents] = await Promise.all([getTicket(id), getAuditLog(id)])

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      {/* Back link */}
      <Link href="/inbox" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
        ← Back to Inbox
      </Link>

      <div className="flex gap-6 mt-2">
        {/* ---- Left column (1/4): Customer context ---- */}
        <aside className="w-1/4 bg-white border border-gray-200 rounded-lg p-4 self-start">
          <h2 className="text-lg font-bold text-gray-900 mb-1">
            {ticket.customer_name ?? '—'}
          </h2>

          {/* Segment badge */}
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${segmentColor(
              ticket.customer_segment
            )}`}
          >
            {ticket.customer_segment ?? 'Unknown'}
          </span>

          <dl className="mt-3 space-y-1.5 text-sm">
            <div>
              <dt className="text-gray-400 text-xs">Plan</dt>
              <dd className="text-gray-800">{ticket.plan ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-400 text-xs">Channel</dt>
              <dd className="text-gray-800">{ticket.channel ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-400 text-xs">Previous open tickets</dt>
              <dd className="text-gray-800">{ticket.previous_open_tickets_for_customer}</dd>
            </div>
            <div>
              <dt className="text-gray-400 text-xs">Risk score</dt>
              <dd className={`font-semibold ${riskColor(ticket.risk_score)}`}>
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

        {/* ---- Middle column (1/2): Ticket body ---- */}
        <section className="w-1/2 bg-white border border-gray-200 rounded-lg p-4 self-start">
          <div className="flex items-start gap-3 mb-3">
            <h1 className="text-xl font-bold text-gray-900 flex-1">
              {ticket.subject ?? '(no subject)'}
            </h1>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${statusColor(
                ticket.status
              )}`}
            >
              {ticket.status}
            </span>
          </div>

          <dl className="text-xs text-gray-400 space-y-0.5 mb-4">
            <div>
              <span>Created: </span>
              <span className="text-gray-600">
                {ticket.created_at ? new Date(ticket.created_at).toLocaleString() : '—'}
              </span>
            </div>
            <div>
              <span>Last reply: </span>
              <span className="text-gray-600">
                {ticket.last_reply_at
                  ? new Date(ticket.last_reply_at).toLocaleString()
                  : '—'}
              </span>
            </div>
            <div>
              <span>Replies: </span>
              <span className="text-gray-600">{ticket.reply_count}</span>
            </div>
          </dl>

          <pre className="bg-gray-50 border border-gray-100 rounded p-3 text-sm text-gray-700 whitespace-pre-wrap font-mono">
            {ticket.body_preview ?? '(no content)'}
          </pre>
        </section>

        {/* ---- Right column (1/4): Actions + Audit Log ---- */}
        <div className="w-1/4 bg-white border border-gray-200 rounded-lg p-4 self-start">
          <TicketDetailPanel initialTicket={ticket} auditEvents={auditEvents} />
        </div>
      </div>
    </main>
  )
}
