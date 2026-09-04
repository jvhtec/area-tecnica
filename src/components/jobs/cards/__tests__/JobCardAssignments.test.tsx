// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { JobCardAssignments } from '@/components/jobs/cards/JobCardAssignments';
import { TooltipProvider } from '@/components/ui/tooltip';

describe('JobCardAssignments', () => {
  it('falls through empty role fields when showing a cross-department assignment', () => {
    render(
      <TooltipProvider>
        <JobCardAssignments
          department="production"
          assignments={[
            {
              id: 'assignment-1',
              technician_id: 'tech-1',
              sound_role: '',
              lights_role: 'LGT-BRD-E',
              video_role: null,
              profiles: [{ first_name: 'Ana', last_name: 'Luces' }],
            },
          ]}
        />
      </TooltipProvider>
    );

    expect(screen.getByText(/Ana Luces/)).toHaveTextContent('Mesa — Especialista');
  });
});
