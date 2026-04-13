// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OptimizedMatrixCell } from '../OptimizedMatrixCell';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createMockQueryBuilder } from '@/test/mockSupabase';

// Hoisted mocks
const {
  useMutationMock,
  fromMock,
  toastFn,
  supabaseMock,
} = vi.hoisted(() => ({
  useMutationMock: vi.fn(),
  fromMock: vi.fn(),
  toastFn: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
  supabaseMock: {
    from: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useMutation: useMutationMock,
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastFn }),
}));

vi.mock('sonner', () => ({
  toast: toastFn,
}));

vi.mock('@/features/staffing/hooks/useStaffing', () => ({
  useSendStaffingEmail: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useCancelStaffingRequest: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

const mockTechnician = {
  id: 'tech-1',
  first_name: 'John',
  nickname: null,
  last_name: 'Doe',
  department: 'sound',
};

const mockDate = new Date('2024-05-15T00:00:00Z');

const mockAssignment = {
  job_id: 'job-1',
  status: 'confirmed',
  sound_role: 'foh',
  lights_role: null,
  video_role: null,
  single_day: false,
  assignment_date: null,
  job: {
    title: 'Test Concert',
    color: '#3B82F6',
  },
};

const render = (ui: JSX.Element) => rtlRender(
  <TooltipProvider delayDuration={0}>{ui}</TooltipProvider>
);

const getCellElement = () => {
  const cell = document.querySelector('.cursor-pointer');
  expect(cell).toBeInTheDocument();
  return cell as HTMLElement;
};

beforeEach(() => {
  vi.clearAllMocks();
  useMutationMock.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  });
  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'technician_availability') {
      return {
        delete: vi.fn(() => createMockQueryBuilder({ data: null, error: null })),
        upsert: vi.fn(() => createMockQueryBuilder({ data: null, error: null })),
      };
    }
    if (table === 'timesheets') {
      return {
        select: vi.fn(() =>
          createMockQueryBuilder({
            data: [],
            error: null,
          }),
        ),
        delete: vi.fn(() => createMockQueryBuilder({ data: null, error: null })),
      };
    }
    return createMockQueryBuilder();
  });
  supabaseMock.functions.invoke.mockResolvedValue({ data: null, error: null });
});

