import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { StatsBottomBar } from '@/components/AlertPanel'
import type { AgentStat, WeeklyStat } from '@/lib/api'

vi.mock('@/lib/api', () => ({
  getAgentStats: vi.fn(),
  getWeeklyStats: vi.fn(),
}))

import { getAgentStats, getWeeklyStats } from '@/lib/api'

const mockAgentStats: AgentStat[] = [
  { agent: 'Ana Souza', urgent: 1, high: 2, medium: 0, low: 0, total: 3 },
  { agent: 'Bruno Lima', urgent: 0, high: 0, medium: 1, low: 1, total: 2 },
]

const mockWeeklyStats: WeeklyStat[] = [
  { week: '2024-W01', total: 10, urgent: 2 },
  { week: '2024-W02', total: 15, urgent: 5 },
]

describe('StatsBottomBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state on first render', () => {
    vi.mocked(getAgentStats).mockReturnValue(new Promise(() => {}))
    vi.mocked(getWeeklyStats).mockReturnValue(new Promise(() => {}))

    render(<StatsBottomBar />)
    expect(screen.getByText('Carregando estatísticas...')).toBeInTheDocument()
  })

  it('renders agent balancing table with data after load', async () => {
    vi.mocked(getAgentStats).mockResolvedValue(mockAgentStats)
    vi.mocked(getWeeklyStats).mockResolvedValue(mockWeeklyStats)

    render(<StatsBottomBar />)

    await waitFor(() => {
      expect(screen.getByText('Ana Souza')).toBeInTheDocument()
      expect(screen.getByText('Bruno Lima')).toBeInTheDocument()
    })
  })

  it('shows all priority columns in agent table', async () => {
    vi.mocked(getAgentStats).mockResolvedValue(mockAgentStats)
    vi.mocked(getWeeklyStats).mockResolvedValue(mockWeeklyStats)

    render(<StatsBottomBar />)

    await waitFor(() => {
      expect(screen.getByText('URGENT')).toBeInTheDocument()
      expect(screen.getByText('HIGH')).toBeInTheDocument()
      expect(screen.getByText('MEDIUM')).toBeInTheDocument()
      expect(screen.getByText('LOW')).toBeInTheDocument()
    })
  })

  it('shows error when API fails and no data was previously loaded', async () => {
    vi.mocked(getAgentStats).mockRejectedValue(new Error('Network error'))
    vi.mocked(getWeeklyStats).mockRejectedValue(new Error('Network error'))

    render(<StatsBottomBar />)

    await waitFor(() => {
      expect(screen.getByText('Erro ao carregar estatísticas')).toBeInTheDocument()
    })
  })

  it('keeps existing data visible when refresh fails (stale-while-revalidate)', async () => {
    vi.mocked(getAgentStats)
      .mockResolvedValueOnce(mockAgentStats)
      .mockRejectedValue(new Error('Refresh failed'))
    vi.mocked(getWeeklyStats)
      .mockResolvedValueOnce(mockWeeklyStats)
      .mockRejectedValue(new Error('Refresh failed'))

    const { rerender } = render(<StatsBottomBar refreshKey={0} />)

    await waitFor(() => {
      expect(screen.getByText('Ana Souza')).toBeInTheDocument()
    })

    await act(async () => {
      rerender(<StatsBottomBar refreshKey={1} />)
    })

    // existing data stays visible; no full loading screen
    expect(screen.getByText('Ana Souza')).toBeInTheDocument()
    expect(screen.queryByText('Carregando estatísticas...')).not.toBeInTheDocument()
  })

  it('refetches when refreshKey changes', async () => {
    vi.mocked(getAgentStats).mockResolvedValue(mockAgentStats)
    vi.mocked(getWeeklyStats).mockResolvedValue(mockWeeklyStats)

    const { rerender } = render(<StatsBottomBar refreshKey={0} />)

    await waitFor(() => {
      expect(screen.getByText('Ana Souza')).toBeInTheDocument()
    })

    rerender(<StatsBottomBar refreshKey={1} />)

    await waitFor(() => {
      expect(vi.mocked(getAgentStats)).toHaveBeenCalledTimes(2)
    })
  })

  it('passes date filters to getAgentStats', async () => {
    vi.mocked(getAgentStats).mockResolvedValue([])
    vi.mocked(getWeeklyStats).mockResolvedValue([])

    render(
      <StatsBottomBar createdAfter="2024-01-01" createdBefore="2024-01-31" />
    )

    await waitFor(() => {
      expect(vi.mocked(getAgentStats)).toHaveBeenCalledWith({
        createdAfter: '2024-01-01',
        createdBefore: '2024-01-31',
      })
    })
  })

  it('shows empty message when no agent data for the period', async () => {
    vi.mocked(getAgentStats).mockResolvedValue([])
    vi.mocked(getWeeklyStats).mockResolvedValue([])

    render(<StatsBottomBar />)

    await waitFor(() => {
      expect(screen.getByText('Sem dados para o período selecionado')).toBeInTheDocument()
    })
  })
})
