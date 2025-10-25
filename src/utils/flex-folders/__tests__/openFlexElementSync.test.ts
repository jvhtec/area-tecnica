import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openFlexElementSync } from '../openFlexElementSync';
import * as buildFlexUrlModule from '../buildFlexUrl';

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock buildFlexUrl
vi.mock('../buildFlexUrl', async () => {
  const actual = await vi.importActual('../buildFlexUrl');
  return {
    ...actual,
    buildFlexUrl: vi.fn(),
  };
});

describe('openFlexElementSync', () => {
  let mockAnchor: any;
  let mockDocument: any;

  beforeEach(() => {
    // Mock anchor element
    mockAnchor = {
      href: '',
      target: '',
      rel: '',
      style: {},
      click: vi.fn(),
    };

    // Mock document.createElement and appendChild/removeChild
    mockDocument = {
      createElement: vi.fn(() => mockAnchor),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    };
    global.document = mockDocument as any;

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create and click an anchor element with correct attributes', () => {
    const mockUrl = 'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/test-id/view/simple-element/header';
    vi.spyOn(buildFlexUrlModule, 'buildFlexUrl').mockReturnValue(mockUrl);

    openFlexElementSync({
      elementId: 'test-id',
      domainId: 'simple-project-element',
    });

    // Verify anchor was created
    expect(mockDocument.createElement).toHaveBeenCalledWith('a');

    // Verify anchor attributes
    expect(mockAnchor.href).toBe(mockUrl);
    expect(mockAnchor.target).toBe('_blank');
    expect(mockAnchor.rel).toBe('noopener noreferrer');

    // Verify anchor was added and removed
    expect(mockDocument.body.appendChild).toHaveBeenCalledWith(mockAnchor);
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(mockDocument.body.removeChild).toHaveBeenCalledWith(mockAnchor);
  });

  it('should build URL with domainId and definitionId', () => {
    const mockUrl = 'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/test-id/view/simple-element/header';
    vi.spyOn(buildFlexUrlModule, 'buildFlexUrl').mockReturnValue(mockUrl);

    openFlexElementSync({
      elementId: 'test-id',
      domainId: 'simple-project-element',
      definitionId: 'test-definition-id',
    });

    // Verify buildFlexUrl was called with correct parameters
    expect(buildFlexUrlModule.buildFlexUrl).toHaveBeenCalledWith(
      'test-id',
      'test-definition-id',
      'simple-project-element'
    );
  });

  it('should reject empty elementId', () => {
    const { toast } = require('sonner');

    openFlexElementSync({
      elementId: '',
    });

    // Verify toast.error was called
    expect(toast.error).toHaveBeenCalled();

    // Verify no anchor was created
    expect(mockDocument.createElement).not.toHaveBeenCalled();
  });

  it('should reject null elementId', () => {
    const { toast } = require('sonner');

    openFlexElementSync({
      elementId: null as any,
    });

    // Verify toast.error was called
    expect(toast.error).toHaveBeenCalled();

    // Verify no anchor was created
    expect(mockDocument.createElement).not.toHaveBeenCalled();
  });

  it('should reject undefined elementId', () => {
    const { toast } = require('sonner');

    openFlexElementSync({
      elementId: undefined as any,
    });

    // Verify toast.error was called
    expect(toast.error).toHaveBeenCalled();

    // Verify no anchor was created
    expect(mockDocument.createElement).not.toHaveBeenCalled();
  });

  it('should reject whitespace-only elementId', () => {
    const { toast } = require('sonner');

    openFlexElementSync({
      elementId: '   ',
    });

    // Verify toast.error was called
    expect(toast.error).toHaveBeenCalled();

    // Verify no anchor was created
    expect(mockDocument.createElement).not.toHaveBeenCalled();
  });

  it('should use fallback URL when buildFlexUrl throws', () => {
    const { toast } = require('sonner');
    vi.spyOn(buildFlexUrlModule, 'buildFlexUrl').mockImplementation(() => {
      throw new Error('URL construction failed');
    });

    openFlexElementSync({
      elementId: 'test-id',
    });

    // Verify fallback URL was used
    expect(mockAnchor.href).toBe(
      'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/test-id/view/simple-element/header'
    );

    // Verify anchor was clicked
    expect(mockAnchor.click).toHaveBeenCalled();

    // Verify warning toast was shown
    expect(toast.warning).toHaveBeenCalled();
  });

  it('should show error toast when both primary and fallback fail', () => {
    const { toast } = require('sonner');
    vi.spyOn(buildFlexUrlModule, 'buildFlexUrl').mockImplementation(() => {
      throw new Error('URL construction failed');
    });

    // Make anchor.click throw
    mockAnchor.click = vi.fn(() => {
      throw new Error('Navigation failed');
    });

    openFlexElementSync({
      elementId: 'test-id',
    });

    // Verify error toast was shown
    expect(toast.error).toHaveBeenCalled();
  });

  it('should handle financial document with definitionId', () => {
    const mockUrl = 'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#fin-doc/test-id/doc-view/ca6b072c-b122-11df-b8d5-00e08175e43e/header';
    vi.spyOn(buildFlexUrlModule, 'buildFlexUrl').mockReturnValue(mockUrl);

    openFlexElementSync({
      elementId: 'test-id',
      definitionId: '9bfb850c-b117-11df-b8d5-00e08175e43e', // presupuesto
    });

    // Verify buildFlexUrl was called with definitionId
    expect(buildFlexUrlModule.buildFlexUrl).toHaveBeenCalledWith(
      'test-id',
      '9bfb850c-b117-11df-b8d5-00e08175e43e',
      undefined
    );

    // Verify anchor was clicked
    expect(mockAnchor.click).toHaveBeenCalled();
  });

  it('should log comprehensive debug information', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const mockUrl = 'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/test-id/view/simple-element/header';
    vi.spyOn(buildFlexUrlModule, 'buildFlexUrl').mockReturnValue(mockUrl);

    openFlexElementSync({
      elementId: 'test-id',
      domainId: 'simple-project-element',
      displayName: 'Test Element',
      documentNumber: 'DOC-123',
    });

    // Verify debug logs were called
    expect(consoleSpy).toHaveBeenCalledWith(
      '[openFlexElementSync] Starting synchronous navigation',
      expect.objectContaining({
        elementId: 'test-id',
        domainId: 'simple-project-element',
        displayName: 'Test Element',
        documentNumber: 'DOC-123',
      })
    );

    consoleSpy.mockRestore();
  });

  it('should handle element with display name in error messages', () => {
    const { toast } = require('sonner');
    vi.spyOn(buildFlexUrlModule, 'buildFlexUrl').mockReturnValue('');

    openFlexElementSync({
      elementId: 'test-id',
      displayName: 'Test Element Name',
    });

    // Verify error message includes display name
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('Test Element Name')
    );
  });

  it('should set anchor style to display none', () => {
    const mockUrl = 'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/test-id/view/simple-element/header';
    vi.spyOn(buildFlexUrlModule, 'buildFlexUrl').mockReturnValue(mockUrl);

    openFlexElementSync({
      elementId: 'test-id',
    });

    // Verify anchor style was set
    expect(mockAnchor.style.display).toBe('none');
  });
});
