import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MorningBriefingModal } from '@/components/MorningBriefingModal'
import type { MorningBriefingData } from '@/lib/api'

const mockData: MorningBriefingData = {
  period_label: '19/05 - 21/05',
  new_tickets: { total: 127, ENT: 12, MID: 45, SMB: 70 },
  team_status: { overloaded_agents: ['Ana Souza'], unassigned_urgent: 2 },
  narrative: 'Período movimentado com 127 novos tickets.',
  next_steps: ['Atribuir 2 urgentes sem responsável', 'Verificar sobrecarregados'],
}

describe('MorningBriefingModal', () => {
  it('renders nothing when data is null', () => {
    const { container } = render(<MorningBriefingModal data={null} onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders period label', () => {
    render(<MorningBriefingModal data={mockData} onClose={() => {}} />)
    expect(screen.getByText('19/05 - 21/05')).toBeInTheDocument()
  })

  it('renders total ticket count', () => {
    render(<MorningBriefingModal data={mockData} onClose={() => {}} />)
    expect(screen.getByText('127')).toBeInTheDocument()
  })

  it('renders segment counts', () => {
    render(<MorningBriefingModal data={mockData} onClose={() => {}} />)
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('70')).toBeInTheDocument()
  })

  it('renders narrative text', () => {
    render(<MorningBriefingModal data={mockData} onClose={() => {}} />)
    expect(screen.getByText('Período movimentado com 127 novos tickets.')).toBeInTheDocument()
  })

  it('renders all next steps', () => {
    render(<MorningBriefingModal data={mockData} onClose={() => {}} />)
    expect(screen.getByText('Atribuir 2 urgentes sem responsável')).toBeInTheDocument()
    expect(screen.getByText('Verificar sobrecarregados')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    render(<MorningBriefingModal data={mockData} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: /fechar/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows overloaded agent name', () => {
    render(<MorningBriefingModal data={mockData} onClose={() => {}} />)
    expect(screen.getByText(/Ana Souza/)).toBeInTheDocument()
  })

  it('shows unassigned urgent count', () => {
    render(<MorningBriefingModal data={mockData} onClose={() => {}} />)
    expect(screen.getByText(/2 urgentes/)).toBeInTheDocument()
  })
})
