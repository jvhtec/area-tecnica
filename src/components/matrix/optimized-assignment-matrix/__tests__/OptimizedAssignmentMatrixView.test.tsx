import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OptimizedAssignmentMatrixView } from '../OptimizedAssignmentMatrixView';
import type { OptimizedAssignmentMatrixViewProps } from '../OptimizedAssignmentMatrixView';
import type { MatrixV2ViewConfig } from '@/features/matrix-v2/viewConfig';

// The view owns its scroll state; tests drive it through this stand-in.
const scrollState = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));
const defaultScrollState = () => ({
  dateHeadersRef: { current: null },
  technicianScrollRef: { current: null },
  mainScrollRef: { current: null },
  visibleCols: { start: 0, end: 2 },
  visibleRows: { start: 0, end: 1 },
  canNavLeft: false,
  canNavRight: false,
  handleMobileNav: vi.fn(),
  handleMainScroll: vi.fn(),
});
vi.mock('../useMatrixScrollState', () => ({
  useMatrixScrollState: () => scrollState.current,
}));

// Mock child components
vi.mock('../../TechnicianRow', () => ({
  TechnicianRow: ({ technician }: any) => (
    <div data-testid={`tech-row-${technician.id}`}>{technician.first_name}</div>
  ),
}));

vi.mock('../../DateHeader', () => ({
  DateHeader: ({ date, onJobClick }: any) => (
    <div data-testid="date-header">
      {date.toISOString()}
      <button type="button" onClick={() => onJobClick?.('job-1')}>fila de trabajo</button>
    </div>
  ),
}));

vi.mock('../../OptimizedMatrixCell', () => ({
  OptimizedMatrixCell: ({ technician, date, onInspect, onConfirm, onDecline }: any) => (
    <div data-testid={`cell-${technician.id}-${date.toISOString()}`}>
      <button type="button" onClick={(event) => onInspect(technician.id, date, event.currentTarget)}>inspeccionar</button>
      <button type="button" onClick={() => onConfirm(technician.id, date)}>confirmar</button>
      <button type="button" onClick={() => onDecline(technician.id, date)}>rechazar</button>
    </div>
  ),
}));

vi.mock('@/components/users/CreateUserDialog', () => ({
  CreateUserDialog: () => <div data-testid="create-user-dialog">Create User Dialog</div>,
}));

const mockTechnicians = [
  { id: 'tech-1', first_name: 'John', last_name: 'Doe', department: 'sound', role: 'technician' },
  { id: 'tech-2', first_name: 'Jane', last_name: 'Smith', department: 'lights', role: 'technician' },
];

const mockDates = [
  new Date('2024-05-01T00:00:00Z'),
  new Date('2024-05-02T00:00:00Z'),
  new Date('2024-05-03T00:00:00Z'),
];

const mockJobs = [
  { id: 'job-1', title: 'Concert A', start_time: '2024-05-01T10:00:00Z', end_time: '2024-05-01T22:00:00Z' },
];

const createV2 = (overrides: Partial<MatrixV2ViewConfig> = {}): MatrixV2ViewConfig => ({
  runner: { run: vi.fn(), releaseAll: vi.fn(), loadState: vi.fn() },
  roleSlotsByJob: new Map(),
  lastRoleByTechnician: new Map(),
  inspectorTarget: null,
  toggleInspector: vi.fn(),
  openInspector: vi.fn(),
  closeInspector: vi.fn(),
  quickConfirm: vi.fn(),
  toggleUnavailable: vi.fn(),
  focus: null,
  setFocusJob: vi.fn(),
  toggleFocusJob: vi.fn(),
  ...overrides,
});

