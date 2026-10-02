// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { OptimizedMatrixCell } from '@/components/matrix/OptimizedMatrixCell';
import { MatrixMobileCellSheet } from '@/components/matrix/MatrixMobileCellSheet';
import { confirmRequest, sendRequest, StaffingDatabase } from '../../../../supabase/functions/send-staffing-email/__tests__/staffingHandlerHarness';

vi.mock('@/components/matrix/optimized-matrix-cell/useMatrixCellAssignmentRemoval', () => ({
  useMatrixCellAssignmentRemoval: () => ({
    multiDateRemoval: { isOpen: false, isLoading: false, otherDates: [], otherDatesCount: 0, currentDate: null, removeOption: 'single' },
    setMultiDateRemoval: vi.fn(), isRemovingAssignment: false,
    checkMultiDateAssignment: vi.fn(), handleRemoveAssignment: vi.fn(),
  }),
}));

describe('matrix availability resend through the real sender', () => {
  it.each(['desktop', 'mobile'])('resends the original complete cycle from one %s cell', async viewport => {
    const db = new StaffingDatabase();
    expect((await sendRequest(db, { phase: 'availability' })).status).toBe(200);
    const original = structuredClone(db.tables.staffing_requests);
    db.tables.jobs[0].end_time = '2026-10-23T18:00:00Z';
    const staffing = { availability_status: 'requested', offer_status: null,
      availability_job_id: 'job', availability_request_id: String(original[1].id), availability_job_title: 'Bolo' };
    const technician = { id: 'tech', first_name: 'Ana', last_name: 'Pérez', department: 'sound' };
    const date = new Date('2026-10-21T12:00:00Z');
    const send = vi.fn();
    if (viewport === 'desktop') {
      render(<TooltipProvider><OptimizedMatrixCell technician={technician} date={date}
        width={160} height={60} isSelected={false} onSelect={vi.fn()} onClick={vi.fn()}
        staffingStatusByDateProvided={staffing} sendStaffingEmail={send} cancelStaffing={vi.fn()} /></TooltipProvider>);
      fireEvent.click(screen.getByRole('button', { name: 'A:?' }));
    } else {
      render(<MatrixMobileCellSheet target={{ technician, date }} onClose={vi.fn()} onAction={vi.fn()}
        selectedDateCount={1} allowDirectAssign={false} canMarkUnavailable={false} isFridge={false}
        staffingStatus={staffing} sendStaffingEmail={send} cancelStaffing={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Reenviar solicitud de disponibilidad' }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar' }));
    const payload = send.mock.calls[0][0];
    expect(payload).toMatchObject({ resend_request_id: original[1].id, phase: 'availability' });
    expect(payload).not.toHaveProperty('target_date');
    expect((await sendRequest(db, payload)).status).toBe(200);
    expect(db.deliveries).toHaveLength(2);
    expect(db.tables.staffing_requests.map(row => [row.id, row.target_date, row.batch_id]))
      .toEqual(original.map(row => [row.id, row.target_date, row.batch_id]));
    await confirmRequest(db);
    expect(db.tables.staffing_requests.every(row => row.status === 'confirmed')).toBe(true);
    expect(db.tables.job_assignments).toHaveLength(0);
  });
});
