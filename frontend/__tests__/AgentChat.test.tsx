import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AgentChat from '@/components/AgentChat'

vi.mock('@/lib/api', () => ({
  sendAgentMessage: vi.fn(),
}))

import { sendAgentMessage } from '@/lib/api'

const SESSION_KEY = 'paggo_agent_session'

describe('AgentChat — session persistence', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('mostra estado vazio quando sessionStorage está vazio', () => {
    render(<AgentChat />)
    expect(screen.getByText(/Inicie uma conversa/i)).toBeInTheDocument()
  })

  it('restaura mensagens do sessionStorage no mount', () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      messages: [
        { id: '1', role: 'user',      content: 'Olá agente' },
        { id: '2', role: 'assistant', content: 'Olá! Como posso ajudar?' },
      ],
      history: [],
      pendingAction: null,
    }))

    render(<AgentChat />)

    expect(screen.getByText('Olá agente')).toBeInTheDocument()
    expect(screen.getByText('Olá! Como posso ajudar?')).toBeInTheDocument()
  })

  it('salva mensagens no sessionStorage após receber resposta do agente', async () => {
    vi.mocked(sendAgentMessage).mockResolvedValue({
      reply: 'Resposta do agente',
      pending_action: null,
      updated_history: [{ role: 'user', content: 'Olá' }],
    })

    render(<AgentChat />)
    const textarea = screen.getByPlaceholderText(/Digite uma mensagem/i)
    await userEvent.type(textarea, 'Olá')
    await userEvent.click(screen.getByRole('button', { name: /Enviar/i }))

    await waitFor(() => {
      expect(screen.getByText('Resposta do agente')).toBeInTheDocument()
    })

    const stored = sessionStorage.getItem(SESSION_KEY)
    expect(stored).not.toBeNull()
    const saved = JSON.parse(stored!)
    expect(saved.messages).toHaveLength(2)
    expect(saved.messages[0]).toMatchObject({ role: 'user',      content: 'Olá' })
    expect(saved.messages[1]).toMatchObject({ role: 'assistant', content: 'Resposta do agente' })
  })

  it('limpa sessionStorage e reseta o chat ao clicar em "Nova conversa"', async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      messages: [{ id: '1', role: 'user', content: 'Mensagem antiga' }],
      history:  [{ role: 'user', content: 'Mensagem antiga' }],
      pendingAction: null,
    }))

    render(<AgentChat />)
    expect(screen.getByText('Mensagem antiga')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Nova conversa/i }))

    await waitFor(() => {
      expect(screen.queryByText('Mensagem antiga')).not.toBeInTheDocument()
      expect(screen.getByText(/Inicie uma conversa/i)).toBeInTheDocument()
    })
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })
})
