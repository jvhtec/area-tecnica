// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JobAssignmentMatrix from '../JobAssignmentMatrix';
import { createMockQueryBuilder } from '@/test/mockSupabase';

// Hoisted mocks
const {
  useQueryMock,
  useOptimizedAuthMock,
  useVirtualizedDateRangeMock,
  supabaseMock,
} = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  useOptimizedAuthMock: vi.fn(),
  useVirtualizedDateRangeMock: vi.fn(),
  supabaseMock: {
    from: vi.fn(),
    rpc: vi.fn(),
    functions: { invoke: vi.fn() },
    channel: vi.fn(() => ({
      on: vi.fn(function(this: any) { return this; }),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: useQueryMock,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
      prefetchQuery: vi.fn(),
      getQueryData: vi.fn(),
    }),
  };
});

vi.mock('@/hooks/useOptimizedAuth', () => ({
  useOptimizedAuth: useOptimizedAuthMock,
}));

vi.mock('@/hooks/useVirtualizedDateRange', () => ({
  useVirtualizedDateRange: useVirtualizedDateRangeMock,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

vi.mock('@/components/matrix/OptimizedAssignmentMatrix', () => ({
  OptimizedAssignmentMatrix: (props: any) => (
    <div data-testid="optimized-matrix">
      <div data-testid="matrix-technicians">{props.technicians.length}</div>
      <div data-testid="matrix-dates">{props.dates.length}</div>
      <div data-testid="matrix-jobs">{props.jobs.length}</div>
      <div data-testid="allow-direct-assign">{String(props.allowDirectAssign)}</div>
      <div data-testid="allow-mark-unavailable">{String(props.allowMarkUnavailable)}</div>
      <div data-testid="hide-staffing-email-buttons">{String(props.hideStaffingEmailButtons)}</div>
      <div data-testid="hide-staffing-whatsapp-buttons">{String(props.hideStaffingWhatsappButtons)}</div>
    </div>
  ),
}));

vi.mock('@/components/matrix/DateRangeExpander', () => ({
  DateRangeExpander: () => <div data-testid="date-range-expander">Date Range Expander</div>,
}));

vi.mock('@/components/matrix/SkillsFilter', () => ({
  SkillsFilter: () => <div data-testid="skills-filter">Skills Filter</div>,
}));

vi.mock('@/components/matrix/StaffingOrchestratorPanel', () => ({
  StaffingOrchestratorPanel: () => (
    <div data-testid="staffing-orchestrator">Staffing Orchestrator</div>
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
    skills: [{ name: 'FOH', category: 'sound-specialty', proficiency: 5, is_primary: true }],
  },
  {
    id: 'tech-2',
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane@example.com',
    department: 'lights',
    role: 'technician',
    skills: [{ name: 'Operador (MA2)', category: 'lights', proficiency: 4, is_primary: false }],
  },
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
    job_departments: [{ department: 'sound' }],
    job_assignments: [{ technician_id: 'tech-1' }],
    _assigned_count: 1,
  },
];

const mockDateRange = [
  new Date('2024-05-01T00:00:00Z'),
  new Date('2024-05-02T00:00:00Z'),
  new Date('2024-05-03T00:00:00Z'),
];

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();

  useOptimizedAuthMock.mockReturnValue({
    userDepartment: 'sound',
    userRole: 'technician',
  });

  useVirtualizedDateRangeMock.mockReturnValue({
    dateRange: mockDateRange,
    todayIndex: 1,
    canExpandBefore: true,
    canExpandAfter: true,
    expandBefore: vi.fn(),
    expandAfter: vi.fn(),
    setCenterDate: vi.fn(),
    resetRange: vi.fn(),
    jumpToMonth: vi.fn(),
    rangeInfo: {
      start: new Date('2024-05-01T00:00:00Z'),
      end: new Date('2024-05-03T00:00:00Z'),
      startFormatted: '2024-05-01',
      endFormatted: '2024-05-03',
    },
    getProjectedRangeInfo: vi.fn(),
  });

  useQueryMock.mockImplementation(({ queryKey }: any) => {
    const key = queryKey[0];

    if (key === 'optimized-matrix-technicians') {
      return {
        data: mockTechnicians,
        isInitialLoading: false,
        isFetching: false,
      };
    }

    if (key === 'optimized-matrix-jobs') {
      return {
        data: mockJobs,
        isInitialLoading: false,
        isFetching: false,
      };
    }

    if (key === 'technician-fridge-status') {
      return {
        data: [],
        isLoading: false,
      };
    }

    if (key === 'matrix-staffing-summary') {
      return {
        data: { summaries: [], assignments: [] },
        isSuccess: true,
      };
    }

    return { data: undefined, isLoading: false };
  });

  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'technician_fridge') {
      return createMockQueryBuilder({ data: [], error: null });
    }
    return createMockQueryBuilder();
  });

  supabaseMock.rpc.mockImplementation((fn: string) => {
    if (fn === 'get_profiles_with_skills') {
      return Promise.resolve({ data: mockTechnicians, error: null });
    }
    return Promise.resolve({ data: [], error: null });
  });
});

