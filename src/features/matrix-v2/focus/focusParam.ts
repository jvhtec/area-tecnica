/** `?trabajo=<job id>` opens the matrix already focused on a job. */
export const FOCUS_JOB_PARAM = 'trabajo';

export const focusJobIdFromSearch = (search: string): string | null => {
  const value = new URLSearchParams(search).get(FOCUS_JOB_PARAM)?.trim();
  return value ? value : null;
};

/** The same query string with the focused job set or removed; other parameters are kept. */
export function searchWithFocusJob(search: string, jobId: string | null): string {
  const params = new URLSearchParams(search);
  if (jobId) params.set(FOCUS_JOB_PARAM, jobId);
  else params.delete(FOCUS_JOB_PARAM);
  const next = params.toString();
  return next ? `?${next}` : '';
}
