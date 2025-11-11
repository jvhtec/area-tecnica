import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('../hooks/usePersonalCalendarData', () => ({
  usePersonalCalendarData: vi.fn(),
}));

vi.mock('../hooks/useTechnicianAvailability', () => ({
  useTechnicianAvailability: vi.fn(),
}));

vi.mock('../TechContextMenu', () => ({
  TechContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/dashboard/PrintDialog', () => ({
  PrintDialog: () => null,
  PrintSettings: {} as any,
}));

import { usePersonalCalendarData } from '../hooks/usePersonalCalendarData';
import { useTechnicianAvailability } from '../hooks/useTechnicianAvailability';
import { MobilePersonalCalendar } from '../MobilePersonalCalendar';

afterEach(() => {
  vi.clearAllMocks();
});

describe('MobilePersonalCalendar', () => {
  it('lists technician on weekend when assignment has only start time', () => {
    const jobStart = '2024-05-18T11:00:00.000Z';

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
      <MobilePersonalCalendar
        date={new Date('2024-05-18T00:00:00.000Z')}
        onDateSelect={vi.fn()}
      />
    );

    expect(screen.getByText('Alex Johnson')).toBeInTheDocument();
    expect(screen.getByText('On job')).toBeInTheDocument();
  });
});
