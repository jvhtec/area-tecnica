import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openFlexElement } from '../openFlexElement';
import * as buildFlexUrlModule from '../buildFlexUrl';

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

// Mock buildFlexUrlWithTypeDetection
vi.mock('../buildFlexUrl', async () => {
  const actual = await vi.importActual('../buildFlexUrl');
  return {
    ...actual,
    buildFlexUrlWithTypeDetection: vi.fn(),
  };
});

describe('openFlexElement', () => {
  let mockWindow: any;
  let mockPlaceholderWindow: any;

  beforeEach(() => {
    // Mock window.open
    mockPlaceholderWindow = {
      location: { href: '' },
      close: vi.fn(),
    };
    mockWindow = {
      open: vi.fn(() => mockPlaceholderWindow),
    };
    global.window = mockWindow as any;

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should open a placeholder window synchronously', async () => {
    const { supabase } = await import('@/lib/supabase');
    (supabase.functions.invoke as any).mockResolvedValue({
      data: { X_AUTH_TOKEN: 'test-token' },
      error: null,
    });

    vi.spyOn(buildFlexUrlModule, 'buildFlexUrlWithTypeDetection').mockResolvedValue(
      'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/test-id/view/simple-element/header'
    );

    await openFlexElement({
      elementId: 'test-id',
    });

    // Verify window.open was called synchronously with about:blank
    expect(mockWindow.open).toHaveBeenCalledWith('about:blank', '_blank', 'noopener,noreferrer');
  });

  it('should fetch auth token and build URL with type detection', async () => {
    const { supabase } = await import('@/lib/supabase');
    (supabase.functions.invoke as any).mockResolvedValue({
      data: { X_AUTH_TOKEN: 'test-token' },
      error: null,
    });

    const mockUrl = 'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/test-id/view/simple-element/header';
    vi.spyOn(buildFlexUrlModule, 'buildFlexUrlWithTypeDetection').mockResolvedValue(mockUrl);

    await openFlexElement({
      elementId: 'test-id',
      context: { jobType: 'single' },
    });

    // Verify auth token was fetched
    expect(supabase.functions.invoke).toHaveBeenCalledWith('get-secret', {
      body: { secretName: 'X_AUTH_TOKEN' },
    });

    // Verify URL was built with correct parameters
    expect(buildFlexUrlModule.buildFlexUrlWithTypeDetection).toHaveBeenCalledWith(
      'test-id',
      'test-token',
      { jobType: 'single' }
    );

    // Verify placeholder window location was updated
    expect(mockPlaceholderWindow.location.href).toBe(mockUrl);
  });

  it('should use fallback URL when auth token fetch fails', async () => {
    const { supabase } = await import('@/lib/supabase');
    (supabase.functions.invoke as any).mockResolvedValue({
      data: {},
      error: new Error('Auth failed'),
    });

    const onWarning = vi.fn();

    await openFlexElement({
      elementId: 'test-id',
      onWarning,
    });

    // Verify fallback URL was used
    expect(mockPlaceholderWindow.location.href).toBe(
      'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/test-id/view/simple-element/header'
    );

    // Verify warning callback was called
    expect(onWarning).toHaveBeenCalledWith('Opened with fallback URL format (authentication failed)');
  });

  it('should use fallback URL when buildFlexUrlWithTypeDetection throws', async () => {
    const { supabase } = await import('@/lib/supabase');
    (supabase.functions.invoke as any).mockResolvedValue({
      data: { X_AUTH_TOKEN: 'test-token' },
      error: null,
    });

    vi.spyOn(buildFlexUrlModule, 'buildFlexUrlWithTypeDetection').mockRejectedValue(
      new Error('API error')
    );

    const onWarning = vi.fn();

    await openFlexElement({
      elementId: 'test-id',
      onWarning,
    });

    // Verify fallback URL was used
    expect(mockPlaceholderWindow.location.href).toBe(
      'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/test-id/view/simple-element/header'
    );

    // Verify warning callback was called
    expect(onWarning).toHaveBeenCalledWith('Opened with fallback URL format (error occurred)');
  });

  it('should call onError when popup is blocked', async () => {
    // Mock window.open to return null (popup blocked)
    mockWindow.open = vi.fn(() => null);

    const onError = vi.fn();

    await openFlexElement({
      elementId: 'test-id',
      onError,
    });

    // Verify error callback was called
    expect(onError).toHaveBeenCalled();
    const error = onError.mock.calls[0][0];
    expect(error.message).toContain('Pop-up blocked');
  });

  it('should pass context to buildFlexUrlWithTypeDetection', async () => {
    const { supabase } = await import('@/lib/supabase');
    (supabase.functions.invoke as any).mockResolvedValue({
      data: { X_AUTH_TOKEN: 'test-token' },
      error: null,
    });

    const mockUrl = 'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/test-id/view/simple-element/header';
    vi.spyOn(buildFlexUrlModule, 'buildFlexUrlWithTypeDetection').mockResolvedValue(mockUrl);

    const context = {
      jobType: 'dryhire' as const,
      folderType: 'dryhire' as const,
    };

    await openFlexElement({
      elementId: 'test-id',
      context,
    });

    // Verify context was passed through
    expect(buildFlexUrlModule.buildFlexUrlWithTypeDetection).toHaveBeenCalledWith(
      'test-id',
      'test-token',
      context
    );
  });

  it('should handle window.close gracefully when setting location fails', async () => {
    const { supabase } = await import('@/lib/supabase');
    (supabase.functions.invoke as any).mockResolvedValue({
      data: { X_AUTH_TOKEN: 'test-token' },
      error: null,
    });

    vi.spyOn(buildFlexUrlModule, 'buildFlexUrlWithTypeDetection').mockRejectedValue(
      new Error('API error')
    );

    // Make setting location.href throw
    Object.defineProperty(mockPlaceholderWindow.location, 'href', {
      set: vi.fn(() => {
        throw new Error('Cannot set location');
      }),
      configurable: true,
    });

    const onError = vi.fn();

    await openFlexElement({
      elementId: 'test-id',
      onError,
    });

    // Verify window was closed
    expect(mockPlaceholderWindow.close).toHaveBeenCalled();

    // Verify error callback was called
    expect(onError).toHaveBeenCalled();
  });
});
