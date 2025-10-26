/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openFlexElement } from '../openFlexElement';
import * as resolverModule from '../resolveFlexUrl';

// Mock resolver
vi.mock('../resolveFlexUrl', async () => {
  const actual = await vi.importActual('../resolveFlexUrl');
  return {
    ...actual,
    resolveFlexUrl: vi.fn(),
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
    (resolverModule.resolveFlexUrl as any).mockResolvedValue(
      'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/test-id/view/simple-element/detail'
    );

    await openFlexElement({
      elementId: 'test-id',
    });

    // Verify window.open was called synchronously with about:blank
    expect(mockWindow.open).toHaveBeenCalledWith('about:blank', '_blank', 'noopener,noreferrer');
  });

  it('should resolve URL via resolver and navigate placeholder window', async () => {
    const mockUrl = 'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/test-id/view/simple-element/detail';
    vi.spyOn(resolverModule, 'resolveFlexUrl').mockResolvedValue(mockUrl);

    await openFlexElement({
      elementId: 'test-id',
      context: { jobType: 'single' },
    });

    // Verify resolver was called with correct parameters
    expect(resolverModule.resolveFlexUrl).toHaveBeenCalledWith({
      elementId: 'test-id',
      context: { jobType: 'single' },
    });

    // Verify placeholder window location was updated
    expect(mockPlaceholderWindow.location.href).toBe(mockUrl);
  });

  it('should use fallback URL when resolver returns null', async () => {
    vi.spyOn(resolverModule, 'resolveFlexUrl').mockResolvedValue(null);

    const onWarning = vi.fn();

    await openFlexElement({
      elementId: 'test-id',
      onWarning,
    });

    // Verify fallback URL was used
    expect(mockPlaceholderWindow.location.href).toBe(
      'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/test-id/view/simple-element/detail'
    );

    // Verify warning callback was called
    expect(onWarning).toHaveBeenCalled();
    expect(onWarning.mock.calls[0][0]).toContain('fallback URL format');
  });

  it('should use fallback URL when resolver throws', async () => {
    vi.spyOn(resolverModule, 'resolveFlexUrl').mockRejectedValue(new Error('Resolver error'));

    const onWarning = vi.fn();

    await openFlexElement({
      elementId: 'test-id',
      onWarning,
    });

    // Verify fallback URL was used
    expect(mockPlaceholderWindow.location.href).toBe(
      'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/test-id/view/simple-element/detail'
    );

    // Verify warning callback was called
    expect(onWarning).toHaveBeenCalledWith('Opened with fallback URL format (error occurred)');
  });

  it('should handle popup blocked by using link click method without error', async () => {
    // Mock window.open to return null (popup blocked)
    mockWindow.open = vi.fn(() => null);

    // Resolver returns a valid URL
    vi.spyOn(resolverModule, 'resolveFlexUrl').mockResolvedValue(
      'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/test-id/view/simple-element/detail'
    );

    const onError = vi.fn();

    await openFlexElement({
      elementId: 'test-id',
      onError,
    });

    // Verify error callback was NOT called
    expect(onError).not.toHaveBeenCalled();
  });

  it('should pass context to resolver', async () => {
    const mockUrl = 'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/test-id/view/simple-element/detail';
    vi.spyOn(resolverModule, 'resolveFlexUrl').mockResolvedValue(mockUrl);

    const context = {
      jobType: 'dryhire' as const,
      folderType: 'dryhire' as const,
    };

    await openFlexElement({
      elementId: 'test-id',
      context,
    });

    // Verify context was passed through
    expect(resolverModule.resolveFlexUrl).toHaveBeenCalledWith({
      elementId: 'test-id',
      context,
    });
  });

  it('should handle window.close gracefully when setting location fails', async () => {
    vi.spyOn(resolverModule, 'resolveFlexUrl').mockResolvedValue(
      'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/test-id/view/simple-element/detail'
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

  it('should reject empty elementId', async () => {
    const onError = vi.fn();

    await openFlexElement({
      elementId: '',
      onError,
    });

    // Verify error callback was called
    expect(onError).toHaveBeenCalled();
    const error = onError.mock.calls[0][0];
    expect(error.message).toContain('Invalid element ID');

    // Verify no window was opened
    expect(mockWindow.open).not.toHaveBeenCalled();
  });

  it('should reject null elementId', async () => {
    const onError = vi.fn();

    await openFlexElement({
      elementId: null as any,
      onError,
    });

    // Verify error callback was called
    expect(onError).toHaveBeenCalled();
    const error = onError.mock.calls[0][0];
    expect(error.message).toContain('Invalid element ID');

    // Verify no window was opened
    expect(mockWindow.open).not.toHaveBeenCalled();
  });

  it('should reject undefined elementId', async () => {
    const onError = vi.fn();

    await openFlexElement({
      elementId: undefined as any,
      onError,
    });

    // Verify error callback was called
    expect(onError).toHaveBeenCalled();
    const error = onError.mock.calls[0][0];
    expect(error.message).toContain('Invalid element ID');

    // Verify no window was opened
    expect(mockWindow.open).not.toHaveBeenCalled();
  });

  it('should reject whitespace-only elementId', async () => {
    const onError = vi.fn();

    await openFlexElement({
      elementId: '   ',
      onError,
    });

    // Verify error callback was called
    expect(onError).toHaveBeenCalled();
    const error = onError.mock.calls[0][0];
    expect(error.message).toContain('Invalid element ID');

    // Verify no window was opened
    expect(mockWindow.open).not.toHaveBeenCalled();
  });

  it('should handle dryhire context with proper URL format', async () => {
    const mockUrl = 'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/test-dryhire-id/view/simple-element/detail';
    vi.spyOn(resolverModule, 'resolveFlexUrl').mockResolvedValue(mockUrl);

    await openFlexElement({
      elementId: 'test-dryhire-id',
      context: {
        jobType: 'dryhire',
        folderType: 'dryhire',
      },
    });

    // Verify context was passed through
    expect(resolverModule.resolveFlexUrl).toHaveBeenCalledWith({
      elementId: 'test-dryhire-id',
      context: { jobType: 'dryhire', folderType: 'dryhire' },
    });

    // Verify placeholder window location was updated
    expect(mockPlaceholderWindow.location.href).toBe(mockUrl);
  });

  it('should handle tourdate context with proper URL format', async () => {
    const mockUrl = 'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/test-tourdate-id/view/simple-element/detail';
    vi.spyOn(resolverModule, 'resolveFlexUrl').mockResolvedValue(mockUrl);

    await openFlexElement({
      elementId: 'test-tourdate-id',
      context: {
        jobType: 'tourdate',
        folderType: 'tourdate',
      },
    });

    // Verify context was passed through
    expect(resolverModule.resolveFlexUrl).toHaveBeenCalledWith({
      elementId: 'test-tourdate-id',
      context: { jobType: 'tourdate', folderType: 'tourdate' },
    });

    // Verify placeholder window location was updated
    expect(mockPlaceholderWindow.location.href).toBe(mockUrl);
  });
});
