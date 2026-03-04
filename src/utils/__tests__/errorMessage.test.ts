import { describe, expect, it } from 'vitest';
import { getErrorMessage } from '@/utils/errorMessage';

describe('getErrorMessage', () => {
  it('returns native Error messages', () => {
    expect(getErrorMessage(new Error('Something failed'))).toBe('Something failed');
  });

  it('returns readable message for Supabase-like objects', () => {
    const error = {
      message: 'duplicate key value violates unique constraint',
      details: 'Key (task_type, assigned_to, job_id, tour_id) already exists.',
      hint: null,
      code: '23505',
    };

    expect(getErrorMessage(error)).toContain('duplicate key value violates unique constraint');
    expect(getErrorMessage(error)).toContain('Key (task_type, assigned_to, job_id, tour_id) already exists.');
    expect(getErrorMessage(error)).toContain('Code: 23505');
  });

  it('joins arrays of error objects into one message', () => {
    const error = [
      { message: 'first problem' },
      { message: 'second problem', code: 'PGRST116' },
    ];

    const message = getErrorMessage(error);
    expect(message).toContain('first problem');
    expect(message).toContain('second problem');
    expect(message).toContain('Code: PGRST116');
  });

  it('does not return [object Object] for unknown objects', () => {
    const message = getErrorMessage({ foo: 'bar' });
    expect(message).not.toBe('[object Object]');
  });
});

