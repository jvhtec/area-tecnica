// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useOptimizedAuth', () => ({ useOptimizedAuth: () => ({ userRole: 'management' }) }));

import { MatrixVersionSettings } from '@/components/settings/MatrixVersionSettings';

describe('MatrixVersionSettings', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, '', '/settings');
  });

  it('shows the new matrix as on for a manager who never chose, with no reset to offer', () => {
    render(<MatrixVersionSettings />);
    expect(screen.getByRole('switch', { name: 'Usar la nueva matriz de asignaciones' })).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Usar el valor por defecto' })).not.toBeInTheDocument();
  });

  it('turning it off goes back to the old matrix and offers the default again', async () => {
    const user = userEvent.setup();
    render(<MatrixVersionSettings />);
    await user.click(screen.getByRole('switch', { name: 'Usar la nueva matriz de asignaciones' }));
    expect(window.localStorage.getItem('matrix-v2')).toBe('v1');
    expect(screen.getByRole('switch', { name: 'Usar la nueva matriz de asignaciones' })).not.toBeChecked();
    expect(screen.getByText(/Elegiste la matriz anterior/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Usar el valor por defecto' }));
    expect(window.localStorage.getItem('matrix-v2')).toBeNull();
    expect(screen.getByRole('switch', { name: 'Usar la nueva matriz de asignaciones' })).toBeChecked();
  });
});
