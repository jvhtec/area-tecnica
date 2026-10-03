import { differenceInCalendarMonths, format, parse } from 'date-fns';
import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/** Navigate the rendered picker without changing the real Auth/HTTP clock. */
export async function navigateCalendarMonth(user: Pick<UserEvent, 'click'>, target: Date) {
  const caption = screen.getByText(/^[A-Z][a-z]+ \d{4}$/).textContent!;
  const current = parse(caption, 'MMMM yyyy', new Date(2000, 0, 1));
  const distance = differenceInCalendarMonths(target, current);
  if (!Number.isFinite(distance)) throw new Error(`Unrecognized calendar caption: ${caption}`);
  const name = distance > 0 ? 'Go to next month' : 'Go to previous month';
  for (let month = 0; month < Math.abs(distance); month++) {
    await user.click(screen.getByRole('button', { name }));
  }
  screen.getByText(format(target, 'MMMM yyyy'));
}
