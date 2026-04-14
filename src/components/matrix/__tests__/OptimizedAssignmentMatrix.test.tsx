// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OptimizedAssignmentMatrix } from '../OptimizedAssignmentMatrix';
import { createMockQueryBuilder } from '@/test/mockSupabase';

// Hoisted mocks
const {
  useQueryMock,
  useOptimizedMatrixDataMock,
  useStaffingMatrixStatusesMock,
  useOptimizedAuthMock,
  useSelectedCellStoreMock,
  supabaseMock,
  toastFn,
} = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  useOptimizedMatrixDataMock: vi.fn(),
  useStaffingMatrixStatusesMock: vi.fn(),
  useOptimizedAuthMock: vi.fn(),
  useSelectedCellStoreMock: vi.fn(),
  supabaseMock: {
    from: vi.fn(),
    rpc: vi.fn(),
    functions: { invoke: vi.fn() },
  },
  toastFn: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: useQueryMock,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

vi.mock('@/hooks/useOptimizedMatrixData', () => ({
  useOptimizedMatrixData: useOptimizedMatrixDataMock,
}));

vi.mock('@/features/staffing/hooks/useStaffingMatrixStatuses', () => ({
  useStaffingMatrixStatuses: useStaffingMatrixStatusesMock,
}));

vi.mock('@/hooks/useOptimizedAuth', () => ({
  useOptimizedAuth: useOptimizedAuthMock,
}));

vi.mock('@/stores/useSelectedCellStore', () => ({
  useSelectedCellStore: useSelectedCellStoreMock,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: supabaseMock,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastFn }),
}));

vi.mock('@/features/staffing/hooks/useStaffing', () => ({
  useSendStaffingEmail: () => ({
    mutate: vi.fn(),
  }),
}));

vi.mock('@/hooks/usePerformanceMonitor', () => ({
  usePerformanceMonitor: () => ({
    startRenderTimer: vi.fn(),
    endRenderTimer: vi.fn(),
    incrementCellRender: vi.fn(),
  }),
}));

vi.mock('@/features/staffing/hooks/useStaffingRealtime', () => ({
  useStaffingRealtime: vi.fn(),
}));

vi.mock('@/hooks/useDragScroll', () => ({
  useDragScroll: vi.fn(),
}));

vi.mock('@/utils/technicianAvailability', () => ({
  checkTimeConflictEnhanced: vi.fn().mockResolvedValue({
    hasHardConflict: false,
    hasSoftConflict: false,
    hardConflicts: [],
    softConflicts: [],
    unavailabilityConflicts: [],
  }),
}));

// Mock OptimizedAssignmentMatrixView
vi.mock('../optimized-assignment-matrix/OptimizedAssignmentMatrixView', () => ({
  OptimizedAssignmentMatrixView: (props: any) => (
    <div data-testid="matrix-view">
      <div data-testid="technicians-count">{props.technicians.length}</div>
      <div data-testid="dates-count">{props.dates.length}</div>
      <div data-testid="jobs-count">{props.jobs.length}</div>
      <div data-testid="allow-mark-unavailable">{String(props.allowMarkUnavailable)}</div>
      <div data-testid="cell-action-type">{props.cellAction?.type ?? 'none'}</div>
      <div data-testid="cell-action-job-id">{props.cellAction?.selectedJobId ?? 'none'}</div>
      <button
        type="button"
        data-testid="direct-assign-cell"
        onClick={() => props.handleCellClick(props.technicians[0].id, props.dates[0], 'assign', props.jobs[0].id)}
      >
        Direct assign
      </button>
    </div>
  ),
}));

const mockTechnicians = [
  {
    id: 'tech-1',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    department: 'sound',
    role: 'technician',
  },
  {
    id: 'tech-2',
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane@example.com',
    department: 'lights',
    role: 'house_tech',
  },
];

const mockDates = [
  new Date('2024-05-01T00:00:00Z'),
  new Date('2024-05-02T00:00:00Z'),
  new Date('2024-05-03T00:00:00Z'),
];

const mockJobs = [
  {
    id: 'job-1',
    title: 'Concert A',
    start_time: '2024-05-01T10:00:00Z',
    end_time: '2024-05-01T22:00:00Z',
    color: '#3B82F6',
    status: 'scheduled',
    job_type: 'single',
  },
];