const createMockProps = (overrides?: Partial<OptimizedAssignmentMatrixViewProps>): OptimizedAssignmentMatrixViewProps => ({
  isFetching: false,
  isInitialLoading: false,
  TECHNICIAN_WIDTH: 256,
  HEADER_HEIGHT: 80,
  CELL_WIDTH: 160,
  CELL_HEIGHT: 60,
  matrixWidth: 480,
  matrixHeight: 120,
  dates: mockDates,
  technicians: mockTechnicians,
  orderedTechnicians: mockTechnicians,
  fridgeSet: new Set(),
  mobile: false,
  cycleTechSort: vi.fn(),
  getSortLabel: () => '',
  isManagementUser: false,
  setCreateUserOpen: vi.fn(),
  createUserOpen: false,
  qc: { invalidateQueries: vi.fn() },
  getJobsForDate: () => mockJobs,
  getAssignmentForCell: () => null,
  getAvailabilityForCell: () => null,
  selectedCells: new Set(),
  staffingMaps: { byJob: new Map(), byDate: new Map() },
  handleCellSelect: vi.fn(),
  handleCellPrefetch: vi.fn(),
  incrementCellRender: vi.fn(),
  declinedJobsByTech: new Map(),
  jobs: mockJobs,
  sendStaffingEmailAsync: vi.fn(),
  cancelStaffingAsync: vi.fn(),
  techMedalRankings: new Map(),
  techLastYearMedalRankings: new Map(),
  clearCellSelection: vi.fn(),
  onReplaceSelection: vi.fn(),
  profileNamesMap: new Map(),
  v2: createV2(),
  ...overrides,
});

beforeEach(() => {
  scrollState.current = defaultScrollState();
  vi.clearAllMocks();
});

