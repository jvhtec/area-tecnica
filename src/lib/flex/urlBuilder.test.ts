import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildFlexUrl, getFlexBaseUrl, FLEX_TEMPLATE_IDS, type FlexLinkIntent } from './urlBuilder';

describe('urlBuilder', () => {
  describe('getFlexBaseUrl', () => {
    it('should return the default URL when VITE_FLEX_BASE_URL is not set', () => {
      const url = getFlexBaseUrl();
      expect(url).toBe('https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop');
    });

    it('should return the custom URL when VITE_FLEX_BASE_URL is set', () => {
      vi.stubEnv('VITE_FLEX_BASE_URL', 'https://custom.flexrentalsolutions.com/f5/ui/?desktop');
      const url = getFlexBaseUrl();
      expect(url).toBe('https://custom.flexrentalsolutions.com/f5/ui/?desktop');
      vi.unstubAllEnvs();
    });
  });

  describe('buildFlexUrl - simple-element intent', () => {
    it('should build a simple element URL', () => {
      const url = buildFlexUrl({
        intent: 'simple-element',
        elementId: 'test-element-123',
      });
      expect(url).toBe('https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/test-element-123/view/simple-element/header');
    });

    it('should not double-encode element ID', () => {
      const url = buildFlexUrl({
        intent: 'simple-element',
        elementId: 'element-with-special-chars-abc123',
      });
      expect(url).toContain('#element/element-with-special-chars-abc123/view/simple-element/header');
      expect(url).not.toContain('%2F');
    });
  });

  describe('buildFlexUrl - financial-document intent', () => {
    it('should build a financial document URL', () => {
      const url = buildFlexUrl({
        intent: 'financial-document',
        elementId: 'financial-doc-456',
      });
      expect(url).toBe(`https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#fin-doc/financial-doc-456/doc-view/${FLEX_TEMPLATE_IDS.financialDocumentView}/header`);
    });

    it('should use the correct template ID', () => {
      const url = buildFlexUrl({
        intent: 'financial-document',
        elementId: 'doc-123',
      });
      expect(url).toContain(FLEX_TEMPLATE_IDS.financialDocumentView);
    });
  });

  describe('buildFlexUrl - expense-sheet intent', () => {
    it('should build an expense sheet URL', () => {
      const url = buildFlexUrl({
        intent: 'expense-sheet',
        elementId: 'expense-789',
      });
      expect(url).toBe(`https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#fin-doc/expense-789/doc-view/${FLEX_TEMPLATE_IDS.expenseSheetView}/header`);
    });

    it('should use the expense sheet template ID', () => {
      const url = buildFlexUrl({
        intent: 'expense-sheet',
        elementId: 'expense-123',
      });
      expect(url).toContain(FLEX_TEMPLATE_IDS.expenseSheetView);
    });
  });

  describe('buildFlexUrl - contact-list intent', () => {
    it('should build a contact list URL', () => {
      const url = buildFlexUrl({
        intent: 'contact-list',
        elementId: 'contact-list-001',
      });
      expect(url).toBe('https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/contact-list-001/view/contact-list/header');
    });
  });

  describe('buildFlexUrl - remote-file-list intent', () => {
    it('should build a remote file list URL', () => {
      const url = buildFlexUrl({
        intent: 'remote-file-list',
        elementId: 'file-list-002',
      });
      expect(url).toBe('https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/file-list-002/view/remote-file-list/header');
    });
  });

  describe('buildFlexUrl - equipment-list intent', () => {
    it('should build an equipment list URL', () => {
      const url = buildFlexUrl({
        intent: 'equipment-list',
        elementId: 'equipment-003',
      });
      expect(url).toBe('https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/equipment-003/view/equipment-list/header');
    });
  });

  describe('buildFlexUrl - base URL override', () => {
    it('should use custom base URL when provided', () => {
      const url = buildFlexUrl({
        intent: 'simple-element',
        elementId: 'test-123',
        baseUrl: 'https://custom.example.com/flex',
      });
      expect(url).toBe('https://custom.example.com/flex#element/test-123/view/simple-element/header');
    });

    it('should normalize base URL with trailing slash', () => {
      const url = buildFlexUrl({
        intent: 'simple-element',
        elementId: 'test-123',
        baseUrl: 'https://custom.example.com/flex/',
      });
      expect(url).toBe('https://custom.example.com/flex#element/test-123/view/simple-element/header');
    });

    it('should normalize base URL with trailing hash', () => {
      const url = buildFlexUrl({
        intent: 'simple-element',
        elementId: 'test-123',
        baseUrl: 'https://custom.example.com/flex#',
      });
      expect(url).toBe('https://custom.example.com/flex#element/test-123/view/simple-element/header');
    });

    it('should normalize base URL with multiple trailing slashes', () => {
      const url = buildFlexUrl({
        intent: 'simple-element',
        elementId: 'test-123',
        baseUrl: 'https://custom.example.com/flex///',
      });
      expect(url).toBe('https://custom.example.com/flex#element/test-123/view/simple-element/header');
    });

    it('should normalize base URL with trailing hash and slashes', () => {
      const url = buildFlexUrl({
        intent: 'simple-element',
        elementId: 'test-123',
        baseUrl: 'https://custom.example.com/flex/#',
      });
      expect(url).toBe('https://custom.example.com/flex#element/test-123/view/simple-element/header');
    });

    it('should handle base URL with whitespace', () => {
      const url = buildFlexUrl({
        intent: 'simple-element',
        elementId: 'test-123',
        baseUrl: '  https://custom.example.com/flex  ',
      });
      expect(url).toBe('https://custom.example.com/flex#element/test-123/view/simple-element/header');
    });
  });

  describe('buildFlexUrl - invalid element ID handling', () => {
    it('should throw error for empty string element ID', () => {
      expect(() =>
        buildFlexUrl({
          intent: 'simple-element',
          elementId: '',
        })
      ).toThrow('Invalid elementId');
    });

    it('should throw error for whitespace-only element ID', () => {
      expect(() =>
        buildFlexUrl({
          intent: 'simple-element',
          elementId: '   ',
        })
      ).toThrow('Invalid elementId');
    });

    it('should throw error for null element ID', () => {
      expect(() =>
        buildFlexUrl({
          intent: 'simple-element',
          elementId: null as any,
        })
      ).toThrow('Invalid elementId');
    });

    it('should throw error for undefined element ID', () => {
      expect(() =>
        buildFlexUrl({
          intent: 'simple-element',
          elementId: undefined as any,
        })
      ).toThrow('Invalid elementId');
    });

    it('should throw error for non-string element ID', () => {
      expect(() =>
        buildFlexUrl({
          intent: 'simple-element',
          elementId: 123 as any,
        })
      ).toThrow('Invalid elementId');
    });
  });

  describe('buildFlexUrl - all intents', () => {
    const testCases: Array<{ intent: FlexLinkIntent; expectedFragment: string }> = [
      { intent: 'simple-element', expectedFragment: '#element/test-id/view/simple-element/header' },
      { intent: 'financial-document', expectedFragment: `#fin-doc/test-id/doc-view/${FLEX_TEMPLATE_IDS.financialDocumentView}/header` },
      { intent: 'expense-sheet', expectedFragment: `#fin-doc/test-id/doc-view/${FLEX_TEMPLATE_IDS.expenseSheetView}/header` },
      { intent: 'contact-list', expectedFragment: '#element/test-id/view/contact-list/header' },
      { intent: 'remote-file-list', expectedFragment: '#element/test-id/view/remote-file-list/header' },
      { intent: 'equipment-list', expectedFragment: '#element/test-id/view/equipment-list/header' },
    ];

    testCases.forEach(({ intent, expectedFragment }) => {
      it(`should build correct URL for ${intent} intent`, () => {
        const url = buildFlexUrl({
          intent,
          elementId: 'test-id',
        });
        expect(url).toContain(expectedFragment);
      });
    });
  });

  describe('buildFlexUrl - edge cases', () => {
    it('should handle element IDs with hyphens', () => {
      const url = buildFlexUrl({
        intent: 'simple-element',
        elementId: 'element-with-many-hyphens-123',
      });
      expect(url).toContain('element-with-many-hyphens-123');
    });

    it('should handle UUID-style element IDs', () => {
      const url = buildFlexUrl({
        intent: 'simple-element',
        elementId: 'ca6b072c-b122-11df-b8d5-00e08175e43e',
      });
      expect(url).toContain('ca6b072c-b122-11df-b8d5-00e08175e43e');
    });

    it('should handle alphanumeric element IDs', () => {
      const url = buildFlexUrl({
        intent: 'simple-element',
        elementId: 'ABC123xyz789',
      });
      expect(url).toContain('ABC123xyz789');
    });
  });

  describe('FLEX_TEMPLATE_IDS', () => {
    it('should export financial document view ID', () => {
      expect(FLEX_TEMPLATE_IDS.financialDocumentView).toBe('ca6b072c-b122-11df-b8d5-00e08175e43e');
    });

    it('should export expense sheet view ID', () => {
      expect(FLEX_TEMPLATE_IDS.expenseSheetView).toBe('566d32e0-1a1e-11e0-a472-00e08175e43e');
    });

    it('should export all template IDs', () => {
      expect(FLEX_TEMPLATE_IDS).toHaveProperty('financialDocumentView');
      expect(FLEX_TEMPLATE_IDS).toHaveProperty('expenseSheetView');
      expect(FLEX_TEMPLATE_IDS).toHaveProperty('contactListView');
      expect(FLEX_TEMPLATE_IDS).toHaveProperty('remoteFileListView');
      expect(FLEX_TEMPLATE_IDS).toHaveProperty('equipmentListView');
    });
  });
});
