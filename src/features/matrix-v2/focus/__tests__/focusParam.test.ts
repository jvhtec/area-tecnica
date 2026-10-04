import { describe, expect, it } from 'vitest';
import { focusJobIdFromSearch, searchWithFocusJob } from '@/features/matrix-v2/focus/focusParam';

describe('?trabajo=', () => {
  it('reads the focused job', () => {
    expect(focusJobIdFromSearch('?trabajo=abc-123')).toBe('abc-123');
    expect(focusJobIdFromSearch('?matriz=v2&trabajo=abc')).toBe('abc');
    expect(focusJobIdFromSearch('?trabajo=')).toBeNull();
    expect(focusJobIdFromSearch('')).toBeNull();
  });

  it('sets and removes it without touching other parameters', () => {
    expect(searchWithFocusJob('', 'abc')).toBe('?trabajo=abc');
    expect(searchWithFocusJob('?matriz=v2', 'abc')).toBe('?matriz=v2&trabajo=abc');
    expect(searchWithFocusJob('?matriz=v2&trabajo=abc', null)).toBe('?matriz=v2');
    expect(searchWithFocusJob('?trabajo=abc', null)).toBe('');
  });
});