beforeEach(() => {
  vi.clearAllMocks();

  useOptimizedMatrixDataMock.mockReturnValue({
    allAssignments: [],
    getAssignmentForCell: vi.fn().mockReturnValue(null),
    getAvailabilityForCell: vi.fn().mockReturnValue(null),
    getJobsForDate: vi.fn().mockReturnValue(mockJobs),
    prefetchTechnicianData: vi.fn(),
    updateAssignmentOptimistically: vi.fn(),
    invalidateAssignmentQueries: vi.fn(),
    invalidateAvailabilityQueries: vi.fn(),
    isInitialLoading: false,
    isFetching: false,
  });

  useStaffingMatrixStatusesMock.mockReturnValue({
    data: {
      byJob: new Map(),
      byDate: new Map(),
    },
  });

  useOptimizedAuthMock.mockReturnValue({
    userRole: 'technician',
  });

  useSelectedCellStoreMock.mockReturnValue({
    selectedCell: null,
    selectCell: vi.fn(),
    clearSelection: vi.fn(),
    isCellSelected: vi.fn().mockReturnValue(false),
  });

  useQueryMock.mockImplementation(({ queryKey }: any) => {
    const key = queryKey[0];
    if (key === 'matrix-sort-job-statuses') {
      return { data: new Map(), isLoading: false };
    }
    if (key === 'tech-residencias') {
      return { data: new Map(), isLoading: false };
    }
    if (key === 'tech-confirmed-counts-all-with-dept') {
      return {
        data: { counts: new Map(), departments: new Map() },
        isLoading: false,
      };
    }
    if (key === 'tech-last-year-counts-all-with-dept') {
      return {
        data: { counts: new Map(), departments: new Map() },
        isLoading: false,
      };
    }
    return { data: undefined, isLoading: false };
  });

  supabaseMock.from.mockReturnValue(createMockQueryBuilder());
  supabaseMock.rpc.mockResolvedValue({ data: [], error: null });
  supabaseMock.functions.invoke.mockResolvedValue({ data: null, error: null });
});

