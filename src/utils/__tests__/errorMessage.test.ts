import { describe, expect, it } from 'vitest';
import {
  getErrorMessage,
  getErrorName,
  getErrorStack,
  getErrorStatus,
} from '@/utils/errorMessage';

describe('getErrorMessage', () => {
  it('returns native Error messages', () => {
    expect(getErrorMessage(new Error('Something failed'))).toBe('Something failed');
  });

  it('uses the caller fallback for a native Error without a message', () => {
    expect(getErrorMessage(new Error(), 'Operation failed')).toBe('Operation failed');
  });

  it('preserves a specific native error name when there is no message', () => {
    const error = new Error();
    error.name = 'AbortError';

    expect(getErrorMessage(error, 'Operation failed')).toBe('AbortError');
  });

  it('returns readable message for Supabase-like objects', () => {
    const error = {
      message: 'duplicate key value violates unique constraint',
      details: 'Key (task_type, assigned_to, job_id, tour_id) already exists.',
      hint: null as string | null,
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

  it('uses the caller fallback when an unknown value cannot be stringified', () => {
    expect(getErrorMessage(Object.create(null), 'Operation failed')).toBe('Operation failed');
    expect(
      getErrorMessage(
        {
          toJSON: (): undefined => undefined,
          toString: () => {
            throw new Error('string conversion failed');
          },
        },
        'Operation failed',
      ),
    ).toBe('Operation failed');
  });

  it('uses the caller fallback for missing and blank thrown values', () => {
    expect(getErrorMessage(null, 'Operation failed')).toBe('Operation failed');
    expect(getErrorMessage(undefined, 'Operation failed')).toBe('Operation failed');
    expect(getErrorMessage('   ', 'Operation failed')).toBe('Operation failed');
  });

  it('handles self-referential arrays without overflowing the stack', () => {
    const error: unknown[] = [new Error('inner failure')];
    error.push(error);

    expect(getErrorMessage(error)).toBe('inner failure');
  });
});

describe('error metadata helpers', () => {
  it('reads error names and stacks without assuming a native Error', () => {
    expect(getErrorName({ name: 'AbortError' })).toBe('AbortError');
    expect(getErrorStack({ stack: 'line one' })).toBe('line one');
    expect(getErrorName('AbortError')).toBeUndefined();
    expect(getErrorStack(null)).toBeUndefined();
  });
});

describe('getErrorStatus', () => {
  it('reads numeric and numeric-string HTTP error statuses', () => {
    expect(getErrorStatus({ status: 404 })).toBe(404);
    expect(getErrorStatus({ statusCode: '503' })).toBe(503);
    expect(getErrorStatus({ status: 'invalid', statusCode: 429 })).toBe(429);
  });

  it('rejects non-error and malformed statuses', () => {
    expect(getErrorStatus({ status: 200 })).toBeUndefined();
    expect(getErrorStatus({ status: 'not-a-status' })).toBeUndefined();
    expect(getErrorStatus({ status: Number.POSITIVE_INFINITY })).toBeUndefined();
  });
});
