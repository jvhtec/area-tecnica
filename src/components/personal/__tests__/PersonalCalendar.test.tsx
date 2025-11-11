import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('../hooks/usePersonalCalendarData', () => ({
  usePersonalCalendarData: vi.fn(),
}));

vi.mock('../hooks/useTechnicianAvailability', () => ({
  useTechnicianAvailability: vi.fn(),
}));

import { usePersonalCalendarData } from '../hooks/usePersonalCalendarData';
import { useTechnicianAvailability } from '../hooks/useTechnicianAvailability';
import { PersonalCalendar } from '../PersonalCalendar';

afterEach(() => {
  vi.clearAllMocks();
});

describe('PersonalCalendar', () => {
  it('renders technician assignment on weekend when job only has start time', () => {
    const jobStart = '2024-05-18T09:00:00.000Z';

    const mockedUsePersonalCalendarData = usePersonalCalendarData as unknown as Mock;
    const mockedUseTechnicianAvailability = useTechnicianAvailability as unknown as Mock;

    mockedUsePersonalCalendarData.mockReturnValue({
      houseTechs: [
        {
          id: 'tech-1',
          first_name: 'Alex',
          last_name: 'Johnson',
          department: 'sound',
          phone: '555-0101',
        },
      ],
      assignments: [
        {
          technician_id: 'tech-1',
          sound_role: 'foh',
          lights_role: null,
          video_role: null,
          job: {
            id: 'job-1',
            title: 'Main Event',
            color: '#123456',
            start_time: jobStart,
            end_time: jobStart,
            status: 'scheduled',
            location: { name: 'Auditorium' },
          },
        },
      ],
      vacationPeriods: [],
      isLoading: false,
    });

    mockedUseTechnicianAvailability.mockReturnValue({
      updateAvailability: vi.fn(),
      removeAvailability: vi.fn(),
      getAvailabilityStatus: vi.fn(() => null),
      isLoading: false,
    });

    render(
      <PersonalCalendar
        date={new Date('2024-05-01T00:00:00.000Z')}
        onDateSelect={vi.fn()}
      />
    );

    const findDayCell = (dayLabel: string) => {
      const daySpans = screen.getAllByText(dayLabel);
      const currentMonthSpan = daySpans.find(span => {
        const cell = span.closest('div.p-2');
        return cell && !cell.className.includes('text-muted-foreground/50');
      });
      const cell = currentMonthSpan?.closest('div.p-2');
      if (!cell) {
        throw new Error(`Day cell for ${dayLabel} not found`);
      }
      return cell as HTMLElement;
    };

    const saturdayCell = findDayCell('18');
    const sundayCell = findDayCell('19');

    expect(within(saturdayCell).getByText('AJ')).toBeInTheDocument();
    expect(() => within(sundayCell).getByText('AJ')).toThrow();
  });
});
