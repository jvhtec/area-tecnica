import { describe, expect, it } from 'vitest';
import { getSetupReturnPath, withJobSetupReturn } from '../returnNavigation';

describe('setup workflow return navigation', () => {
  it('preserves tool parameters and adds the exact Job setup hub', () => {
    const url = new URL(withJobSetupReturn('/sound/pesos?jobId=job-1', 'job-1'), 'https://app.test');
    expect(url.pathname).toBe('/sound/pesos');
    expect(url.searchParams.get('jobId')).toBe('job-1');
    expect(url.searchParams.get('setupReturnTo')).toBe('/jobs/job-1/setup');
  });

  it('accepts only internal Job setup paths as return targets', () => {
    expect(getSetupReturnPath(new URLSearchParams({ setupReturnTo: '/jobs/job-1/setup' }))).toBe('/jobs/job-1/setup');
    expect(getSetupReturnPath(new URLSearchParams({ setupReturnTo: 'https://example.com' }))).toBeNull();
    expect(getSetupReturnPath(new URLSearchParams({ setupReturnTo: '/project-management' }))).toBeNull();
  });
});
