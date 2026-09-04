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