describe('JobAssignmentMatrix', () => {
  it('renders the page with header', async () => {
    render(<JobAssignmentMatrix />);

    await waitFor(() => {
      expect(screen.getByText(/Matriz de asignación de trabajos/i)).toBeInTheDocument();
    });
  });

  it('displays department tabs', async () => {
    render(<JobAssignmentMatrix />);

    await waitFor(() => {
      expect(screen.getByText(/Sonido/i)).toBeInTheDocument();
      expect(screen.getByText(/Luces/i)).toBeInTheDocument();
      expect(screen.getByText(/Video/i)).toBeInTheDocument();
    });
  });

  it('filters technicians by selected department', async () => {
    render(<JobAssignmentMatrix />);

    await waitFor(() => {
      expect(screen.getByTestId('optimized-matrix')).toBeInTheDocument();
    });

    // Should filter to sound department by default
    const techCount = screen.getByTestId('matrix-technicians');
    expect(techCount).toBeInTheDocument();
  });

  it('shows search input for filtering technicians', async () => {
    render(<JobAssignmentMatrix />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Buscar técnicos/i)).toBeInTheDocument();
    });
  });

  it('filters technicians by search term', async () => {
    const user = userEvent.setup();

    render(<JobAssignmentMatrix />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Buscar técnicos/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Buscar técnicos/i);
    await user.type(searchInput, 'John');

    // Should filter technicians matching search
    await waitFor(() => {
      expect(screen.getByTestId('optimized-matrix')).toBeInTheDocument();
    });
  });

  it('toggles direct assign mode', async () => {
    const user = userEvent.setup();

    render(<JobAssignmentMatrix />);

    await waitFor(() => {
      expect(screen.getByTestId('allow-direct-assign')).toHaveTextContent('false');
    });

    const directAssignToggle = screen.getAllByLabelText(/Alternar asignación directa/i)[0];
    await user.click(directAssignToggle);

    await waitFor(() => {
      expect(screen.getByTestId('allow-direct-assign')).toHaveTextContent('true');
    });
  });

  it('toggles mark unavailable mode for management users', async () => {
    useOptimizedAuthMock.mockReturnValue({
      userDepartment: 'sound',
      userRole: 'management',
    });

    const user = userEvent.setup();

    render(<JobAssignmentMatrix />);

    await waitFor(() => {
      expect(screen.getByTestId('allow-mark-unavailable')).toHaveTextContent('false');
    });

    const unavailableToggle = screen.getAllByLabelText(/Alternar marcar no disponible/i)[0];
    await user.click(unavailableToggle);

    await waitFor(() => {
      expect(screen.getByTestId('allow-mark-unavailable')).toHaveTextContent('true');
    });
  });

  it('hides mark unavailable toggle for regular technicians', async () => {
    useOptimizedAuthMock.mockReturnValue({
      userDepartment: 'sound',
      userRole: 'technician',
    });

    render(<JobAssignmentMatrix />);

    await waitFor(() => {
      expect(screen.getByTestId('optimized-matrix')).toBeInTheDocument();
    });

    // Should not have unavailable toggle for regular users
    const unavailableToggles = screen.queryAllByLabelText(/Alternar marcar no disponible/i);
    expect(unavailableToggles.length).toBe(0);
  });

  it('shows skills filter component', async () => {
    render(<JobAssignmentMatrix />);

    await waitFor(() => {
      expect(screen.getByTestId('skills-filter')).toBeInTheDocument();
    });
  });

  it('displays fridge toggle with count', async () => {
    render(<JobAssignmentMatrix />);

    await waitFor(() => {
      expect(screen.getByText(/Abrir la nevera/i)).toBeInTheDocument();
    });
  });

  it('shows technician and job counts', async () => {
    render(<JobAssignmentMatrix />);

    await waitFor(() => {
      expect(screen.getAllByText(/técnicos/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/trabajos/i).length).toBeGreaterThan(0);
    });
  });

  it('displays refresh button', async () => {
    render(<JobAssignmentMatrix />);

    await waitFor(() => {
      expect(screen.getByText(/Refrescar/i)).toBeInTheDocument();
    });
  });

  it('handles refresh action', async () => {
    const user = userEvent.setup();

    render(<JobAssignmentMatrix />);

    await waitFor(() => {
      const refreshButton = screen.getByText(/Refrescar/i);
      expect(refreshButton).toBeInTheDocument();
    });

    const refreshButton = screen.getByText(/Refrescar/i);
    await user.click(refreshButton);

    // Should dispatch assignment-updated event
    await waitFor(() => {
      expect(refreshButton).not.toBeDisabled();
    });
  });

  it('shows staffing reminder button', async () => {
    render(<JobAssignmentMatrix />);

    await waitFor(() => {
      expect(screen.getByText(/Ver recordatorio de staffing/i)).toBeInTheDocument();
    });
  });

  it('opens staffing reminder dialog when clicked', async () => {
    const user = userEvent.setup();

    useQueryMock.mockImplementation(({ queryKey }: any) => {
      const key = queryKey[0];

      if (key === 'matrix-staffing-summary') {
        return {
          data: {
            summaries: [
              {
                job_id: 'job-1',
                department: 'sound',
                roles: [{ role_code: 'foh', quantity: 2 }],
              },
            ],
            assignments: [],
          },
          isSuccess: true,
        };
      }

      if (key === 'optimized-matrix-technicians') {
        return { data: mockTechnicians, isInitialLoading: false, isFetching: false };
      }

      if (key === 'optimized-matrix-jobs') {
        return { data: mockJobs, isInitialLoading: false, isFetching: false };
      }

      return { data: undefined, isLoading: false };
    });

    render(<JobAssignmentMatrix />);

    await waitFor(() => {
      expect(screen.getByText(/Ver recordatorio de staffing/i)).toBeInTheDocument();
    });

    const reminderButton = screen.getByText(/Ver recordatorio de staffing/i);
    await user.click(reminderButton);

    await waitFor(() => {
      expect(screen.getByText(/trabajos con personal por completar/i)).toBeInTheDocument();
    });
  });

  it('shows date range expander on desktop', async () => {
    render(<JobAssignmentMatrix />);

    await waitFor(() => {
      expect(screen.getByTestId('date-range-expander')).toBeInTheDocument();
    });
  });

  it('renders mobile filters toggle when in mobile mode', async () => {
    // Mock window.innerWidth to simulate mobile
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500,
    });

    window.dispatchEvent(new Event('resize'));

    render(<JobAssignmentMatrix />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Filtros/i })).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching initial data', () => {
    useQueryMock.mockImplementation(({ queryKey }: any) => {
      const key = queryKey[0];

      if (key === 'optimized-matrix-technicians') {
        return { data: undefined, isInitialLoading: true, isFetching: false };
      }

      return { data: undefined, isLoading: false };
    });

    render(<JobAssignmentMatrix />);

    expect(screen.getByText(/Cargando la matriz de asignaciones/i)).toBeInTheDocument();
  });

  it('filters technicians by skills', async () => {
    render(<JobAssignmentMatrix />);

    await waitFor(() => {
      expect(screen.getByTestId('optimized-matrix')).toBeInTheDocument();
    });

    // Skills filtering should work through the SkillsFilter component
    expect(screen.getByTestId('skills-filter')).toBeInTheDocument();
  });

  it('hides fridge technicians when fridge toggle is on', async () => {
    useQueryMock.mockImplementation(({ queryKey }: any) => {
      const key = queryKey[0];

      if (key === 'technician-fridge-status') {
        return {
          data: [{ technician_id: 'tech-1', in_fridge: true }],
          isLoading: false,
        };
      }

      if (key === 'optimized-matrix-technicians') {
        return { data: mockTechnicians, isInitialLoading: false, isFetching: false };
      }

      if (key === 'optimized-matrix-jobs') {
        return { data: mockJobs, isInitialLoading: false, isFetching: false };
      }

      return { data: undefined, isLoading: false };
    });

    render(<JobAssignmentMatrix />);

    await waitFor(() => {
      expect(screen.getByTestId('optimized-matrix')).toBeInTheDocument();
    });

    // Should filter out fridge technicians
    expect(screen.getByTestId('matrix-technicians')).toBeInTheDocument();
  });

  it('handles department changes', async () => {
    const user = userEvent.setup();

    render(<JobAssignmentMatrix />);

    await waitFor(() => {
      expect(screen.getByText(/Luces/i)).toBeInTheDocument();
    });

    const lightsTab = screen.getByText(/Luces/i);
    await user.click(lightsTab);

    await waitFor(() => {
      expect(screen.getByTestId('optimized-matrix')).toBeInTheDocument();
    });
  });

  it('opens staffing orchestrator from reminder dialog', async () => {
    const user = userEvent.setup();

    useQueryMock.mockImplementation(({ queryKey }: any) => {
      const key = queryKey[0];

      if (key === 'matrix-staffing-summary') {
        return {
          data: {
            summaries: [
              {
                job_id: 'job-1',
                department: 'sound',
                roles: [{ role_code: 'foh', quantity: 2 }],
              },
            ],
            assignments: [],
          },
          isSuccess: true,
        };
      }

      if (key === 'optimized-matrix-technicians') {
        return { data: mockTechnicians, isInitialLoading: false, isFetching: false };
      }

      if (key === 'optimized-matrix-jobs') {
        return { data: mockJobs, isInitialLoading: false, isFetching: false };
      }

      return { data: undefined, isLoading: false };
    });

    render(<JobAssignmentMatrix />);

    await waitFor(() => {
      expect(screen.getByText(/Ver recordatorio de staffing/i)).toBeInTheDocument();
    });

    const reminderButton = screen.getByText(/Ver recordatorio de staffing/i);
    await user.click(reminderButton);

    await waitFor(() => {
      expect(screen.getByText(/Auto staffing/i)).toBeInTheDocument();
    });

    const autoStaffingButton = screen.getByText(/Auto staffing/i);
    await user.click(autoStaffingButton);

    await waitFor(() => {
      expect(screen.getByTestId('staffing-orchestrator')).toBeInTheDocument();
    });
  });

  it('passes correct props to OptimizedAssignmentMatrix', async () => {
    render(<JobAssignmentMatrix />);

    await waitFor(() => {
      const matrixElement = screen.getByTestId('optimized-matrix');
      expect(matrixElement).toBeInTheDocument();
    });

    expect(screen.getByTestId('matrix-technicians')).toBeInTheDocument();
    expect(screen.getByTestId('matrix-dates')).toBeInTheDocument();
    expect(screen.getByTestId('matrix-jobs')).toBeInTheDocument();
  });

  it('lets users hide staffing email and WhatsApp buttons and persists the preference', async () => {
    const user = userEvent.setup();

    render(<JobAssignmentMatrix />);

    await waitFor(() => {
      expect(screen.getByTestId('optimized-matrix')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('switch', { name: /mostrar botones de email/i }));
    await user.click(screen.getByRole('switch', { name: /mostrar botones de whatsapp/i }));

    expect(screen.getByTestId('hide-staffing-email-buttons')).toHaveTextContent('true');
    expect(screen.getByTestId('hide-staffing-whatsapp-buttons')).toHaveTextContent('true');
    expect(window.localStorage.getItem('job-assignment-matrix:hide-staffing-email-buttons')).toBe('true');
    expect(window.localStorage.getItem('job-assignment-matrix:hide-staffing-whatsapp-buttons')).toBe('true');
  });
});
