import { describe, expect, it } from 'vitest';
import { resolveTaskDocBucket, sanitizeFileName } from './support';

describe('global task mutation support', () => {
  it('routes task, job, and tour document paths to their storage buckets', () => {
    expect(resolveTaskDocBucket('sound/job-1/task-1/file.pdf')).toBe('job_documents');
    expect(resolveTaskDocBucket('/schedules/tour-1/task-1/file.pdf')).toBe('tour-documents');
    expect(resolveTaskDocBucket('task-1/file.pdf')).toBe('task_documents');
  });

  it('sanitizes filenames consistently for mirrored storage paths', () => {
    expect(sanitizeFileName('Plano escenario (final).pdf')).toBe('Plano_escenario__final_.pdf');
  });
});