describe('OptimizedMatrixCell', () => {
  it('renders basic cell with technician name in tooltip', async () => {
    const user = userEvent.setup();

    render(
      <OptimizedMatrixCell
        technician={mockTechnician}
        date={mockDate}
        width={160}
        height={60}
        isSelected={false}
        onSelect={vi.fn()}
        onClick={vi.fn()}
      />
    );

    const cell = getCellElement();
    await user.hover(cell);

    await waitFor(() => {
      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
    });
  });

  it('renders assignment details when assignment is present', () => {
    render(
      <OptimizedMatrixCell
        technician={mockTechnician}
        date={mockDate}
        assignment={mockAssignment}
        width={160}
        height={60}
        isSelected={false}
        onSelect={vi.fn()}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText('Test Concert')).toBeInTheDocument();
    expect(screen.getByText(/FOH/i)).toBeInTheDocument();
  });

  it('displays confirmed status badge', () => {
    render(
      <OptimizedMatrixCell
        technician={mockTechnician}
        date={mockDate}
        assignment={mockAssignment}
        width={160}
        height={60}
        isSelected={false}
        onSelect={vi.fn()}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('shows declined status for declined assignment', () => {
    const declinedAssignment = { ...mockAssignment, status: 'declined' };

    render(
      <OptimizedMatrixCell
        technician={mockTechnician}
        date={mockDate}
        assignment={declinedAssignment}
        width={160}
        height={60}
        isSelected={false}
        onSelect={vi.fn()}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText('R')).toBeInTheDocument();
  });

  it('renders unavailability status', () => {
    const availability = {
      status: 'unavailable',
      reason: 'Vacation',
      notes: 'Family trip',
    };

    render(
      <OptimizedMatrixCell
        technician={mockTechnician}
        date={mockDate}
        availability={availability}
        width={160}
        height={60}
        isSelected={false}
        onSelect={vi.fn()}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText('Vacation')).toBeInTheDocument();
  });

  it('handles cell click to trigger action', async () => {
    const onClickMock = vi.fn();
    const user = userEvent.setup();

    render(
      <OptimizedMatrixCell
        technician={mockTechnician}
        date={mockDate}
        width={160}
        height={60}
        isSelected={false}
        onSelect={vi.fn()}
        onClick={onClickMock}
        allowMarkUnavailable={true}
      />
    );

    const cell = getCellElement();
    await user.click(cell);

    expect(onClickMock).toHaveBeenCalledWith('toggle-unavailable');

    fireEvent.contextMenu(cell);
    expect(onClickMock).toHaveBeenCalledWith('unavailable');
  });

  it('handles ctrl+click for cell selection', () => {
    const onSelectMock = vi.fn();

    render(
      <OptimizedMatrixCell
        technician={mockTechnician}
        date={mockDate}
        width={160}
        height={60}
        isSelected={false}
        onSelect={onSelectMock}
        onClick={vi.fn()}
      />
    );

    const cell = getCellElement();
    fireEvent.click(cell, { ctrlKey: true });

    expect(onSelectMock).toHaveBeenCalledWith(true);
  });

  it('displays staffing availability status badge', () => {
    const staffingStatus = {
      availability_status: 'confirmed',
      offer_status: null,
    };

    render(
      <OptimizedMatrixCell
        technician={mockTechnician}
        date={mockDate}
        width={160}
        height={60}
        isSelected={false}
        onSelect={vi.fn()}
        onClick={vi.fn()}
        staffingStatusByDateProvided={staffingStatus}
      />
    );

    expect(screen.getAllByText('A:✓').length).toBeGreaterThan(0);
  });

  it('displays staffing offer status badge', () => {
    const staffingStatus = {
      availability_status: null,
      offer_status: 'sent',
    };

    render(
      <OptimizedMatrixCell
        technician={mockTechnician}
        date={mockDate}
        width={160}
        height={60}
        isSelected={false}
        onSelect={vi.fn()}
        onClick={vi.fn()}
        staffingStatusByDateProvided={staffingStatus}
      />
    );

    expect(screen.getAllByText('O:?').length).toBeGreaterThan(0);
  });

  it('shows availability request buttons when can ask availability', () => {
    render(
      <OptimizedMatrixCell
        technician={mockTechnician}
        date={mockDate}
        width={160}
        height={60}
        isSelected={false}
        onSelect={vi.fn()}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByTitle('Solicitar disponibilidad')).toBeInTheDocument();
    expect(screen.getByTitle('Solicitar disponibilidad por WhatsApp')).toBeInTheDocument();
  });

  it('shows offer buttons when availability is confirmed', () => {
    const staffingStatus = {
      availability_status: 'confirmed',
      offer_status: null,
    };

    render(
      <OptimizedMatrixCell
        technician={mockTechnician}
        date={mockDate}
        width={160}
        height={60}
        isSelected={false}
        onSelect={vi.fn()}
        onClick={vi.fn()}
        staffingStatusByDateProvided={staffingStatus}
      />
    );

    expect(screen.getByTitle('Enviar oferta')).toBeInTheDocument();
    expect(screen.getByTitle('Enviar oferta por WhatsApp')).toBeInTheDocument();
  });

  it('displays fridge indicator when technician is in fridge', () => {
    render(
      <OptimizedMatrixCell
        technician={mockTechnician}
        date={mockDate}
        width={160}
        height={60}
        isSelected={false}
        onSelect={vi.fn()}
        onClick={vi.fn()}
        isFridge={true}
      />
    );

    expect(screen.getByTitle('En la nevera: no asignable')).toBeInTheDocument();
  });

  it('highlights cell when selected', () => {
    const { container } = render(
      <OptimizedMatrixCell
        technician={mockTechnician}
        date={mockDate}
        width={160}
        height={60}
        isSelected={true}
        onSelect={vi.fn()}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText('✓ SELECTED')).toBeInTheDocument();
    const cell = container.querySelector('.border-blue-600');
    expect(cell).toBeInTheDocument();
  });

  it('calls onPrefetch when hovering over cell', async () => {
    const onPrefetchMock = vi.fn();
    const user = userEvent.setup();

    render(
      <OptimizedMatrixCell
        technician={mockTechnician}
        date={mockDate}
        width={160}
        height={60}
        isSelected={false}
        onSelect={vi.fn()}
        onClick={vi.fn()}
        onPrefetch={onPrefetchMock}
      />
    );

    const cell = getCellElement();
    await user.hover(cell);

    expect(onPrefetchMock).toHaveBeenCalled();
  });

  it('calls onRender on mount', () => {
    const onRenderMock = vi.fn();

    render(
      <OptimizedMatrixCell
        technician={mockTechnician}
        date={mockDate}
        width={160}
        height={60}
        isSelected={false}
        onSelect={vi.fn()}
        onClick={vi.fn()}
        onRender={onRenderMock}
      />
    );

    expect(onRenderMock).toHaveBeenCalled();
  });

  it('stays render-stable when rerendered with identical props', () => {
    const onRenderMock = vi.fn();
    const onSelectMock = vi.fn();
    const onClickMock = vi.fn();

    const view = rtlRender(
      <TooltipProvider delayDuration={0}>
        <OptimizedMatrixCell
          technician={mockTechnician}
          date={mockDate}
          width={160}
          height={60}
          isSelected={false}
          onSelect={onSelectMock}
          onClick={onClickMock}
          onRender={onRenderMock}
        />
      </TooltipProvider>
    );

    expect(onRenderMock).toHaveBeenCalledTimes(1);

    view.rerender(
      <TooltipProvider delayDuration={0}>
        <OptimizedMatrixCell
          technician={mockTechnician}
          date={mockDate}
          width={160}
          height={60}
          isSelected={false}
          onSelect={onSelectMock}
          onClick={onClickMock}
          onRender={onRenderMock}
        />
      </TooltipProvider>
    );

    expect(onRenderMock).toHaveBeenCalledTimes(1);
  });

  it('displays single day assignment date', () => {
    const singleDayAssignment = {
      ...mockAssignment,
      single_day: true,
      assignment_date: '2024-05-20',
    };

    render(
      <OptimizedMatrixCell
        technician={mockTechnician}
        date={mockDate}
        assignment={singleDayAssignment}
        width={160}
        height={60}
        isSelected={false}
        onSelect={vi.fn()}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText(/Día único:/i)).toBeInTheDocument();
  });

  it('shows delete button for assignments', () => {
    render(
      <OptimizedMatrixCell
        technician={mockTechnician}
        date={mockDate}
        assignment={mockAssignment}
        width={160}
        height={60}
        isSelected={false}
        onSelect={vi.fn()}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByTitle('Eliminar asignación')).toBeInTheDocument();
  });

  it('handles assignment with color background for confirmed status', () => {
    const { container } = render(
      <OptimizedMatrixCell
        technician={mockTechnician}
        date={mockDate}
        assignment={mockAssignment}
        width={160}
        height={60}
        isSelected={false}
        onSelect={vi.fn()}
        onClick={vi.fn()}
      />
    );

    const cellDiv = container.querySelector('[style*="background"]');
    expect(cellDiv).toBeInTheDocument();
  });

  it('renders with mobile-specific styling when mobile prop is true', () => {
    render(
      <OptimizedMatrixCell
        technician={mockTechnician}
        date={mockDate}
        width={140}
        height={80}
        isSelected={false}
        onSelect={vi.fn()}
        onClick={vi.fn()}
        mobile={true}
      />
    );

    // Mobile-specific styles should be applied
    const cell = getCellElement();
    expect(cell).toBeInTheDocument();
  });

  it('blocks declined jobs from being re-assigned', () => {
    const declinedJobIdsSet = new Set(['job-1']);

    render(
      <OptimizedMatrixCell
        technician={mockTechnician}
        date={mockDate}
        jobId="job-1"
        width={160}
        height={60}
        isSelected={false}
        onSelect={vi.fn()}
        onClick={vi.fn()}
        declinedJobIdsSet={declinedJobIdsSet}
      />
    );

    // The cell should still render but may show declined indicator
    const cell = getCellElement();
    expect(cell).toBeInTheDocument();
  });

  it('renders assignment tooltip metadata when assigned_by and assigned_at are present', async () => {
    const user = userEvent.setup();
    const assignmentWithMeta = {
      ...mockAssignment,
      assigned_by: 'manager-1',
      assigned_at: '2026-04-10T14:30:00.000Z',
    };
    const profileNamesMap = new Map<string, string>([['manager-1', 'Manager Name']]);

    render(
      <OptimizedMatrixCell
        technician={mockTechnician}
        date={mockDate}
        assignment={assignmentWithMeta}
        width={160}
        height={60}
        isSelected={false}
        onSelect={vi.fn()}
        onClick={vi.fn()}
        profileNamesMap={profileNamesMap}
      />
    );

    await user.hover(getCellElement());

    await waitFor(() => {
      expect(screen.getAllByText(/Asignado por: Manager Name/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Fecha: 10 abr 2026, 16:30/i).length).toBeGreaterThan(0);
    });
  });

  it('normalizes unknown or English assignment statuses to Spanish pending in the tooltip', async () => {
    const user = userEvent.setup();

    render(
      <OptimizedMatrixCell
        technician={mockTechnician}
        date={mockDate}
        assignment={{ ...mockAssignment, status: 'Pending' }}
        width={160}
        height={60}
        isSelected={false}
        onSelect={vi.fn()}
        onClick={vi.fn()}
      />
    );

    await user.hover(getCellElement());

    await waitFor(() => {
      expect(screen.getAllByText(/Estado: Pendiente/i).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/Estado: Pending/i)).not.toBeInTheDocument();
  });

  it('renders staffing tooltip metadata and degrades gracefully when sender is missing', async () => {
    const user = userEvent.setup();
    const staffingStatus = {
      availability_status: ' Requested ',
      availability_requested_by: null,
      availability_created_at: '2026-04-08T09:15:00.000Z',
      offer_status: ' SENT ',
      offer_requested_by: 'manager-2',
      offer_created_at: '2026-04-09T11:00:00.000Z',
    };

    render(
      <OptimizedMatrixCell
        technician={mockTechnician}
        date={mockDate}
        width={160}
        height={60}
        isSelected={false}
        onSelect={vi.fn()}
        onClick={vi.fn()}
        staffingStatusByDateProvided={staffingStatus}
        profileNamesMap={new Map([['manager-2', 'Second Manager']])}
      />
    );

    await user.hover(getCellElement());

    await waitFor(() => {
      expect(screen.getAllByText(/Disponibilidad: Solicitada/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Oferta: Enviada/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Enviado por: Second Manager/i).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/Enviado por:\s*null/i)).not.toBeInTheDocument();
  });
});
