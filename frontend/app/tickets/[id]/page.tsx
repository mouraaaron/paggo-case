import Link from 'next/link'
import { getTicket, getAuditLog } from '@/lib/api'
import { TriageBadge } from '@/components/TriageBadge'
import { TicketDetailPanel } from '@/components/TicketDetailPanel'
import { CustomerSegment, TicketStatus } from '@/types'

function segmentColor(segment: CustomerSegment | null) {
  switch (segment) {
    case 'ENT': return 'bg-violet-500/20 text-violet-300'
    case 'MID': return 'bg-blue-500/20 text-blue-300'
    case 'SMB': return 'bg-brand-mid text-brand-muted'
    default:    return 'bg-brand-mid text-brand-muted'
  }
}

function statusColor(status: TicketStatus) {
  switch (status) {
    case 'NEW':              return 'bg-blue-500/15 text-blue-300'
    case 'TRIAGED':          return 'bg-yellow-500/15 text-yellow-300'
    case 'IN_PROGRESS':      return 'bg-orange-500/15 text-orange-300'
    case 'WAITING_CUSTOMER': return 'bg-purple-500/15 text-purple-300'
    case 'RESOLVED':         return 'bg-brand-success/15 text-green-300'
    case 'CLOSED':           return 'bg-brand-mid text-brand-muted'
    case 'ESCALATED':        return 'bg-brand-error/15 text-red-300'
    case 'REOPENED':         return 'bg-pink-500/15 text-pink-300'
    default:                 return 'bg-brand-mid text-brand-muted'
  }
}

function riskColor(score: number) {
  if (score < 30) return 'text-brand-success'
  if (score <= 70) return 'text-yellow-400'
  return 'text-brand-error'
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [ticket, auditEvents] = await Promise.all([getTicket(id), getAuditLog(id)])

  return (
    <div className="min-h-screen bg-brand-black p-6">
      <Link
        href="/inbox"
        className="text-xs text-brand-green hover:brightness-125 transition-all mb-4 inline-block"
      >
        ← Voltar ao Inbox
      </Link>

      <div className="flex gap-5 mt-2">
        {/* ── Left: Customer context ── */}
        <aside className="w-1/4 bg-brand-surface border border-brand-border rounded-xl p-4 self-start">
          <h2 className="text-base font-bold text-white mb-1">
            {ticket.customer_name ?? '—'}
          </h2>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${segmentColor(ticket.customer_segment)}`}>
            {ticket.customer_segment ?? 'Unknown'}
          </span>

          <dl className="mt-3 space-y-2 text-xs">
            <div>
              <dt className="text-[9px] text-brand-muted uppercase tracking-wide">Plano</dt>
              <dd className="text-white mt-0.5">{ticket.plan ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[9px] text-brand-muted uppercase tracking-wide">Canal</dt>
              <dd className="text-white mt-0.5">{ticket.channel ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[9px] text-brand-muted uppercase tracking-wide">Tickets abertos anteriores</dt>
              <dd className="text-white mt-0.5">{ticket.previous_open_tickets_for_customer}</dd>
            </div>
            <div>
              <dt className="text-[9px] text-brand-muted uppercase tracking-wide">Risk Score</dt>
              <dd className={`font-bold mt-0.5 ${riskColor(ticket.risk_score)}`}>
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

        {/* ── Middle: Ticket body ── */}
        <section className="w-1/2 bg-brand-surface border border-brand-border rounded-xl p-4 self-start">
          <div className="flex items-start gap-3 mb-3">
            <h1 className="text-lg font-bold text-white flex-1">
              {ticket.subject ?? '(sem assunto)'}
            </h1>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${statusColor(ticket.status)}`}>
              {ticket.status}
            </span>
          </div>

          <dl className="text-[10px] text-brand-muted space-y-0.5 mb-4">
            <div>
              <span>Criado: </span>
              <span className="text-gray-400">
                {ticket.created_at ? new Date(ticket.created_at).toLocaleString('pt-BR') : '—'}
              </span>
            </div>
            <div>
              <span>Última resposta: </span>
              <span className="text-gray-400">
                {ticket.last_reply_at
                  ? new Date(ticket.last_reply_at).toLocaleString('pt-BR')
                  : '—'}
              </span>
            </div>
            <div>
              <span>Respostas: </span>
              <span className="text-gray-400">{ticket.reply_count}</span>
            </div>
          </dl>

          <div className="bg-brand-black border border-brand-border rounded-lg p-3 text-xs text-gray-300 whitespace-pre-wrap leading-relaxed font-mono">
            {ticket.body_preview ?? '(sem conteúdo)'}
          </div>
        </section>

        {/* ── Right: Actions + Audit Log ── */}
        <div className="w-1/4 bg-brand-surface border border-brand-border rounded-xl p-4 self-start">
          <TicketDetailPanel initialTicket={ticket} auditEvents={auditEvents} />
        </div>
      </div>
    </div>
  )
}
