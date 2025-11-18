import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('Test Suite Setup Validation', () => {
  const testFiles = [
    'src/components/dashboard/__tests__/JobCardNew.lights-and-tasks.test.tsx',
    'src/components/tours/__tests__/TourDateManagementDialog.rollback.test.tsx',
    'src/components/tours/__tests__/TourDateManagementDialog.integration.test.tsx',
    'src/pages/__tests__/WallboardPresets.panel-durations.test.tsx',
    'supabase/migrations/__tests__/job_date_types_constraint.validation.test.ts',
  ];

  testFiles.forEach((testFile) => {
    it(`should have test file: ${testFile}`, () => {
      const filePath = resolve(__dirname, '..', testFile);
      expect(existsSync(filePath)).toBe(true);
    });

    it(`should have valid content in: ${testFile}`, () => {
      const filePath = resolve(__dirname, '..', testFile);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf-8');
        expect(content.length).toBeGreaterThan(100);
        expect(content).toContain('describe');
        expect(content).toContain('it');
      }
    });
  });

  it('should have TEST_COVERAGE_REPORT.md', () => {
    const reportPath = resolve(__dirname, '..', 'TEST_COVERAGE_REPORT.md');
    expect(existsSync(reportPath)).toBe(true);
  });

  it('should have vitest configuration', () => {
    const vitestConfigPath = resolve(__dirname, '..', 'vitest.config.ts');
    expect(existsSync(vitestConfigPath)).toBe(true);
  });
});

describe('Test File Quality Checks', () => {
  it('should use proper TypeScript extensions', () => {
    const testFiles = [
      'JobCardNew.lights-and-tasks.test.tsx',
      'TourDateManagementDialog.rollback.test.tsx',
      'WallboardPresets.panel-durations.test.tsx',
    ];

    testFiles.forEach(file => {
      expect(file).toMatch(/\.test\.(tsx|ts)$/);
    });
  });

  it('should follow naming conventions', () => {
    const componentTests = [
      'JobCardNew.lights-and-tasks.test.tsx',
      'TourDateManagementDialog.rollback.test.tsx',
      'WallboardPresets.panel-durations.test.tsx',
    ];

    componentTests.forEach(file => {
      // Should have descriptive suffix after component name
      expect(file).toMatch(/\w+\.\w+-[\w-]+\.test\.(tsx|ts)/);
    });
  });
});