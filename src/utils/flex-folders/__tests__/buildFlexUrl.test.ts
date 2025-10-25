import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildFlexUrl,
  buildFlexUrlWithTypeDetection,
  isFinancialDocument,
  isSimpleFolder,
  getElementDetails,
} from '../buildFlexUrl';
import { FLEX_FOLDER_IDS } from '../constants';

// Mock fetch globally
global.fetch = vi.fn();

describe('buildFlexUrl', () => {
  it('should build financial document URL for presupuesto', () => {
    const url = buildFlexUrl('test-element-id', FLEX_FOLDER_IDS.presupuesto);
    expect(url).toContain('#fin-doc/test-element-id/doc-view/');
    expect(url).toContain('/header');
  });

  it('should build financial document URL for presupuestoDryHire', () => {
    const url = buildFlexUrl('test-element-id', FLEX_FOLDER_IDS.presupuestoDryHire);
    expect(url).toContain('#fin-doc/test-element-id/doc-view/');
    expect(url).toContain('/header');
  });

  it('should build financial document URL for hojaGastos', () => {
    const url = buildFlexUrl('test-element-id', FLEX_FOLDER_IDS.hojaGastos);
    expect(url).toContain('#fin-doc/test-element-id/doc-view/');
    expect(url).toContain('/header');
  });

  it('should build simple element URL for mainFolder', () => {
    const url = buildFlexUrl('test-element-id', FLEX_FOLDER_IDS.mainFolder);
    expect(url).toContain('#element/test-element-id/view/simple-element/header');
  });

  it('should build simple element URL for subFolder', () => {
    const url = buildFlexUrl('test-element-id', FLEX_FOLDER_IDS.subFolder);
    expect(url).toContain('#element/test-element-id/view/simple-element/header');
  });

  it('should build simple element URL when no definitionId provided', () => {
    const url = buildFlexUrl('test-element-id');
    expect(url).toContain('#element/test-element-id/view/simple-element/header');
  });

  it('should build simple element URL for unknown definitionId', () => {
    const url = buildFlexUrl('test-element-id', 'unknown-definition-id');
    expect(url).toContain('#element/test-element-id/view/simple-element/header');
  });

  it('should throw error for empty elementId', () => {
    expect(() => buildFlexUrl('', FLEX_FOLDER_IDS.presupuesto)).toThrow('Invalid elementId');
  });

  it('should throw error for null elementId', () => {
    expect(() => buildFlexUrl(null as any, FLEX_FOLDER_IDS.presupuesto)).toThrow('Invalid elementId');
  });

  it('should throw error for undefined elementId', () => {
    expect(() => buildFlexUrl(undefined as any, FLEX_FOLDER_IDS.presupuesto)).toThrow('Invalid elementId');
  });

  it('should throw error for whitespace-only elementId', () => {
    expect(() => buildFlexUrl('   ', FLEX_FOLDER_IDS.presupuesto)).toThrow('Invalid elementId');
  });
});

describe('isFinancialDocument', () => {
  it('should return true for presupuesto', () => {
    expect(isFinancialDocument(FLEX_FOLDER_IDS.presupuesto)).toBe(true);
  });

  it('should return true for presupuestoDryHire', () => {
    expect(isFinancialDocument(FLEX_FOLDER_IDS.presupuestoDryHire)).toBe(true);
  });

  it('should return true for hojaGastos', () => {
    expect(isFinancialDocument(FLEX_FOLDER_IDS.hojaGastos)).toBe(true);
  });

  it('should return false for mainFolder', () => {
    expect(isFinancialDocument(FLEX_FOLDER_IDS.mainFolder)).toBe(false);
  });

  it('should return false for subFolder', () => {
    expect(isFinancialDocument(FLEX_FOLDER_IDS.subFolder)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isFinancialDocument(undefined)).toBe(false);
  });
});

describe('isSimpleFolder', () => {
  it('should return true for mainFolder', () => {
    expect(isSimpleFolder(FLEX_FOLDER_IDS.mainFolder)).toBe(true);
  });

  it('should return true for subFolder', () => {
    expect(isSimpleFolder(FLEX_FOLDER_IDS.subFolder)).toBe(true);
  });

  it('should return false for presupuesto', () => {
    expect(isSimpleFolder(FLEX_FOLDER_IDS.presupuesto)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isSimpleFolder(undefined)).toBe(false);
  });
});

