import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockQueryBuilder } from '@/test/mockSupabase'
import { TourLogisticsDialog } from '../TourLogisticsDialog'

const { from, rpc, toast } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), toast: vi.fn() }))
vi.mock('@/services/dataLayerClient', () => ({
  dataLayerClient: { from, rpc, auth: { getUser: async () => ({ data: { user: { id: 'manager' } } }) } },
}))
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

type RequestFixture = {
  id: string; job_id: string; department: string; source_type: string; planning_status: string
  status: string; created_by: string; note: string
  items: { transport_type: string; leftover_space_meters: number | null }[]
}
const request = (id: string, jobId: string, stage: string, source = 'tour'): RequestFixture => ({
  id, job_id: jobId, department: 'sound', source_type: source, planning_status: stage,
  status: 'requested', created_by: 'manager', note: id,
  items: [{ transport_type: '6m', leftover_space_meters: null }],
})

let rows: RequestFixture[]
let client: QueryClient
let requestBuilders: (ReturnType<typeof createMockQueryBuilder> & { filter: ReturnType<typeof vi.fn> })[]

function openDialog(jobIds: string[]) {
  from.mockImplementation((table: string) => {
    if (table === 'jobs') return createMockQueryBuilder({ data: jobIds.map(id => ({
      id, title: id, start_time: '2026-09-13T10:00:00Z', job_type: 'tourdate', status: 'Confirmado',
    })), error: null })
    let selected = [...rows]
    const builder = Object.assign(createMockQueryBuilder({ data: selected, error: null }), { filter: vi.fn() })
    builder.eq.mockImplementation((column: keyof RequestFixture, value: unknown) => {
      selected = selected.filter(row => row[column] === value)
      builder.__setResult({ data: selected, error: null })
      return builder
    })
    builder.in.mockImplementation((column: keyof RequestFixture, values: unknown[]) => {
      selected = selected.filter(row => values.includes(row[column]))
      builder.__setResult({ data: selected, error: null })
      return builder
    })
    builder.filter.mockImplementation((column: keyof RequestFixture, operator: string, value: unknown) => {
      expect(operator).toBe('eq')
      selected = selected.filter(row => row[column] === value)
      builder.__setResult({ data: selected, error: null })
      return builder
    })
    requestBuilders.push(builder)
    return builder
  })
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  return render(<QueryClientProvider client={client}>
    <TourLogisticsDialog open onOpenChange={vi.fn()} tourId="tour-1" />
  </QueryClientProvider>)
}

describe('TourLogisticsDialog generated demand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rows = []
    requestBuilders = []
    rpc.mockImplementation(async (_name, args) => {
      const id = args.p_request_id || `new-${args.p_job_id}`
      if (!rows.some(row => row.id === id)) rows.push(request(id, args.p_job_id, 'requested'))
      return { data: id, error: null }
    })
  })
  afterEach(() => { cleanup(); client.clear() })

  it('loads only active tour demand and leaves manual, legacy and closed rows separate', async () => {
    rows = [
      request('manual', 'job-1', 'requested', 'manual'),
      request('legacy', 'job-1', 'requested', 'manual'),
      request('completed', 'job-1', 'completed'),
      request('cancelled', 'job-1', 'cancelled'),
    ]
    openDialog(['job-1'])
    const save = await screen.findByRole('button', { name: 'Guardar en fechas editables' })
    await waitFor(() => expect(save).toBeEnabled())
    expect(requestBuilders[0].filter).toHaveBeenCalledWith('source_type', 'eq', 'tour')
    expect(requestBuilders[0].in).toHaveBeenCalledWith('planning_status', ['requested', 'reviewing', 'planned', 'confirmed'])
    expect(screen.getByPlaceholderText('Nota opcional')).toHaveValue('')
    expect(screen.getByText(/Las solicitudes manuales existentes se mantienen separadas/)).toBeInTheDocument()
    fireEvent.click(save)
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('replace_transport_request_with_items', expect.objectContaining({
      p_request_id: null, p_job_id: 'job-1', p_note: null,
      p_items: [{ transport_type: 'trailer', leftover_space_meters: null }],
    })))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Fechas de gira actualizadas: 1' })))
  })

  it('skips planned and confirmed demand and seeds defaults from editable review demand', async () => {
    rows = [request('planned', 'job-1', 'planned'), request('confirmed', 'job-2', 'confirmed'), request('review', 'job-3', 'reviewing')]
    openDialog(['job-1', 'job-2', 'job-3'])
    await waitFor(() => expect(screen.getByPlaceholderText('Nota opcional')).toHaveValue('review'))
    expect(screen.getAllByText('Plan bloqueado · se omitirá')).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Anular' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar en fechas editables' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Fechas de gira actualizadas: 1',
      description: 'Fechas omitidas por tener solicitudes planificadas o confirmadas: 2. Vuelve a revisión desde Logística para editarlas.',
    })))
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('replace_transport_request_with_items', expect.objectContaining({ p_request_id: 'review' }))
  })

  it('disables saving when every date already has a locked plan', async () => {
    rows = [request('confirmed', 'job-1', 'confirmed')]
    openDialog(['job-1'])
    await screen.findByText('Plan bloqueado · se omitirá')
    expect(screen.getByRole('button', { name: 'Guardar en fechas editables' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Anular' })).not.toBeInTheDocument()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('does not report success when concurrent planning makes the generator RPC a no-op', async () => {
    rows = [request('demand', 'job-1', 'requested')]
    rpc.mockImplementation(async () => {
      rows = [request('demand', 'job-1', 'planned')]
      return { data: 'demand', error: null }
    })
    openDialog(['job-1'])
    await waitFor(() => expect(screen.getByPlaceholderText('Nota opcional')).toHaveValue('demand'))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar en fechas editables' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'No se actualizaron solicitudes de gira',
      description: 'Fechas omitidas por tener solicitudes planificadas o confirmadas: 1. Vuelve a revisión desde Logística para editarlas.',
    })))
  })
})
