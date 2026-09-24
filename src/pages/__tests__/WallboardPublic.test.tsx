// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exchangeWallboardToken: vi.fn(),
  splashComplete: null as null | (() => void),
}));

vi.mock('@/lib/wallboard-api', () => ({
  exchangeWallboardToken: mocks.exchangeWallboardToken,
}));

vi.mock('@/components/SplashScreen', () => ({
  default: ({ onComplete }: { onComplete?: () => void }) => {
    mocks.splashComplete = onComplete ?? null;
    return <div data-testid="splash">Cargando</div>;
  },
}));

vi.mock('../Wallboard', () => ({
  WallboardDisplay: ({ wallboardApiToken }: { wallboardApiToken?: string }) => (
    <div data-testid="wallboard">{wallboardApiToken}</div>
  ),
}));

import WallboardPublic from '../WallboardPublic';

const renderPage = () => render(
  <MemoryRouter initialEntries={['/wallboard/public/shared/almacen']}>
    <Routes>
      <Route path="/wallboard/public/:token/:presetSlug" element={<WallboardPublic />} />
    </Routes>
  </MemoryRouter>,
);

describe('WallboardPublic', () => {
  beforeEach(() => {
    vi.useRealTimers();
    mocks.splashComplete = null;
    mocks.exchangeWallboardToken.mockReset();
  });

  afterEach(() => vi.useRealTimers());

  it('hides the splash once authentication finishes after the splash animation', async () => {
    let resolveExchange: ((value: { token: string; expiresIn: number }) => void) | undefined;
    mocks.exchangeWallboardToken.mockReturnValue(new Promise((resolve) => {
      resolveExchange = resolve;
    }));

    renderPage();
    act(() => mocks.splashComplete?.());
    expect(screen.getByTestId('splash')).toBeInTheDocument();

    await act(async () => {
      resolveExchange?.({ token: 'jwt-token', expiresIn: 3600 });
    });

    await waitFor(() => expect(screen.queryByTestId('splash')).not.toBeInTheDocument());
    expect(screen.getByTestId('wallboard')).toHaveTextContent('jwt-token');
  });

  it('renews the scoped token before it expires', async () => {
    vi.useFakeTimers();
    mocks.exchangeWallboardToken
      .mockResolvedValueOnce({ token: 'jwt-one', expiresIn: 90 })
      .mockResolvedValueOnce({ token: 'jwt-two', expiresIn: 90 });

    renderPage();
    await act(async () => Promise.resolve());
    expect(mocks.exchangeWallboardToken).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(mocks.exchangeWallboardToken).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('wallboard')).toHaveTextContent('jwt-two');
  });
});
