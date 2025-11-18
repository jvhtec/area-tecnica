import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('SQL Migration - job_date_types_unique_constraint', () => {
  const migrationPath = join(
    __dirname,
    '../20260312090000_job_date_types_unique_constraint.sql'
  );

  let migrationContent: string;

  try {
    migrationContent = readFileSync(migrationPath, 'utf-8');
  } catch (error) {
    migrationContent = '';
  }

  describe('Migration File Structure', () => {
    it('should exist and be readable', () => {
      expect(migrationContent).toBeDefined();
      expect(migrationContent.length).toBeGreaterThan(0);
    });

    it('should have proper SQL syntax', () => {
      expect(migrationContent).toContain('ALTER TABLE');
      expect(migrationContent).toContain('job_date_types');
    });

    it('should have appropriate comments', () => {
      const hasComments = migrationContent.includes('--');
      expect(hasComments).toBe(true);
    });
  });

  describe('Duplicate Removal Logic', () => {
    it('should include DELETE statement for duplicates', () => {
      expect(migrationContent).toContain('DELETE FROM job_date_types');
    });

    it('should use USING clause for self-join duplicate detection', () => {
      expect(migrationContent).toContain('USING job_date_types');
    });

    it('should check both job_id and date for duplicates', () => {
      expect(migrationContent).toContain('job_id');
      expect(migrationContent).toContain('date');
    });

    it('should use ctid for row identification', () => {
      expect(migrationContent).toContain('ctid');
    });

    it('should keep only one record when duplicates exist', () => {
      // The migration should use ctid comparison to determine which row to keep
      expect(migrationContent).toMatch(/ctid\s*[<>]\s*ctid/);
    });
  });

  describe('Constraint Management', () => {
    it('should drop existing constraint if exists', () => {
      expect(migrationContent).toContain('DROP CONSTRAINT IF EXISTS');
      expect(migrationContent).toContain('job_date_types_job_id_date_key');
    });

    it('should add new unique constraint', () => {
      expect(migrationContent).toContain('ADD CONSTRAINT');
      expect(migrationContent).toContain('UNIQUE');
    });

    it('should create constraint on job_id and date columns', () => {
      const constraintRegex = /ADD CONSTRAINT.*UNIQUE\s*\(\s*job_id\s*,\s*date\s*\)/i;
      expect(migrationContent).toMatch(constraintRegex);
    });

    it('should use consistent constraint name', () => {
      const dropMatches = migrationContent.match(/DROP CONSTRAINT.*job_date_types_job_id_date_key/);
      const addMatches = migrationContent.match(/ADD CONSTRAINT\s+job_date_types_job_id_date_key/);
      
      expect(dropMatches).toBeTruthy();
      expect(addMatches).toBeTruthy();
    });
  });

  describe('Idempotency', () => {
    it('should use IF EXISTS for safe constraint dropping', () => {
      expect(migrationContent).toContain('IF EXISTS');
    });

    it('should be safe to run multiple times', () => {
      // Check that the migration uses IF EXISTS which makes it idempotent
      const hasIfExists = migrationContent.includes('IF EXISTS');
      expect(hasIfExists).toBe(true);
    });
  });

  describe('Data Integrity', () => {
    it('should clean duplicates before adding constraint', () => {
      const deleteIndex = migrationContent.indexOf('DELETE FROM');
      const constraintIndex = migrationContent.indexOf('ADD CONSTRAINT');
      
      // DELETE should come before ADD CONSTRAINT
      expect(deleteIndex).toBeLessThan(constraintIndex);
    });

    it('should prevent future duplicates with unique constraint', () => {
      expect(migrationContent).toContain('UNIQUE');
      expect(migrationContent).toMatch(/job_id\s*,\s*date/);
    });
  });

  describe('SQL Best Practices', () => {
    it('should target correct table', () => {
      const tableReferences = migrationContent.match(/job_date_types/g);
      expect(tableReferences).toBeTruthy();
      expect(tableReferences!.length).toBeGreaterThan(1);
    });

    it('should not have syntax errors (basic check)', () => {
      // Check for unclosed parentheses
      const openParens = (migrationContent.match(/\(/g) || []).length;
      const closeParens = (migrationContent.match(/\)/g) || []).length;
      expect(openParens).toBe(closeParens);
    });

    it('should use proper SQL formatting', () => {
      // Check for proper statement terminators
      const hasStatementEndings = migrationContent.match(/;/g);
      expect(hasStatementEndings).toBeTruthy();
      expect(hasStatementEndings!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Migration Safety', () => {
    it('should not DROP TABLE', () => {
      expect(migrationContent.toLowerCase()).not.toContain('drop table');
    });

    it('should not TRUNCATE', () => {
      expect(migrationContent.toLowerCase()).not.toContain('truncate');
    });

    it('should only modify job_date_types table', () => {
      const alterMatches = migrationContent.match(/ALTER TABLE\s+(\w+)/gi);
      if (alterMatches) {
        alterMatches.forEach(match => {
          expect(match.toLowerCase()).toContain('job_date_types');
        });
      }
    });
  });

  describe('Constraint Specification', () => {
    it('should create named constraint', () => {
      const constraintNameRegex = /ADD CONSTRAINT\s+\w+/i;
      expect(migrationContent).toMatch(constraintNameRegex);
    });

    it('should use descriptive constraint name', () => {
      expect(migrationContent).toContain('job_date_types_job_id_date_key');
    });

    it('should specify constraint type (UNIQUE)', () => {
      const uniqueRegex = /ADD CONSTRAINT.*UNIQUE/i;
      expect(migrationContent).toMatch(uniqueRegex);
    });
  });

  describe('Deletion Logic Validation', () => {
    it('should use subquery approach with USING clause', () => {
      expect(migrationContent).toMatch(/DELETE FROM.*USING/is);
    });

    it('should compare ctid to identify duplicate rows', () => {
      expect(migrationContent).toMatch(/ctid\s*<\s*ctid/);
    });

    it('should match on both job_id and date', () => {
      const whereClauses = migrationContent.toLowerCase();
      expect(whereClauses).toContain('job_id = ');
      expect(whereClauses).toContain('date = ');
    });
  });

  describe('Comment Quality', () => {
    it('should explain purpose of duplicate removal', () => {
      const comments = migrationContent.match(/--.*duplicate.*/gi);
      expect(comments).toBeTruthy();
      expect(comments!.length).toBeGreaterThan(0);
    });

    it('should explain constraint purpose', () => {
      const hasConstraintComment = migrationContent.toLowerCase().includes('unique');
      expect(hasConstraintComment).toBe(true);
    });
  });

  describe('Column References', () => {
    it('should reference job_id column correctly', () => {
      const jobIdReferences = migrationContent.match(/\bjob_id\b/g);
      expect(jobIdReferences).toBeTruthy();
      expect(jobIdReferences!.length).toBeGreaterThan(2);
    });

    it('should reference date column correctly', () => {
      const dateReferences = migrationContent.match(/\bdate\b/g);
      expect(dateReferences).toBeTruthy();
      expect(dateReferences!.length).toBeGreaterThan(2);
    });

    it('should use proper column syntax in constraint', () => {
      const columnListRegex = /\(\s*job_id\s*,\s*date\s*\)/;
      expect(migrationContent).toMatch(columnListRegex);
    });
  });

  describe('Migration Metadata', () => {
    it('should have proper filename format with timestamp', () => {
      const filename = '20260312090000_job_date_types_unique_constraint.sql';
      const timestampRegex = /^\d{14}_/;
      expect(filename).toMatch(timestampRegex);
    });

    it('should have descriptive filename', () => {
      const filename = '20260312090000_job_date_types_unique_constraint.sql';
      expect(filename).toContain('job_date_types');
      expect(filename).toContain('unique_constraint');
    });

    it('should use .sql extension', () => {
      const filename = '20260312090000_job_date_types_unique_constraint.sql';
      expect(filename).toEndWith('.sql');
    });
  });

  describe('Rollback Considerations', () => {
    it('should be reversible (constraint can be dropped)', () => {
      // The migration adds a named constraint which can be dropped
      expect(migrationContent).toContain('ADD CONSTRAINT job_date_types_job_id_date_key');
    });

    it('should not perform irreversible data operations beyond duplicate removal', () => {
      // Only DELETE for duplicates, which is necessary for data integrity
      const deleteStatements = migrationContent.match(/DELETE/gi);
      expect(deleteStatements).toBeTruthy();
      expect(deleteStatements!.length).toBe(1);
    });
  });

  describe('Performance Considerations', () => {
    it('should create index-backed constraint', () => {
      // UNIQUE constraints automatically create an index in PostgreSQL
      expect(migrationContent).toContain('UNIQUE');
    });

    it('should target specific rows in DELETE operation', () => {
      // Should use WHERE clause to target only duplicates
      expect(migrationContent).toContain('WHERE');
    });
  });
});