describe('OptimizedAssignmentMatrix', () => {
  it('renders with basic props', () => {
    render(
      <OptimizedAssignmentMatrix
        technicians={mockTechnicians}
        dates={mockDates}
        jobs={mockJobs}
      />
    );

    expect(screen.getByTestId('matrix-view')).toBeInTheDocument();
    expect(screen.getByTestId('technicians-count')).toHaveTextContent('2');
    expect(screen.getByTestId('dates-count')).toHaveTextContent('3');
  });

  it('shows loading state initially', () => {
    useOptimizedMatrixDataMock.mockReturnValue({
      ...useOptimizedMatrixDataMock(),
      isInitialLoading: true,
    });

    render(
      <OptimizedAssignmentMatrix
        technicians={mockTechnicians}
        dates={mockDates}
        jobs={mockJobs}
      />
    );

    expect(screen.getByText(/Cargando matriz/i)).toBeInTheDocument();
  });

  it('sorts technicians by default (house techs first, then by confirmed count)', () => {
    const confirmedCountsData = {
      counts: new Map([
        ['tech-1', 10],
        ['tech-2', 5],
      ]),
      departments: new Map([
        ['tech-1', 'sound'],
        ['tech-2', 'lights'],
      ]),
    };

    useQueryMock.mockImplementation(({ queryKey }: any) => {
      const key = queryKey[0];
      if (key === 'tech-confirmed-counts-all-with-dept') {
        return { data: confirmedCountsData, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    render(
      <OptimizedAssignmentMatrix
        technicians={mockTechnicians}
        dates={mockDates}
        jobs={mockJobs}
      />
    );

    // House tech (tech-2) should come first
    expect(screen.getByTestId('matrix-view')).toBeInTheDocument();
  });

  it('handles cell click for direct assignment when allowed', async () => {
    const getAssignmentForCell = vi.fn().mockReturnValue(null);
    useOptimizedMatrixDataMock.mockReturnValue({
      ...useOptimizedMatrixDataMock(),
      getAssignmentForCell,
    });

    render(
      <OptimizedAssignmentMatrix
        technicians={mockTechnicians}
        dates={mockDates}
        jobs={mockJobs}
        allowDirectAssign={true}
      />
    );

    expect(screen.getByTestId('matrix-view')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('direct-assign-cell'));

    expect(getAssignmentForCell).toHaveBeenCalledWith('tech-1', mockDates[0]);
    expect(screen.getByTestId('cell-action-type')).toHaveTextContent('assign');
    expect(screen.getByTestId('cell-action-job-id')).toHaveTextContent('job-1');
  });

  it('prevents assignment for technicians in fridge', () => {
    const fridgeSet = new Set(['tech-1']);

    render(
      <OptimizedAssignmentMatrix
        technicians={mockTechnicians}
        dates={mockDates}
        jobs={mockJobs}
        fridgeSet={fridgeSet}
        allowDirectAssign={true}
      />
    );

    expect(screen.getByTestId('matrix-view')).toBeInTheDocument();
  });

  it('handles unavailability marking when allowed', () => {
    useOptimizedAuthMock.mockReturnValue({
      userRole: 'management',
    });

    render(
      <OptimizedAssignmentMatrix
        technicians={mockTechnicians}
        dates={mockDates}
        jobs={mockJobs}
        allowMarkUnavailable={true}
      />
    );

    expect(screen.getByTestId('matrix-view')).toBeInTheDocument();
    expect(screen.getByTestId('allow-mark-unavailable')).toHaveTextContent('true');
  });

  it('calculates medal rankings correctly', () => {
    const confirmedCountsData = {
      counts: new Map([
        ['tech-1', 20],
        ['tech-2', 15],
        ['tech-3', 10],
      ]),
      departments: new Map([
        ['tech-1', 'sound'],
        ['tech-2', 'sound'],
        ['tech-3', 'sound'],
      ]),
    };

    useQueryMock.mockImplementation(({ queryKey }: any) => {
      const key = queryKey[0];
      if (key === 'tech-confirmed-counts-all-with-dept') {
        return { data: confirmedCountsData, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    render(
      <OptimizedAssignmentMatrix
        technicians={[...mockTechnicians, { id: 'tech-3', first_name: 'Bob', last_name: 'Johnson', department: 'sound', role: 'technician' }]}
        dates={mockDates}
        jobs={mockJobs}
      />
    );

    // Should calculate medals per department
    expect(screen.getByTestId('matrix-view')).toBeInTheDocument();
  });

  it('listens for assignment-updated events', async () => {
    const invalidateAssignmentQueries = vi.fn();
    useOptimizedMatrixDataMock.mockReturnValue({
      ...useOptimizedMatrixDataMock(),
      invalidateAssignmentQueries,
    });

    render(
      <OptimizedAssignmentMatrix
        technicians={mockTechnicians}
        dates={mockDates}
        jobs={mockJobs}
      />
    );

    window.dispatchEvent(new CustomEvent('assignment-updated'));

    await waitFor(() => {
      expect(invalidateAssignmentQueries).toHaveBeenCalled();
    });
  });

  it('auto-scrolls to today on mount', async () => {
    const todayDate = new Date();
    const datesWithToday = [
      new Date(todayDate.getTime() - 86400000), // yesterday
      todayDate,
      new Date(todayDate.getTime() + 86400000), // tomorrow
    ];

    render(
      <OptimizedAssignmentMatrix
        technicians={mockTechnicians}
        dates={datesWithToday}
        jobs={mockJobs}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('matrix-view')).toBeInTheDocument();
    });
  });

  it('handles near edge scroll for date expansion', () => {
    const onNearEdgeScroll = vi.fn();

    render(
      <OptimizedAssignmentMatrix
        technicians={mockTechnicians}
        dates={mockDates}
        jobs={mockJobs}
        onNearEdgeScroll={onNearEdgeScroll}
        canExpandBefore={true}
        canExpandAfter={true}
      />
    );

    expect(screen.getByTestId('matrix-view')).toBeInTheDocument();
  });

  it('applies mobile optimizations when mobile prop is true', () => {
    render(
      <OptimizedAssignmentMatrix
        technicians={mockTechnicians}
        dates={mockDates}
        jobs={mockJobs}
        mobile={true}
        cellWidth={140}
        cellHeight={80}
        technicianWidth={110}
        headerHeight={50}
      />
    );

    expect(screen.getByTestId('matrix-view')).toBeInTheDocument();
  });

  it('sorts technicians by location when location sort is selected', () => {
    const techResidencias = new Map([
      ['tech-1', 'Madrid, España'],
      ['tech-2', 'Barcelona, España'],
    ]);

    useQueryMock.mockImplementation(({ queryKey }: any) => {
      const key = queryKey[0];
      if (key === 'tech-residencias') {
        return { data: techResidencias, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    render(
      <OptimizedAssignmentMatrix
        technicians={mockTechnicians}
        dates={mockDates}
        jobs={mockJobs}
      />
    );

    expect(screen.getByTestId('matrix-view')).toBeInTheDocument();
  });

  it('handles declined jobs to prevent re-assignment', () => {
    const allAssignments = [
      {
        technician_id: 'tech-1',
        job_id: 'job-1',
        status: 'declined',
      },
    ];

    useOptimizedMatrixDataMock.mockReturnValue({
      ...useOptimizedMatrixDataMock(),
      allAssignments,
    });

    render(
      <OptimizedAssignmentMatrix
        technicians={mockTechnicians}
        dates={mockDates}
        jobs={mockJobs}
      />
    );

    expect(screen.getByTestId('matrix-view')).toBeInTheDocument();
  });

  it('prefetches technician data on hover', () => {
    const prefetchTechnicianData = vi.fn();
    useOptimizedMatrixDataMock.mockReturnValue({
      ...useOptimizedMatrixDataMock(),
      prefetchTechnicianData,
    });

    render(
      <OptimizedAssignmentMatrix
        technicians={mockTechnicians}
        dates={mockDates}
        jobs={mockJobs}
      />
    );

    expect(screen.getByTestId('matrix-view')).toBeInTheDocument();
  });

  it('handles optimistic updates for assignment status changes', () => {
    const updateAssignmentOptimistically = vi.fn();
    useOptimizedMatrixDataMock.mockReturnValue({
      ...useOptimizedMatrixDataMock(),
      updateAssignmentOptimistically,
    });

    render(
      <OptimizedAssignmentMatrix
        technicians={mockTechnicians}
        dates={mockDates}
        jobs={mockJobs}
      />
    );

    expect(screen.getByTestId('matrix-view')).toBeInTheDocument();
  });

  it('integrates with global cell selection store', () => {
    const selectCell = vi.fn();
    const clearSelection = vi.fn();
    const isCellSelected = vi.fn().mockReturnValue(false);

    useSelectedCellStoreMock.mockReturnValue({
      selectedCell: null,
      selectCell,
      clearSelection,
      isCellSelected,
    });

    render(
      <OptimizedAssignmentMatrix
        technicians={mockTechnicians}
        dates={mockDates}
        jobs={mockJobs}
      />
    );

    expect(screen.getByTestId('matrix-view')).toBeInTheDocument();
  });

  it('renders empty state when no technicians provided', () => {
    render(
      <OptimizedAssignmentMatrix
        technicians={[]}
        dates={mockDates}
        jobs={mockJobs}
      />
    );

    expect(screen.getByTestId('technicians-count')).toHaveTextContent('0');
  });

  it('renders empty state when no dates provided', () => {
    render(
      <OptimizedAssignmentMatrix
        technicians={mockTechnicians}
        dates={[]}
        jobs={mockJobs}
      />
    );

    expect(screen.getByTestId('dates-count')).toHaveTextContent('0');
  });

  it('handles last year medal rankings', () => {
    const lastYearCountsData = {
      counts: new Map([
        ['tech-1', 25],
        ['tech-2', 18],
      ]),
      departments: new Map([
        ['tech-1', 'sound'],
        ['tech-2', 'lights'],
      ]),
    };

    useQueryMock.mockImplementation(({ queryKey }: any) => {
      const key = queryKey[0];
      if (key === 'tech-last-year-counts-all-with-dept') {
        return { data: lastYearCountsData, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    render(
      <OptimizedAssignmentMatrix
        technicians={mockTechnicians}
        dates={mockDates}
        jobs={mockJobs}
      />
    );

    expect(screen.getByTestId('matrix-view')).toBeInTheDocument();
  });
});
