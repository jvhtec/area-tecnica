import { describe, expect, it } from 'vitest';
import { getCalculatorReturnPath, getProjectManagementReturnPath, getSetupReturnPath, withJobSetupReturn, withProjectManagementReturn } from '../returnNavigation';

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

describe('calculator project return navigation (#1005)', () => {
  it.each(['/sound/pesos', '/sound/consumos', '/lights-pesos-tool', '/lights-consumos-tool', '/video-pesos-tool', '/video-consumos-tool'])(
    'preserves the project card origin and jobId for %s',
    (path) => {
      const url = new URL(withProjectManagementReturn(`${path}?jobId=job-1`), 'https://app.test');
      expect(url.pathname).toBe(path);
      expect(url.searchParams.get('jobId')).toBe('job-1');
      expect(getCalculatorReturnPath(url.searchParams)).toBe('/project-management');
    },
  );

  it('rejects user-controlled/external return destinations', () => {
    for (const destination of [
      'https://example.com',
      '//example.com',
      '/project-management/../auth',
      '/project-management?untrusted=1',
      '/sound',
      '/jobs/another-job/setup',
    ]) {
      const params = new URLSearchParams({ projectReturnTo: destination });
      expect(getProjectManagementReturnPath(params)).toBeNull();
      expect(getCalculatorReturnPath(params)).toBeNull();
    }
  });

  it('honors the guided setup return over the project return', () => {
    const params = new URLSearchParams({
      setupReturnTo: '/jobs/job-1/setup',
      projectReturnTo: '/project-management',
    });
    expect(getCalculatorReturnPath(params)).toBe('/jobs/job-1/setup');
  });

  it('does not override navigation from a department or tour when no origin exists', () => {
    expect(getCalculatorReturnPath(new URLSearchParams('jobId=job-1'))).toBeNull();
  });
});
