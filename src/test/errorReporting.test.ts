import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reportBug, reportError, reportException } from '@/services/errorReporting';

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'test-user-id' } }, error: null })),
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  },
}));

// Mock navigator
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'Mozilla/5.0 (Test Browser)',
  },
  writable: true,
});

describe('Error Reporting Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should report a bug with correct structure', async () => {
    const result = await reportBug('Test bug description', 'HIGH');
    expect(result.success).toBe(true);
  });

  it('should report an error with enriched context', async () => {
    const result = await reportError({
      system: 'test_system',
      errorType: 'test_error',
      errorMessage: 'Test error message',
      context: {
        severity: 'MEDIUM',
      },
    });
    expect(result.success).toBe(true);
  });

  it('should report an exception with stack trace', async () => {
    const testError = new Error('Test exception');
    const result = await reportException(testError, { additionalInfo: 'test' });
    expect(result.success).toBe(true);
  });

  it('should handle reporting errors gracefully', async () => {
    // Override mock to simulate error
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockReturnValueOnce({
      insert: vi.fn(() => Promise.resolve({ data: null, error: new Error('DB Error') })),
    } as any);

    const result = await reportBug('Test bug');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
