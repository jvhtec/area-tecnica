import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { clearBoundaryErrors, getBoundaryErrors } from '@/utils/errorTelemetry';

const TOGGLE: { throwOnRender: boolean } = { throwOnRender: true };

function Thrower({ message = 'boom' }: { message?: string }): React.ReactElement {
  if (TOGGLE.throwOnRender) {
    throw new Error(message);
  }
  return <div>child ok</div>;
}

describe('ErrorBoundary', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TOGGLE.throwOnRender = true;
    clearBoundaryErrors();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('renders children when no error is thrown', () => {
    TOGGLE.throwOnRender = false;
    render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>,
    );
    expect(screen.getByText('child ok')).toBeInTheDocument();
  });

  it('renders the default fallback when children throw', () => {
    render(
      <ErrorBoundary>
        <Thrower message="kaboom" />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /intentar de nuevo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recargar/i })).toBeInTheDocument();
  });

  it('resets without a full reload when the user clicks "Intentar de nuevo"', async () => {
    const user = userEvent.setup();
    render(
      <ErrorBoundary>
        <Thrower message="transient" />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();

    // Next render will succeed
    TOGGLE.throwOnRender = false;
    await user.click(screen.getByRole('button', { name: /intentar de nuevo/i }));

    expect(screen.getByText('child ok')).toBeInTheDocument();
  });

  it('renders null when silent and an error occurs', () => {
    const { container } = render(
      <ErrorBoundary silent>
        <Thrower />
      </ErrorBoundary>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('auto-resets when resetKeys change', () => {
    const { rerender } = render(
      <ErrorBoundary resetKeys={['a']}>
        <Thrower />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();

    TOGGLE.throwOnRender = false;
    act(() => {
      rerender(
        <ErrorBoundary resetKeys={['b']}>
          <Thrower />
        </ErrorBoundary>,
      );
    });

    expect(screen.getByText('child ok')).toBeInTheDocument();
  });

  it('records caught errors in telemetry with boundary name', () => {
    render(
      <ErrorBoundary boundaryName="test-zone">
        <Thrower message="telemetry-check" />
      </ErrorBoundary>,
    );

    const records = getBoundaryErrors();
    expect(records).toHaveLength(1);
    expect(records[0].boundary).toBe('test-zone');
    expect(records[0].message).toBe('telemetry-check');
  });

  it('invokes fallback render with error and reset callback', async () => {
    const user = userEvent.setup();
    const fallback = vi.fn(({ error, reset }) => (
      <div>
        <span data-testid="err">{error.message}</span>
        <button onClick={reset}>retry</button>
      </div>
    ));

    render(
      <ErrorBoundary fallback={fallback}>
        <Thrower message="custom" />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('err')).toHaveTextContent('custom');

    TOGGLE.throwOnRender = false;
    await user.click(screen.getByText('retry'));
    expect(screen.getByText('child ok')).toBeInTheDocument();
  });
});
