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
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingAction])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    const newMsg: DisplayMessage = { id: crypto.randomUUID(), role: 'user', content: text }
    setMessages(prev => [...prev, newMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await sendAgentMessage(text, history, null)
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
      const res = await sendAgentMessage(CONFIRM_SIGNAL, history, actionToConfirm)
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
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
        <h1 className="text-lg font-semibold text-gray-900">AI Triage Assistant</h1>
        <p className="text-sm text-gray-500">Ask me to triage, assign, classify, or manage tickets.</p>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-8">
            Start a conversation with the AI Triage Assistant.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-2 text-sm text-gray-400 shadow-sm">
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Pending action banner */}
      {pendingAction && (
        <div className="flex-shrink-0 bg-amber-50 border-t border-amber-200 px-4 py-3">
          <p className="text-sm font-medium text-amber-800 mb-1">
            Agent wants to:{' '}
            <span className="font-semibold">{pendingAction.name ?? 'unknown action'}</span>
          </p>
          {pendingAction.args && (
            <pre className="text-xs text-amber-700 bg-amber-100 rounded p-2 mb-2 overflow-x-auto">
              {JSON.stringify(pendingAction.args, null, 2)}
            </pre>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="px-3 py-1.5 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="px-3 py-1.5 text-sm font-medium bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white p-3 flex gap-2 items-end">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 leading-5"
          style={{ maxHeight: '120px', overflowY: 'auto' }}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="flex-shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  )
}
