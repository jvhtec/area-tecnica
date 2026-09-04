import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TechContextMenu } from '@/components/personal/TechContextMenu';

const technician = {
  id: 'tech-1',
  first_name: 'Ana',
  last_name: 'Ruiz',
  department: 'sound',
};
const date = new Date('2026-09-04T12:00:00Z');

describe('TechContextMenu', () => {
  it('renders a read-only cell without installing an empty custom menu', () => {
    render(
      <TechContextMenu technician={technician} date={date}>
        <button type="button">Ana Ruiz</button>
      </TechContextMenu>,
    );

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Ana Ruiz' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.queryByText('Mark as Unavailable')).not.toBeInTheDocument();
  });

  it('keeps mutation actions available when handlers are provided', async () => {
    const onAvailabilityChange = vi.fn();
    const onAvailabilityRemove = vi.fn();
    render(
      <TechContextMenu
        technician={technician}
        date={date}
        onAvailabilityChange={onAvailabilityChange}
        onAvailabilityRemove={onAvailabilityRemove}
      >
        <button type="button">Ana Ruiz</button>
      </TechContextMenu>,
    );

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Ana Ruiz' }));

    expect(await screen.findByText('Mark as Unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Remove Override'));
    expect(onAvailabilityRemove).toHaveBeenCalledWith('tech-1', date);
  });
});
