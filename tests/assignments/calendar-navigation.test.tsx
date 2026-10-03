// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Calendar } from '@/components/ui/calendar';
import { navigateCalendarMonth } from './helpers/navigateCalendarMonth';

describe('fixture calendar navigation', () => {
  afterEach(cleanup);
  it.each([new Date(2026, 9, 1), new Date(2027, 10, 1), new Date(2030, 1, 1), new Date(2027, 9, 1)])(
    'reaches October 2027 from %s through actual picker controls', async current => {
      render(<Calendar defaultMonth={current} />);
      await navigateCalendarMonth(userEvent.setup(), new Date(2027, 9, 1));
      expect(screen.getByText('October 2027')).toBeInTheDocument();
    });
});
