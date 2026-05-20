import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { StatsBottomBar } from '@/components/AlertPanel'
import type { AgentStat, ResponseTimeStat } from '@/lib/api'

vi.mock('@/lib/api', () => ({
  getAgentStats: vi.fn(),
  getResponseTimeStats: vi.fn(),
}))

import { getAgentStats, getResponseTimeStats } from '@/lib/api'

const mockAgentStats: AgentStat[] = [
  { agent: 'Ana Souza', urgent: 1, high: 2, medium: 0, low: 0, total: 3 },
  { agent: 'Bruno Lima', urgent: 0, high: 0, medium: 1, low: 1, total: 2 },
]

const mockResponseTimeStats: ResponseTimeStat[] = [
  { segment: 'ENT', median_seconds: 7200, count: 45 },
  { segment: 'MID', median_seconds: 5400, count: 89 },
  { segment: 'SMB', median_seconds: 10800, count: 210 },
]

describe('StatsBottomBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state on first render', () => {
    vi.mocked(getAgentStats).mockReturnValue(new Promise(() => {}))
    vi.mocked(getResponseTimeStats).mockReturnValue(new Promise(() => {}))

    render(<StatsBottomBar />)
    expect(screen.getByText('Carregando estatísticas...')).toBeInTheDocument()
  })

  it('renders agent balancing table with data after load', async () => {
    vi.mocked(getAgentStats).mockResolvedValue(mockAgentStats)
    vi.mocked(getResponseTimeStats).mockResolvedValue(mockResponseTimeStats)

    render(<StatsBottomBar />)

    await waitFor(() => {
      expect(screen.getByText('Ana Souza')).toBeInTheDocument()
      expect(screen.getByText('Bruno Lima')).toBeInTheDocument()
    })
  })

  it('renders response time chart with segment labels', async () => {
    vi.mocked(getAgentStats).mockResolvedValue([])
    vi.mocked(getResponseTimeStats).mockResolvedValue(mockResponseTimeStats)

    render(<StatsBottomBar />)

    await waitFor(() => {
      // Each segment label appears at least once in the chart
      expect(screen.getAllByText('ENT').length).toBeGreaterThan(0)
      expect(screen.getAllByText('MID').length).toBeGreaterThan(0)
      expect(screen.getAllByText('SMB').length).toBeGreaterThan(0)
    })
  })

  it('renders response time values formatted as duration', async () => {
    vi.mocked(getAgentStats).mockResolvedValue([])
    vi.mocked(getResponseTimeStats).mockResolvedValue([
      { segment: 'ENT', median_seconds: 3600, count: 10 },  // 1h
      { segment: 'MID', median_seconds: 1800, count: 5 },   // 30min
    ])

    render(<StatsBottomBar />)

    await waitFor(() => {
      expect(screen.getByText('1h')).toBeInTheDocument()
      expect(screen.getByText('30min')).toBeInTheDocument()
    })
  })

  it('shows error when API fails and no data was previously loaded', async () => {
    vi.mocked(getAgentStats).mockRejectedValue(new Error('Network error'))
    vi.mocked(getResponseTimeStats).mockRejectedValue(new Error('Network error'))

    render(<StatsBottomBar />)

    await waitFor(() => {
      expect(screen.getByText('Erro ao carregar estatísticas')).toBeInTheDocument()
    })
  })

  it('keeps existing data visible when refresh fails (stale-while-revalidate)', async () => {
    vi.mocked(getAgentStats)
      .mockResolvedValueOnce(mockAgentStats)
      .mockRejectedValue(new Error('Refresh failed'))
    vi.mocked(getResponseTimeStats)
      .mockResolvedValueOnce(mockResponseTimeStats)
      .mockRejectedValue(new Error('Refresh failed'))

    const { rerender } = render(<StatsBottomBar refreshKey={0} />)

    await waitFor(() => {
      expect(screen.getByText('Ana Souza')).toBeInTheDocument()
    })

    await act(async () => {
      rerender(<StatsBottomBar refreshKey={1} />)
    })

    expect(screen.getByText('Ana Souza')).toBeInTheDocument()
    expect(screen.queryByText('Carregando estatísticas...')).not.toBeInTheDocument()
  })

  it('refetches when refreshKey changes', async () => {
    vi.mocked(getAgentStats).mockResolvedValue(mockAgentStats)
    vi.mocked(getResponseTimeStats).mockResolvedValue(mockResponseTimeStats)

    const { rerender } = render(<StatsBottomBar refreshKey={0} />)

    await waitFor(() => {
      expect(screen.getByText('Ana Souza')).toBeInTheDocument()
    })

    rerender(<StatsBottomBar refreshKey={1} />)

    await waitFor(() => {
      expect(vi.mocked(getAgentStats)).toHaveBeenCalledTimes(2)
      expect(vi.mocked(getResponseTimeStats)).toHaveBeenCalledTimes(2)
    })
  })

  it('passes date filters to both getAgentStats and getResponseTimeStats', async () => {
    vi.mocked(getAgentStats).mockResolvedValue([])
    vi.mocked(getResponseTimeStats).mockResolvedValue([])

    render(
      <StatsBottomBar createdAfter="2024-01-01" createdBefore="2024-01-31" />
    )

    await waitFor(() => {
      expect(vi.mocked(getAgentStats)).toHaveBeenCalledWith({
        createdAfter: '2024-01-01',
        createdBefore: '2024-01-31',
      })
      expect(vi.mocked(getResponseTimeStats)).toHaveBeenCalledWith({
        createdAfter: '2024-01-01',
        createdBefore: '2024-01-31',
      })
    })
  })

  it('shows empty message when no agent data for the period', async () => {
    vi.mocked(getAgentStats).mockResolvedValue([])
    vi.mocked(getResponseTimeStats).mockResolvedValue([])

    render(<StatsBottomBar />)

    await waitFor(() => {
      expect(screen.getByText('Sem dados para o período selecionado')).toBeInTheDocument()
    })
  })
})