describe('getElementDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch element details successfully', async () => {
    const mockResponse = {
      elementDefinitionId: { data: 'test-definition-id' },
      name: { data: 'Test Element' },
      documentNumber: { data: 'DOC-123' },
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const details = await getElementDetails('test-element-id', 'test-token');

    expect(details).toEqual({
      elementId: 'test-element-id',
      definitionId: 'test-definition-id',
      name: 'Test Element',
      documentNumber: 'DOC-123',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://sectorpro.flexrentalsolutions.com/f5/api/element/test-element-id/key-info/',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': 'test-token',
          'apikey': 'test-token',
        },
      }
    );
  });

  it('should handle fetch failure gracefully', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
    });

    const details = await getElementDetails('test-element-id', 'test-token');

    expect(details).toEqual({
      elementId: 'test-element-id',
    });
  });

  it('should handle network error gracefully', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const details = await getElementDetails('test-element-id', 'test-token');

    expect(details).toEqual({
      elementId: 'test-element-id',
    });
  });
});

describe('buildFlexUrlWithTypeDetection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use definitionId from context if provided', async () => {
    const url = await buildFlexUrlWithTypeDetection('test-element-id', 'test-token', {
      definitionId: FLEX_FOLDER_IDS.presupuesto,
    });

    expect(url).toContain('#fin-doc/test-element-id/doc-view/');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should use simple-element URL for dryhire folderType', async () => {
    const url = await buildFlexUrlWithTypeDetection('test-element-id', 'test-token', {
      folderType: 'dryhire',
    });

    expect(url).toContain('#element/test-element-id/view/simple-element/header');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should use simple-element URL for tourdate folderType', async () => {
    const url = await buildFlexUrlWithTypeDetection('test-element-id', 'test-token', {
      folderType: 'tourdate',
    });

    expect(url).toContain('#element/test-element-id/view/simple-element/header');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should use simple-element URL for dryhire jobType', async () => {
    const url = await buildFlexUrlWithTypeDetection('test-element-id', 'test-token', {
      jobType: 'dryhire',
    });

    expect(url).toContain('#element/test-element-id/view/simple-element/header');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should use simple-element URL for tourdate jobType', async () => {
    const url = await buildFlexUrlWithTypeDetection('test-element-id', 'test-token', {
      jobType: 'tourdate',
    });

    expect(url).toContain('#element/test-element-id/view/simple-element/header');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should fetch element details when no context provided', async () => {
    const mockResponse = {
      elementDefinitionId: { data: FLEX_FOLDER_IDS.presupuesto },
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const url = await buildFlexUrlWithTypeDetection('test-element-id', 'test-token');

    expect(url).toContain('#fin-doc/test-element-id/doc-view/');
    expect(global.fetch).toHaveBeenCalled();
  });

  it('should fallback to simple-element URL when API call fails', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('API error'));

    const url = await buildFlexUrlWithTypeDetection('test-element-id', 'test-token');

    expect(url).toContain('#element/test-element-id/view/simple-element/header');
  });

  it('should fetch element details for single jobType (no shortcut)', async () => {
    const mockResponse = {
      elementDefinitionId: { data: FLEX_FOLDER_IDS.mainFolder },
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const url = await buildFlexUrlWithTypeDetection('test-element-id', 'test-token', {
      jobType: 'single',
    });

    expect(url).toContain('#element/test-element-id/view/simple-element/header');
    expect(global.fetch).toHaveBeenCalled();
  });

  it('should throw error for empty elementId in buildFlexUrlWithTypeDetection', async () => {
    await expect(
      buildFlexUrlWithTypeDetection('', 'test-token')
    ).rejects.toThrow('Invalid elementId');
  });

  it('should throw error for null elementId in buildFlexUrlWithTypeDetection', async () => {
    await expect(
      buildFlexUrlWithTypeDetection(null as any, 'test-token')
    ).rejects.toThrow('Invalid elementId');
  });

  it('should throw error for undefined elementId in buildFlexUrlWithTypeDetection', async () => {
    await expect(
      buildFlexUrlWithTypeDetection(undefined as any, 'test-token')
    ).rejects.toThrow('Invalid elementId');
  });

  it('should throw error for whitespace-only elementId in buildFlexUrlWithTypeDetection', async () => {
    await expect(
      buildFlexUrlWithTypeDetection('   ', 'test-token')
    ).rejects.toThrow('Invalid elementId');
  });

  it('should handle empty authToken gracefully with context optimization', async () => {
    // With context optimization, should not need authToken
    const url = await buildFlexUrlWithTypeDetection('test-element-id', '', {
      jobType: 'dryhire',
    });

    expect(url).toContain('#element/test-element-id/view/simple-element/header');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should use fallback when authToken is empty and no context', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Unauthorized'));

    const url = await buildFlexUrlWithTypeDetection('test-element-id', '');

    expect(url).toContain('#element/test-element-id/view/simple-element/header');
  });
});
