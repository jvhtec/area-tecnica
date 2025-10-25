import { describe, it, expect } from 'vitest';
import { getFlexBaseUrl, getFlexApiBaseUrl, getFlexViewId, FLEX_CONFIG } from '../config';

describe('config', () => {
  describe('FLEX_CONFIG', () => {
    it('should have baseUrl defined', () => {
      expect(FLEX_CONFIG.baseUrl).toBeDefined();
      expect(FLEX_CONFIG.baseUrl).toContain('https://sectorpro.flexrentalsolutions.com');
    });

    it('should have apiBaseUrl defined', () => {
      expect(FLEX_CONFIG.apiBaseUrl).toBeDefined();
      expect(FLEX_CONFIG.apiBaseUrl).toContain('https://sectorpro.flexrentalsolutions.com');
    });

    it('should have viewIds defined', () => {
      expect(FLEX_CONFIG.viewIds).toBeDefined();
      expect(FLEX_CONFIG.viewIds.presupuesto).toBeDefined();
      expect(FLEX_CONFIG.viewIds.crewCall).toBeDefined();
    });
  });

  describe('getFlexBaseUrl', () => {
    it('should return the base URL', () => {
      const url = getFlexBaseUrl();
      expect(url).toBe(FLEX_CONFIG.baseUrl);
      expect(url).toContain('https://sectorpro.flexrentalsolutions.com');
    });
  });

  describe('getFlexApiBaseUrl', () => {
    it('should return the API base URL', () => {
      const url = getFlexApiBaseUrl();
      expect(url).toBe(FLEX_CONFIG.apiBaseUrl);
      expect(url).toContain('https://sectorpro.flexrentalsolutions.com');
    });
  });

  describe('getFlexViewId', () => {
    it('should return presupuesto view ID', () => {
      const viewId = getFlexViewId('presupuesto');
      expect(viewId).toBe('ca6b072c-b122-11df-b8d5-00e08175e43e');
    });

    it('should return crewCall view ID', () => {
      const viewId = getFlexViewId('crewCall');
      expect(viewId).toBe('139e2f60-8d20-11e2-b07f-00e08175e43e');
    });
  });
});
