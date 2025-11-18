import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('SQL Migration - job_date_types_unique_constraint', () => {
  const migrationPath = resolve(__dirname, '../20260312090000_job_date_types_unique_constraint.sql');
  let migrationContent: string;

  try {
    migrationContent = readFileSync(migrationPath, 'utf-8');
  } catch (error) {
    migrationContent = '';
  }

  it('should exist and be readable', () => {
    expect(migrationContent).toBeTruthy();
    expect(migrationContent.length).toBeGreaterThan(0);
  });

  it('should remove duplicate records before creating constraint', () => {
    expect(migrationContent).toContain('DELETE FROM job_date_types');
    expect(migrationContent).toContain('WHERE a.job_id = b.job_id');
    expect(migrationContent).toContain('AND a.date = b.date');
  });

  it('should create unique constraint on job_id and date', () => {
    expect(migrationContent).toContain('ADD CONSTRAINT');
    expect(migrationContent).toContain('UNIQUE (job_id, date)');
  });

  it('should be idempotent with IF EXISTS clause', () => {
    expect(migrationContent).toContain('IF EXISTS');
  });
});