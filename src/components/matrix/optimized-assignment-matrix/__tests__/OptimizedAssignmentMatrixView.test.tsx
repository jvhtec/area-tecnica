import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OptimizedAssignmentMatrixView } from '../OptimizedAssignmentMatrixView';
import type { OptimizedAssignmentMatrixViewProps } from '../OptimizedAssignmentMatrixView';

// Mock child components
vi.mock('../../TechnicianRow', () => ({
  TechnicianRow: ({ technician }: any) => (
    <div data-testid={`tech-row-${technician.id}`}>{technician.first_name}</div>
  ),
}));

vi.mock('../../DateHeader', () => ({
  DateHeader: ({ date }: any) => (
    <div data-testid="date-header">{date.toISOString()}</div>
  ),
}));

vi.mock('../../OptimizedMatrixCell', () => ({
  OptimizedMatrixCell: ({ technician, date }: any) => (
    <div data-testid={`cell-${technician.id}-${date.toISOString()}`}>Cell</div>
  ),
}));

vi.mock('../../SelectJobDialog', () => ({
  SelectJobDialog: () => <div data-testid="select-job-dialog">Select Job Dialog</div>,
}));

vi.mock('../../StaffingJobSelectionDialog', () => ({
  StaffingJobSelectionDialog: () => (
    <div data-testid="staffing-job-selection-dialog">Staffing Job Selection Dialog</div>
  ),
}));

vi.mock('../../AssignJobDialog', () => ({
  AssignJobDialog: () => <div data-testid="assign-job-dialog">Assign Job Dialog</div>,
}));

vi.mock('../../AssignmentStatusDialog', () => ({
  AssignmentStatusDialog: () => <div data-testid="assignment-status-dialog">Assignment Status Dialog</div>,
}));

vi.mock('../../MarkUnavailableDialog', () => ({
  MarkUnavailableDialog: () => (
    <div data-testid="mark-unavailable-dialog">Mark Unavailable Dialog</div>
  ),
}));

