export const SETUP_RETURN_PARAM = 'setupReturnTo';

export function getJobSetupPath(jobId: string) {
  return `/jobs/${encodeURIComponent(jobId)}/setup`;
}

export function withJobSetupReturn(href: string, jobId: string) {
  const [path, query = ''] = href.split('?');
  const params = new URLSearchParams(query);
  params.set(SETUP_RETURN_PARAM, getJobSetupPath(jobId));
  return `${path}?${params.toString()}`;
}

export function getSetupReturnPath(searchParams: URLSearchParams) {
  const value = searchParams.get(SETUP_RETURN_PARAM);
  return value && /^\/jobs\/[^/?#]+\/setup$/.test(value) ? value : null;
}

/**
 * Calculator tools are reachable from a project card as well as department
 * workspaces and guided setup. Preserve the explicit origin rather than
 * silently sending project-management users to a department dashboard.
 *
 * Only the fixed internal project route is accepted. Never navigate to an
 * arbitrary value supplied by a URL query parameter.
 */
export const PROJECT_RETURN_PARAM = 'projectReturnTo';
export const PROJECT_MANAGEMENT_PATH = '/project-management';

export function withProjectManagementReturn(href: string) {
  const [path, query = ''] = href.split('?');
  const params = new URLSearchParams(query);
  params.set(PROJECT_RETURN_PARAM, PROJECT_MANAGEMENT_PATH);
  return `${path}?${params.toString()}`;
}

/**
 * The return target keeps the originating job (`setupJobId`, already understood by
 * Project Management) so the page reopens on that job's month/department/card
 * instead of today's defaults. The destination path itself is fixed.
 */
export function getProjectManagementReturnPath(searchParams: URLSearchParams): string | null {
  if (searchParams.get(PROJECT_RETURN_PARAM) !== PROJECT_MANAGEMENT_PATH) return null;
  const jobId = searchParams.get('jobId');
  return jobId
    ? `${PROJECT_MANAGEMENT_PATH}?setupJobId=${encodeURIComponent(jobId)}`
    : PROJECT_MANAGEMENT_PATH;
}

/** Guided setup has precedence when both origins are present. */
export function getCalculatorReturnPath(searchParams: URLSearchParams): string | null {
  return getSetupReturnPath(searchParams) ?? getProjectManagementReturnPath(searchParams);
}
