// @vitest-environment jsdom
import React, { type ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MatrixMobileCellSheet } from '@/components/matrix/MatrixMobileCellSheet';

const { checkMultiDateAssignment } = vi.hoisted(() => ({ checkMultiDateAssignment: vi.fn() }));

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => true }));
vi.mock('@/components/matrix/optimized-matrix-cell/useMatrixCellAssignmentRemoval', () => ({
  useMatrixCellAssignmentRemoval: () => ({
    multiDateRemoval: { isOpen: false, isLoading: false, otherDates: [], otherDatesCount: 0, currentDate: null, removeOption: 'single', stateToken: null },
    setMultiDateRemoval: vi.fn(),
    isRemovingAssignment: false,
    checkMultiDateAssignment,
    handleRemoveAssignment: vi.fn(),
  }),
}));

type SheetProps = ComponentProps<typeof MatrixMobileCellSheet>;
const props: SheetProps = {
  target: {
    technician: { id: 'tech-1', first_name: 'Ana', last_name: 'Pérez', department: 'sound' },
    date: new Date('2026-10-01T12:00:00Z'),
  },
  onClose: vi.fn(),
  onAction: vi.fn(),
  selectedDateCount: 1,
  allowDirectAssign: false,
  canMarkUnavailable: false,
  isFridge: false,
  sendStaffingEmail: vi.fn(),
  cancelStaffing: vi.fn(),
};

const expectNoStaffingControls = () => {
  expect(screen.queryByRole('region', { name: 'Staffing' })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Solicitudes en curso' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^(Pedir disponibilidad|Enviar oferta|Reenviar|Cancelar)/i })).not.toBeInTheDocument();
};

describe('MatrixMobileCellSheet declined staffing', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    { availability_status: 'declined', offer_status: null },
    { availability_status: 'confirmed', offer_status: 'declined' },
    { availability_status: 'declined', offer_status: 'pending' },
    { availability_status: 'pending', offer_status: 'declined' },
    { availability_status: 'declined', offer_status: 'declined' },
  ])('hides every staffing control when either phase is declined: %j', (staffingStatus) => {
    render(<MatrixMobileCellSheet {...props} staffingStatus={{ ...staffingStatus, availability_job_title: 'Concierto' }} />);

    expectNoStaffingControls();
    expect(screen.getByText('Concierto')).toBeInTheDocument();
    if (!staffingStatus.offer_status || staffingStatus.offer_status === 'declined') {
      expect(screen.getByText(/Rechazada/)).toBeInTheDocument();
    }
    expect(props.onAction).not.toHaveBeenCalled();
    expect(props.sendStaffingEmail).not.toHaveBeenCalled();
    expect(props.cancelStaffing).not.toHaveBeenCalled();
  });

  it('keeps assignment and generic unavailability actions for a declined staffing cell', () => {
    render(<MatrixMobileCellSheet {...props} allowDirectAssign canMarkUnavailable staffingStatus={{ availability_status: 'declined', offer_status: null }} />);

    expectNoStaffingControls();
    expect(screen.getByRole('button', { name: /Asignar a un trabajo/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como no disponible' }));
    expect(props.onAction).toHaveBeenCalledWith('unavailable', undefined);
  });

  it('keeps confirm, edit and remove actions for an assignment with declined staffing', () => {
    render(<MatrixMobileCellSheet
      {...props}
      allowDirectAssign
      assignment={{ job_id: 'job-1', status: 'invited', job: { title: 'Concierto' } }}
      staffingStatus={{ availability_status: 'declined', offer_status: 'pending' }}
    />);

    expectNoStaffingControls();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar asignación' }));
    expect(props.onAction).toHaveBeenLastCalledWith('confirm', undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Editar asignación' }));
    expect(props.onAction).toHaveBeenLastCalledWith('assign', undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar asignación' }));
    expect(checkMultiDateAssignment).toHaveBeenCalledTimes(1);
    expect(props.cancelStaffing).not.toHaveBeenCalled();
  });

  it.each(['pending', 'confirmed', 'expired'])('keeps non-declined staffing and in-flight controls for %s', (status) => {
    render(<MatrixMobileCellSheet {...props} staffingStatus={{ availability_status: status, offer_status: status }} />);

    expect(screen.getByRole('button', { name: /Enviar oferta por WhatsApp/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar oferta por email/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reenviar solicitud de disponibilidad' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar solicitud de disponibilidad' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reenviar oferta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar oferta' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pedir disponibilidad por email/ }) !== null).toBe(status !== 'confirmed');
  });

  it('updates the open sheet when staffing changes from pending to declined', () => {
    const rendered = render(<MatrixMobileCellSheet {...props} staffingStatus={{ availability_status: 'pending', offer_status: null }} />);
    expect(screen.getByRole('button', { name: 'Reenviar solicitud de disponibilidad' })).toBeInTheDocument();

    rendered.rerender(<MatrixMobileCellSheet {...props} staffingStatus={{ availability_status: 'declined', offer_status: null }} />);

    expectNoStaffingControls();
    expect(screen.getByText('Disponibilidad: Rechazada')).toBeInTheDocument();
  });
});