vi.mock('../../OfferDetailsDialog', () => ({
  OfferDetailsDialog: () => <div data-testid="offer-details-dialog">Offer Details Dialog</div>,
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

const createMockProps = (overrides?: Partial<OptimizedAssignmentMatrixViewProps>): OptimizedAssignmentMatrixViewProps => ({
  isFetching: false,
  isInitialLoading: false,
  TECHNICIAN_WIDTH: 256,
  HEADER_HEIGHT: 80,
  CELL_WIDTH: 160,
  CELL_HEIGHT: 60,
  matrixWidth: 480,
  matrixHeight: 120,
  dateHeadersRef: { current: null },
  technicianScrollRef: { current: null },
  mainScrollRef: { current: null },
  visibleCols: { start: 0, end: 2 },
  visibleRows: { start: 0, end: 1 },
  dates: mockDates,
  technicians: mockTechnicians,
  orderedTechnicians: mockTechnicians,
  fridgeSet: new Set(),
  allowDirectAssign: false,
  allowMarkUnavailable: false,
  mobile: false,
  canNavLeft: false,
  canNavRight: false,
  handleMobileNav: vi.fn(),
  handleDateHeadersScroll: vi.fn(),
  handleTechnicianScroll: vi.fn(),
  handleMainScroll: vi.fn(),
  cycleTechSort: vi.fn(),
  getSortLabel: () => '',
  isManagementUser: false,
  setCreateUserOpen: vi.fn(),
  createUserOpen: false,
  qc: { invalidateQueries: vi.fn() },
  setSortJobId: vi.fn(),
  getJobsForDate: () => mockJobs,
  getAssignmentForCell: () => null,
  getAvailabilityForCell: () => null,
  selectedCells: new Set(),
  staffingMaps: { byJob: new Map(), byDate: new Map() },
  handleCellSelect: vi.fn(),
  handleCellClick: vi.fn(),
  handleCellPrefetch: vi.fn(),
  handleOptimisticUpdate: vi.fn(),
  incrementCellRender: vi.fn(),
  declinedJobsByTech: new Map(),
  cellAction: null,
  currentTechnician: null,
  closeDialogs: vi.fn(),
  handleJobSelected: vi.fn(),
  handleStaffingActionSelected: vi.fn(),
  forcedStaffingAction: undefined,
  forcedStaffingChannel: undefined,
  jobs: mockJobs,
  offerChannel: 'email',
  toast: vi.fn(),
  sendStaffingEmail: vi.fn(),
  checkTimeConflictEnhanced: vi.fn(),
  availabilityDialog: null,
  setAvailabilityDialog: vi.fn(),
  availabilityCoverage: 'single',
  setAvailabilityCoverage: vi.fn(),
  availabilitySingleDate: null,
  setAvailabilitySingleDate: vi.fn(),
  availabilityMultiDates: [],
  setAvailabilityMultiDates: vi.fn(),
  availabilitySending: false,
  setAvailabilitySending: vi.fn(),
  handleEmailError: vi.fn(),
  conflictDialog: null,
  setConflictDialog: vi.fn(),
  isGlobalCellSelected: () => false,
  techMedalRankings: new Map(),
  techLastYearMedalRankings: new Map(),
  ...overrides,
});

beforeEach(() => {
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
    const props = createMockProps({ mobile: true, canNavLeft: true, canNavRight: true });
    render(<OptimizedAssignmentMatrixView {...props} />);

    const leftButton = screen.getByLabelText(/Fechas anteriores/i);
    const rightButton = screen.getByLabelText(/Fechas siguientes/i);

    expect(leftButton).toBeInTheDocument();
    expect(rightButton).toBeInTheDocument();
  });

  it('handles mobile navigation button clicks', async () => {
    const handleMobileNav = vi.fn();
    const props = createMockProps({
      mobile: true,
      canNavLeft: true,
      canNavRight: true,
      handleMobileNav,
    });
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

  it('shows SelectJobDialog when cellAction type is select-job', () => {
    const currentTechnician = mockTechnicians[0];
    const props = createMockProps({
      cellAction: { type: 'select-job', technicianId: 'tech-1', date: mockDates[0] },
      currentTechnician,
    });

    render(<OptimizedAssignmentMatrixView {...props} />);

    expect(screen.getByTestId('select-job-dialog')).toBeInTheDocument();
  });

  it('shows AssignJobDialog when cellAction type is assign', () => {
    const props = createMockProps({
      cellAction: { type: 'assign', technicianId: 'tech-1', date: mockDates[0] },
    });

    render(<OptimizedAssignmentMatrixView {...props} />);

    expect(screen.getByTestId('assign-job-dialog')).toBeInTheDocument();
  });

  it('shows MarkUnavailableDialog when cellAction type is unavailable', () => {
    const props = createMockProps({
      cellAction: { type: 'unavailable', technicianId: 'tech-1', date: mockDates[0] },
    });

    render(<OptimizedAssignmentMatrixView {...props} />);

    expect(screen.getByTestId('mark-unavailable-dialog')).toBeInTheDocument();
  });

  it('shows StaffingJobSelectionDialog when cellAction type is select-job-for-staffing', () => {
    const currentTechnician = mockTechnicians[0];
    const props = createMockProps({
      cellAction: { type: 'select-job-for-staffing', technicianId: 'tech-1', date: mockDates[0] },
      currentTechnician,
    });

    render(<OptimizedAssignmentMatrixView {...props} />);

    expect(screen.getByTestId('staffing-job-selection-dialog')).toBeInTheDocument();
  });

  it('shows OfferDetailsDialog when cellAction type is offer-details', () => {
    const currentTechnician = mockTechnicians[0];
    const props = createMockProps({
      cellAction: {
        type: 'offer-details',
        technicianId: 'tech-1',
        date: mockDates[0],
        selectedJobId: 'job-1',
      },
      currentTechnician,
    });

    render(<OptimizedAssignmentMatrixView {...props} />);

    expect(screen.getByTestId('offer-details-dialog')).toBeInTheDocument();
  });

  it('shows AssignmentStatusDialog for confirm action', () => {
    const props = createMockProps({
      cellAction: {
        type: 'confirm',
        technicianId: 'tech-1',
        date: mockDates[0],
        assignment: { job_id: 'job-1' },
      },
    });

    render(<OptimizedAssignmentMatrixView {...props} />);

    expect(screen.getByTestId('assignment-status-dialog')).toBeInTheDocument();
  });

  it('shows AssignmentStatusDialog for decline action', () => {
    const props = createMockProps({
      cellAction: {
        type: 'decline',
        technicianId: 'tech-1',
        date: mockDates[0],
        assignment: { job_id: 'job-1' },
      },
    });

    render(<OptimizedAssignmentMatrixView {...props} />);

    expect(screen.getByTestId('assignment-status-dialog')).toBeInTheDocument();
  });

  it('shows CreateUserDialog when createUserOpen is true', () => {
    const props = createMockProps({ createUserOpen: true, isManagementUser: true });
    render(<OptimizedAssignmentMatrixView {...props} />);

    expect(screen.getByTestId('create-user-dialog')).toBeInTheDocument();
  });

  it('opens availability dialog when availabilityDialog is set', () => {
    const props = createMockProps({
      availabilityDialog: {
        open: true,
        jobId: 'job-1',
        profileId: 'tech-1',
        dateIso: '2024-05-01',
        singleDay: true,
        channel: 'email',
      },
      currentTechnician: mockTechnicians[0],
    });

    render(<OptimizedAssignmentMatrixView {...props} />);

    expect(screen.getByText(/Enviar solicitud de disponibilidad/i)).toBeInTheDocument();
  });

  it('opens conflict dialog when conflictDialog is set', () => {
    const props = createMockProps({
      conflictDialog: {
        open: true,
        details: {
          conflicts: [
            {
              job_name: 'Overlapping Event',
              job_type: 'festival',
              start_time: '2024-05-01T10:00:00Z',
              end_time: '2024-05-01T20:00:00Z',
            },
          ],
          unavailability: [],
        },
        originalPayload: {},
      },
    });

    render(<OptimizedAssignmentMatrixView {...props} />);

    expect(screen.getByText(/Conflicto de agenda detectado/i)).toBeInTheDocument();
    expect(screen.getByText('Overlapping Event')).toBeInTheDocument();
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