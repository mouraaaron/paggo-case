import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { StatsBottomBar } from '@/components/AlertPanel'
import type { AgentStat, SegmentVolumeStat, SegmentRiskStat } from '@/lib/api'

vi.mock('@/lib/api', () => ({
  getAgentStats: vi.fn(),
  getVolumeBySegment: vi.fn(),
  getRiskBySegment: vi.fn(),
}))

import { getAgentStats, getVolumeBySegment, getRiskBySegment } from '@/lib/api'

const mockAgentStats: AgentStat[] = [
  { agent: 'Ana Souza', urgent: 1, high: 2, medium: 0, low: 0, total: 3 },
  { agent: 'Bruno Lima', urgent: 0, high: 0, medium: 1, low: 1, total: 2 },
]

const mockVolumeStats: SegmentVolumeStat[] = [
  { segment: 'ENT', total: 45, open: 20, closed: 25 },
  { segment: 'MID', total: 89, open: 50, closed: 39 },
  { segment: 'SMB', total: 210, open: 100, closed: 110 },
]

const mockRiskStats: SegmentRiskStat[] = [
  { segment: 'ENT', avg_risk: 72.3, count: 45 },
  { segment: 'MID', avg_risk: 45.1, count: 89 },
  { segment: 'SMB', avg_risk: 18.7, count: 210 },
]

describe('StatsBottomBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state on first render', () => {
    vi.mocked(getAgentStats).mockReturnValue(new Promise(() => {}))
    vi.mocked(getVolumeBySegment).mockReturnValue(new Promise(() => {}))
    vi.mocked(getRiskBySegment).mockReturnValue(new Promise(() => {}))

    render(<StatsBottomBar />)
    expect(screen.getByText('Carregando estatísticas...')).toBeInTheDocument()
  })

  it('renders agent balancing table with data after load', async () => {
    vi.mocked(getAgentStats).mockResolvedValue(mockAgentStats)
    vi.mocked(getVolumeBySegment).mockResolvedValue(mockVolumeStats)
    vi.mocked(getRiskBySegment).mockResolvedValue(mockRiskStats)

    render(<StatsBottomBar />)

    await waitFor(() => {
      expect(screen.getByText('Ana Souza')).toBeInTheDocument()
      expect(screen.getByText('Bruno Lima')).toBeInTheDocument()
    })
  })

  it('renders volume chart with segment labels', async () => {
    vi.mocked(getAgentStats).mockResolvedValue([])
    vi.mocked(getVolumeBySegment).mockResolvedValue(mockVolumeStats)
    vi.mocked(getRiskBySegment).mockResolvedValue([])

    render(<StatsBottomBar />)

    await waitFor(() => {
      expect(screen.getAllByText('ENT').length).toBeGreaterThan(0)
      expect(screen.getAllByText('MID').length).toBeGreaterThan(0)
      expect(screen.getAllByText('SMB').length).toBeGreaterThan(0)
    })
  })

  it('renders risk chart with avg score values', async () => {
    vi.mocked(getAgentStats).mockResolvedValue([])
    vi.mocked(getVolumeBySegment).mockResolvedValue([])
    vi.mocked(getRiskBySegment).mockResolvedValue(mockRiskStats)

    render(<StatsBottomBar />)

    await waitFor(() => {
      expect(screen.getByText('72.3')).toBeInTheDocument()
      expect(screen.getByText('45.1')).toBeInTheDocument()
      expect(screen.getByText('18.7')).toBeInTheDocument()
    })
  })

  it('shows error when API fails and no data was previously loaded', async () => {
    vi.mocked(getAgentStats).mockRejectedValue(new Error('Network error'))
    vi.mocked(getVolumeBySegment).mockRejectedValue(new Error('Network error'))
    vi.mocked(getRiskBySegment).mockRejectedValue(new Error('Network error'))

    render(<StatsBottomBar />)

    await waitFor(() => {
      expect(screen.getByText('Erro ao carregar estatísticas')).toBeInTheDocument()
    })
  })

  it('keeps existing data visible when refresh fails (stale-while-revalidate)', async () => {
    vi.mocked(getAgentStats)
      .mockResolvedValueOnce(mockAgentStats)
      .mockRejectedValue(new Error('Refresh failed'))
    vi.mocked(getVolumeBySegment)
      .mockResolvedValueOnce(mockVolumeStats)
      .mockRejectedValue(new Error('Refresh failed'))
    vi.mocked(getRiskBySegment)
      .mockResolvedValueOnce(mockRiskStats)
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
    vi.mocked(getVolumeBySegment).mockResolvedValue(mockVolumeStats)
    vi.mocked(getRiskBySegment).mockResolvedValue(mockRiskStats)

    const { rerender } = render(<StatsBottomBar refreshKey={0} />)

    await waitFor(() => {
      expect(screen.getByText('Ana Souza')).toBeInTheDocument()
    })

    rerender(<StatsBottomBar refreshKey={1} />)

    await waitFor(() => {
      expect(vi.mocked(getAgentStats)).toHaveBeenCalledTimes(2)
      expect(vi.mocked(getVolumeBySegment)).toHaveBeenCalledTimes(2)
      expect(vi.mocked(getRiskBySegment)).toHaveBeenCalledTimes(2)
    })
  })

  it('passes date filters to all three stat functions', async () => {
    vi.mocked(getAgentStats).mockResolvedValue([])
    vi.mocked(getVolumeBySegment).mockResolvedValue([])
    vi.mocked(getRiskBySegment).mockResolvedValue([])

    render(
      <StatsBottomBar createdAfter="2024-01-01" createdBefore="2024-01-31" />
    )

    await waitFor(() => {
      expect(vi.mocked(getAgentStats)).toHaveBeenCalledWith({
        createdAfter: '2024-01-01',
        createdBefore: '2024-01-31',
      })
      expect(vi.mocked(getVolumeBySegment)).toHaveBeenCalledWith({
        createdAfter: '2024-01-01',
        createdBefore: '2024-01-31',
      })
      expect(vi.mocked(getRiskBySegment)).toHaveBeenCalledWith({
        createdAfter: '2024-01-01',
        createdBefore: '2024-01-31',
      })
    })
  })

  it('shows empty message when no agent data for the period', async () => {
    vi.mocked(getAgentStats).mockResolvedValue([])
    vi.mocked(getVolumeBySegment).mockResolvedValue([])
    vi.mocked(getRiskBySegment).mockResolvedValue([])

    render(<StatsBottomBar />)

    await waitFor(() => {
      expect(screen.getByText('Sem dados para o período selecionado')).toBeInTheDocument()
    })
  })
})
