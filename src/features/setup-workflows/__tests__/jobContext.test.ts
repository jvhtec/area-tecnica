import { describe, expect, it } from 'vitest';
import { getSetupJobDepartments, type SetupJob } from '../jobContext';

describe('getSetupJobDepartments', () => {
  it('deduplicates, sorts, and excludes identifiers unsupported by setup generation', () => {
    const job = {
      job_departments: [
        { department: 'sound' },
        { department: 'estructura' },
        { department: 'sound' },
        { department: 'unknown' },
      ],
    } as SetupJob;
    expect(getSetupJobDepartments(job)).toEqual(['estructura', 'sound']);
  });
});
