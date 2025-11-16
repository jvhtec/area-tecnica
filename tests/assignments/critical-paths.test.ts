import { describe, test } from 'vitest';

/**
 * Phase 0.2 - Assignments critical path documentation
 * ---------------------------------------------------
 * The conservative roadmap requires us to define and
 * protect the happy-path flows without touching the
 * production code. The todos below serve as executable
 * reminders for the future implementation team.
 */

describe('Assignments Critical Paths (Current Behavior)', () => {
  describe('Direct Assignment', () => {
    test.todo('Can assign technician to job');
    test.todo('Conflict detection prevents double-booking');
    test.todo('Creates timesheets automatically');
    test.todo('Single-day assignments work');
  });

  describe('Staffing Workflow', () => {
    test.todo('Availability request sends email');
    test.todo('Offer request sends email');
    test.todo('Confirmation creates assignment');
    test.todo('Expiry works correctly');
  });

  describe('Conflict Detection', () => {
    test.todo('Detects hard conflicts (confirmed assignments)');
    test.todo('Detects soft conflicts (pending assignments)');
    test.todo('Detects unavailability conflicts');
    test.todo('Handles overnight/multi-day jobs');
  });
});
