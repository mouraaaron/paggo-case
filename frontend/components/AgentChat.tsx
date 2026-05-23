'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { sendAgentMessage } from '@/lib/api'

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface PendingAction {
  name: string;
  args: Record<string, unknown>;
  tool_call_id: string;
}

interface HistoryEntry {
  role: string;
  content?: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
}

export default function AgentChat() {
  const CONFIRM_SIGNAL = ''; // backend ignores message when confirmed_action is set

  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [dateContext, setDateContext] = useState<{ created_after?: string; created_before?: string } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingAction])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('paggo_date_context')
      if (raw) setDateContext(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    const newMsg: DisplayMessage = { id: crypto.randomUUID(), role: 'user', content: text }
    setMessages(prev => [...prev, newMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await sendAgentMessage(text, history, null, dateContext)
      setHistory(res.updated_history as HistoryEntry[])
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: res.reply }])
      if (res.pending_action) {
        setPendingAction(res.pending_action as PendingAction)
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!pendingAction || loading) return
    setLoading(true)
    const actionToConfirm = pendingAction
    // Cleared optimistically before await; loading=true above prevents cancel race.
    setPendingAction(null)

    try {
      const res = await sendAgentMessage(CONFIRM_SIGNAL, history, actionToConfirm, dateContext)
      setHistory(res.updated_history as HistoryEntry[])
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: res.reply }])
      if (res.pending_action) {
        setPendingAction(res.pending_action as PendingAction)
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleCancel() {
    if (loading) return;
    setPendingAction(null)
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: 'Action cancelled.' }])
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-brand-surface border-b border-brand-border px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-white">Assistente de Triagem</h1>
          {dateContext?.created_after && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-green/10 border border-brand-green/30 text-brand-green">
              {dateContext.created_after} → {dateContext.created_before ?? '…'}
            </span>
          )}
        </div>
        <p className="text-xs text-brand-muted mt-0.5">Pergunte sobre tickets, atribuições, status e classificações.</p>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-brand-black">
        {messages.length === 0 && (
          <p className="text-center text-brand-muted text-xs mt-8">
            Inicie uma conversa com o assistente de triagem.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 text-xs whitespace-pre-wrap break-words ${
                msg.role === 'user'
                  ? 'bg-brand-green text-brand-black font-medium rounded-br-sm'
                  : 'bg-brand-surface text-gray-200 border border-brand-border rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-brand-surface border border-brand-border rounded-2xl rounded-bl-sm px-4 py-2 text-xs text-brand-muted">
              Pensando...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Pending action banner */}
      {pendingAction && (
        <div className="flex-shrink-0 bg-brand-surface border-t border-brand-green/30 px-4 py-3">
          <p className="text-xs font-semibold text-brand-green mb-1">
            O agente quer executar:{' '}
            <span className="font-bold">{pendingAction.name ?? 'unknown action'}</span>
          </p>
          {pendingAction.args && (
            <pre className="text-[10px] text-gray-300 bg-brand-mid rounded p-2 mb-2 overflow-x-auto border border-brand-border">
              {JSON.stringify(pendingAction.args, null, 2)}
            </pre>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-bold bg-brand-green text-brand-black rounded-lg disabled:opacity-40 hover:brightness-110 transition-all cursor-pointer"
            >
              Confirmar
            </button>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-medium bg-transparent text-brand-muted border border-brand-border rounded-lg disabled:opacity-40 hover:text-white hover:border-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-brand-border bg-brand-surface p-3 flex gap-2 items-end">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder="Digite uma mensagem… (Enter para enviar, Shift+Enter para nova linha)"
          rows={1}
          className="flex-1 resize-none rounded-xl bg-brand-mid border border-brand-border px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-green disabled:opacity-50 leading-5 placeholder:text-brand-muted"
          style={{ maxHeight: '120px', overflowY: 'auto' }}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="flex-shrink-0 px-4 py-2 bg-brand-green hover:brightness-110 text-brand-black text-xs font-bold rounded-xl disabled:opacity-40 transition-all cursor-pointer"
        >
          Enviar
        </button>
      </div>
    </div>
  )
}