describe('OptimizedAssignmentMatrixView', () => {
  it('renders matrix layout with corner header', () => {
    const props = createMockProps();
    render(<OptimizedAssignmentMatrixView {...props} />);

    expect(screen.getByText(/Técnicos/i)).toBeInTheDocument();
  });

  it('displays updating indicator when fetching', () => {
    const props = createMockProps({ isFetching: true });
    render(<OptimizedAssignmentMatrixView {...props} />);

    expect(screen.getByText(/Actualizando/i)).toBeInTheDocument();
  });

  it('renders date headers for visible columns', () => {
    const props = createMockProps();
    render(<OptimizedAssignmentMatrixView {...props} />);

    const dateHeaders = screen.getAllByTestId('date-header');
    expect(dateHeaders).toHaveLength(3); // 3 visible dates
  });

  it('renders technician rows for visible technicians', () => {
    const props = createMockProps();
    render(<OptimizedAssignmentMatrixView {...props} />);

    expect(screen.getByTestId('tech-row-tech-1')).toBeInTheDocument();
    expect(screen.getByTestId('tech-row-tech-2')).toBeInTheDocument();
  });

  it('renders matrix cells for visible range', () => {
    const props = createMockProps();
    render(<OptimizedAssignmentMatrixView {...props} />);

    // Should render cells for 2 technicians × 3 dates = 6 cells
    const cells = screen.getAllByTestId(/cell-tech-/);
    expect(cells.length).toBeGreaterThanOrEqual(6);
  });

  it('a click on a cell opens (or toggles) its inspector', async () => {
    const toggleInspector = vi.fn();
    const user = userEvent.setup();
    render(<OptimizedAssignmentMatrixView {...createMockProps({ v2: createV2({ toggleInspector }) })} />);
    await user.click(screen.getAllByText('inspeccionar')[0]);
    expect(toggleInspector).toHaveBeenCalledWith('tech-1', mockDates[0], expect.any(HTMLElement));
  });

  it('the ✓ of a cell confirms at once, and the ✕ asks first, in the inspector', async () => {
    const quickConfirm = vi.fn();
    const openInspector = vi.fn();
    const user = userEvent.setup();
    render(<OptimizedAssignmentMatrixView {...createMockProps({ v2: createV2({ quickConfirm, openInspector }) })} />);
    await user.click(screen.getAllByText('confirmar')[0]);
    expect(quickConfirm).toHaveBeenCalledWith('tech-1', mockDates[0]);
    await user.click(screen.getAllByText('rechazar')[0]);
    expect(openInspector).toHaveBeenCalledWith('tech-1', mockDates[0], null, 'decline');
  });

  it('a job row in a date header focuses that job', async () => {
    const toggleFocusJob = vi.fn();
    const user = userEvent.setup();
    render(<OptimizedAssignmentMatrixView {...createMockProps({ v2: createV2({ toggleFocusJob }) })} />);
    await user.click(screen.getAllByText('fila de trabajo')[0]);
    expect(toggleFocusJob).toHaveBeenCalledWith('job-1');
  });

  it('shows Add User button for management users', () => {
    const props = createMockProps({ isManagementUser: true });
    render(<OptimizedAssignmentMatrixView {...props} />);

    expect(screen.getByText(/Añadir/i)).toBeInTheDocument();
  });

  it('hides Add User button for non-management users', () => {
    const props = createMockProps({ isManagementUser: false });
    render(<OptimizedAssignmentMatrixView {...props} />);

    expect(screen.queryByText(/Añadir/i)).not.toBeInTheDocument();
  });

  it('displays sort label when present', () => {
    const props = createMockProps({ getSortLabel: () => '📍 Ubicación' });
    render(<OptimizedAssignmentMatrixView {...props} />);

    expect(screen.getByText('📍 Ubicación')).toBeInTheDocument();
  });

  it('shows mobile navigation buttons in mobile mode', () => {
    scrollState.current = { ...defaultScrollState(), canNavLeft: true, canNavRight: true };
    const props = createMockProps({ mobile: true });
    render(<OptimizedAssignmentMatrixView {...props} />);

    const leftButton = screen.getByLabelText(/Fechas anteriores/i);
    const rightButton = screen.getByLabelText(/Fechas siguientes/i);

    expect(leftButton).toBeInTheDocument();
    expect(rightButton).toBeInTheDocument();
  });

  it('handles mobile navigation button clicks', async () => {
    const handleMobileNav = vi.fn();
    scrollState.current = { ...defaultScrollState(), canNavLeft: true, canNavRight: true, handleMobileNav };
    const props = createMockProps({ mobile: true });
    const user = userEvent.setup();

    render(<OptimizedAssignmentMatrixView {...props} />);

    const leftButton = screen.getByLabelText(/Fechas anteriores/i);
    await user.click(leftButton);
    expect(handleMobileNav).toHaveBeenCalledWith('left');

    const rightButton = screen.getByLabelText(/Fechas siguientes/i);
    await user.click(rightButton);
    expect(handleMobileNav).toHaveBeenCalledWith('right');
  });

  it('calls cycleTechSort when clicking sort button', async () => {
    const cycleTechSort = vi.fn();
    const props = createMockProps({ cycleTechSort });
    const user = userEvent.setup();

    render(<OptimizedAssignmentMatrixView {...props} />);

    const sortButton = screen.getByTitle('Cambia el orden de técnicos');
    await user.click(sortButton);

    expect(cycleTechSort).toHaveBeenCalled();
  });

  it('shows CreateUserDialog when createUserOpen is true', () => {
    const props = createMockProps({ createUserOpen: true, isManagementUser: true });
    render(<OptimizedAssignmentMatrixView {...props} />);

    expect(screen.getByTestId('create-user-dialog')).toBeInTheDocument();
  });

  it('uses mobile-optimized dimensions when mobile prop is true', () => {
    const props = createMockProps({
      mobile: true,
      CELL_WIDTH: 140,
      CELL_HEIGHT: 80,
      TECHNICIAN_WIDTH: 110,
      HEADER_HEIGHT: 50,
    });

    render(<OptimizedAssignmentMatrixView {...props} />);

    // Matrix should still render with mobile dimensions
    expect(screen.getByText(/Técnicos/i)).toBeInTheDocument();
  });

  it('applies correct dimensions to layout elements', () => {
    const props = createMockProps({
      TECHNICIAN_WIDTH: 300,
      HEADER_HEIGHT: 100,
    });

    const { container } = render(<OptimizedAssignmentMatrixView {...props} />);

    const corner = container.querySelector('.matrix-corner');
    expect(corner).toHaveStyle({
      width: '300px',
      height: '100px',
    });
  });

  it('displays medal rankings for technicians', () => {
    const techMedalRankings = new Map([['tech-1', 'gold' as const]]);
    const props = createMockProps({ techMedalRankings });

    render(<OptimizedAssignmentMatrixView {...props} />);

    // The medal should be passed to TechnicianRow component
    expect(screen.getByTestId('tech-row-tech-1')).toBeInTheDocument();
  });

  it('handles empty technicians list gracefully', () => {
    const props = createMockProps({
      technicians: [],
      orderedTechnicians: [],
    });

    render(<OptimizedAssignmentMatrixView {...props} />);

    // Should still render the layout structure
    expect(screen.getByText(/Técnicos/i)).toBeInTheDocument();
  });

  it('handles empty dates list gracefully', () => {
    const props = createMockProps({
      dates: [],
    });

    render(<OptimizedAssignmentMatrixView {...props} />);

    // Should still render the layout structure
    expect(screen.getByText(/Técnicos/i)).toBeInTheDocument();
  });
});
