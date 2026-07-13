// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DateHeader } from '@/components/matrix/DateHeader';
import { MATRIX_JOB_DRAG_MIME } from '@/components/matrix/dnd/constants';

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn(({ queryKey }) => queryKey.includes('matrix-open-slots')
      ? { data: { required: 1, assigned: 0, open: 1 } }
      : { data: 0 }),
  };
});

describe('DateHeader job dragging', () => {
  it('makes the popover transparent to pointer events while dragging a job', async () => {
    const user = userEvent.setup();
    render(
      <DateHeader
        date={new Date('2026-07-15T10:00:00Z')}
        width={160}
        dragEnabled={true}
        jobs={[{
          id: 'job-1',
          title: 'Festival',
          start_time: '2026-07-15T10:00:00Z',
          end_time: '2026-07-15T22:00:00Z',
          status: 'Confirmado',
        }]}
      />,
    );

    await user.click(screen.getByText('15'));
    const jobChip = screen.getByTitle('Haz clic para ordenar técnicos, o arrastra a una celda para asignar');
    const setData = vi.fn();
    fireEvent.dragStart(jobChip, {
      dataTransfer: { effectAllowed: 'none', setData },
    });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('pointer-events-none', 'opacity-0');
    expect(setData).toHaveBeenCalledWith(MATRIX_JOB_DRAG_MIME, 'job-1');

    fireEvent.dragEnd(jobChip);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
