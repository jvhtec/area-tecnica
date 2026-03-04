import { describe, expect, it } from 'vitest';
import { isTaskAssigneeUniqueConflict } from '@/utils/taskAssignment';

describe('isTaskAssigneeUniqueConflict', () => {
  it('detects task assignee context unique conflicts', () => {
    const error = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "uq_lights_job_tasks_task_assignee_context"',
      details: 'Key (task_type, assigned_to, job_id, tour_id)=(QT, ..., ..., ...) already exists.',
    };

    expect(isTaskAssigneeUniqueConflict(error)).toBe(true);
  });

  it('returns false for other unique conflicts', () => {
    const error = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "profiles_email_key"',
    };

    expect(isTaskAssigneeUniqueConflict(error)).toBe(false);
  });

  it('returns false for non-unique errors', () => {
    const error = {
      code: 'PGRST116',
      message: 'No rows found',
    };

    expect(isTaskAssigneeUniqueConflict(error)).toBe(false);
  });
});

