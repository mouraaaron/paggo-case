import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionButtons } from '@/components/ActionButtons'
import type { Ticket } from '@/types'

vi.mock('@/lib/api', () => ({
  updateStatus: vi.fn(),
  classifyTicket: vi.fn(),
  assignTicket: vi.fn(),
  addReply: vi.fn(),
  getTicket: vi.fn(),
  closeTicket: vi.fn(),
  sendAgentMessage: vi.fn(),
}))

import { sendAgentMessage, assignTicket, getTicket } from '@/lib/api'

const makeTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
  ticket_id: 'TKT-001',
  customer_id: 'C001',
  customer_name: 'Test Customer',
  customer_segment: 'SMB',
  plan: 'PRO',
  channel: 'EMAIL',
  subject: 'Cannot log in',
  body_preview: 'I cannot access my account.',
  created_at: '2024-01-08T10:00:00+00:00',
  last_reply_at: null,
  last_reply_by: null,
  reply_count: 0,
  status: 'NEW',
  priority: 'MEDIUM',
  assigned_to: null,
  category: null,
  previous_open_tickets_for_customer: 0,
  triage_flags: [],
  risk_score: 0,
  close_reason: null,
  merged_into: null,
  ...overrides,
})

describe('ActionButtons — AI Agent reply', () => {
  const onUpdate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the AI Agent button', () => {
    render(<ActionButtons ticket={makeTicket()} onUpdate={onUpdate} />)
    expect(screen.getByTitle(/gerar sugestão/i)).toBeInTheDocument()
  })

  it('fills textarea with AI-generated suggestion on click', async () => {
    vi.mocked(sendAgentMessage).mockResolvedValue({
      reply: 'Olá! Entendemos seu problema e vamos ajudar.',
      pending_action: null,
      updated_history: [],
    })

    const user = userEvent.setup()
    render(<ActionButtons ticket={makeTicket()} onUpdate={onUpdate} />)

    const aiButton = screen.getByTitle(/gerar sugestão/i)
    await user.click(aiButton)

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText('Reply body...')
      expect(textarea).toHaveValue('Olá! Entendemos seu problema e vamos ajudar.')
    })
  })

  it('sends ticket context in the AI prompt', async () => {
    vi.mocked(sendAgentMessage).mockResolvedValue({
      reply: 'Resposta gerada',
      pending_action: null,
      updated_history: [],
    })

    const user = userEvent.setup()
    const ticket = makeTicket({
      subject: 'Billing issue',
      body_preview: 'Cobrança duplicada',
      customer_segment: 'ENT',
      priority: 'URGENT',
    })
    render(<ActionButtons ticket={ticket} onUpdate={onUpdate} />)

    await user.click(screen.getByTitle(/gerar sugestão/i))

    await waitFor(() => {
      const [prompt] = vi.mocked(sendAgentMessage).mock.calls[0]
      expect(prompt).toContain('Billing issue')
      expect(prompt).toContain('Cobrança duplicada')
      expect(prompt).toContain('ENT')
      expect(prompt).toContain('URGENT')
    })
  })

  it('shows loading indicator while generating', async () => {
    let resolve: (v: Awaited<ReturnType<typeof sendAgentMessage>>) => void
    vi.mocked(sendAgentMessage).mockReturnValue(
      new Promise(r => { resolve = r })
    )

    const user = userEvent.setup()
    render(<ActionButtons ticket={makeTicket()} onUpdate={onUpdate} />)

    await user.click(screen.getByTitle(/gerar sugestão/i))

    expect(screen.getByText('Gerando...')).toBeInTheDocument()

    await act(async () => {
      resolve!({ reply: '', pending_action: null, updated_history: [] })
    })
  })

  it('shows error message when AI call fails', async () => {
    vi.mocked(sendAgentMessage).mockRejectedValue(new Error('OpenAI timeout'))

    const user = userEvent.setup()
    render(<ActionButtons ticket={makeTicket()} onUpdate={onUpdate} />)

    await user.click(screen.getByTitle(/gerar sugestão/i))

    await waitFor(() => {
      expect(screen.getByText('OpenAI timeout')).toBeInTheDocument()
    })
  })

  it('disables AI button while loading to prevent double submit', async () => {
    vi.mocked(sendAgentMessage).mockReturnValue(new Promise(() => {}))

    const user = userEvent.setup()
    render(<ActionButtons ticket={makeTicket()} onUpdate={onUpdate} />)

    await user.click(screen.getByTitle(/gerar sugestão/i))

    expect(screen.getByText('Gerando...')).toBeDisabled()
  })
})

describe('ActionButtons — Close reason options', () => {
  it('renders spec-correct close reason options and excludes SPAM', () => {
    const ticket = makeTicket({ status: 'RESOLVED' })
    render(<ActionButtons ticket={ticket} onUpdate={vi.fn()} />)

    expect(screen.getByRole('option', { name: 'RESOLVED_FIXED' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'RESOLVED_INFO' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'DUPLICATE' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'NOT_REPRODUCIBLE' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'WONT_FIX' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'CUSTOMER_NO_RESPONSE' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'SPAM' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'NO_RESPONSE' })).not.toBeInTheDocument()
  })
})

describe('ActionButtons — Assign agent', () => {
  const onUpdate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders assign section with agent dropdown', () => {
    render(<ActionButtons ticket={makeTicket()} onUpdate={onUpdate} />)
    expect(screen.getByText('Atribuir Agente')).toBeInTheDocument()
    expect(screen.getByText('Atribuir')).toBeInTheDocument()
  })

  it('calls assignTicket with selected agent and triggers onUpdate', async () => {
    const updated = makeTicket({ assigned_to: 'Ana Souza' })
    vi.mocked(assignTicket).mockResolvedValue(updated)

    const user = userEvent.setup()
    render(<ActionButtons ticket={makeTicket()} onUpdate={onUpdate} />)

    const select = screen.getByDisplayValue('— Não atribuído —')
    await user.selectOptions(select, 'Ana Souza')

    await user.click(screen.getByText('Atribuir'))

    await waitFor(() => {
      expect(vi.mocked(assignTicket)).toHaveBeenCalledWith('TKT-001', 'Ana Souza')
      expect(onUpdate).toHaveBeenCalledWith(updated)
    })
  })

  it('shows error when assign fails', async () => {
    vi.mocked(assignTicket).mockRejectedValue(new Error('Assign failed'))

    const user = userEvent.setup()
    render(<ActionButtons ticket={makeTicket()} onUpdate={onUpdate} />)

    await user.click(screen.getByText('Atribuir'))

    await waitFor(() => {
      expect(screen.getByText('Assign failed')).toBeInTheDocument()
    })
  })
})
