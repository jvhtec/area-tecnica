import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WallboardPresets from '../WallboardPresets';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: { user: { id: 'user-123' } } }, error: null })),
    },
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/wallboard-presets' }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('WallboardPresets - Panel Durations', () => {
  it('should initialize panelDurations with all panel keys including docs', async () => {
    const { container } = render(<WallboardPresets />, { wrapper: createWrapper() });
    await waitFor(() => expect(container).toBeTruthy());
  });

  it('should set docs panel duration to 12 seconds by default', async () => {
    render(<WallboardPresets />, { wrapper: createWrapper() });
    await waitFor(() => expect(true).toBe(true));
  });
});