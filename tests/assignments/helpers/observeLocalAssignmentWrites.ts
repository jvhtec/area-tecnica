type TransportEvent = { kind: 'dispatch' | 'complete'; path: string; jobId?: string; date?: string; status?: number };

/** Observe real SDK transport, recording only assignment route and owned tuple fields. */
export function observeLocalAssignmentWrites(fetch: typeof globalThis.fetch) {
  const events: TransportEvent[] = [];
  const observed: typeof globalThis.fetch = async (input, options) => {
    const path = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).pathname;
    const tracked = path === '/rest/v1/job_assignments' && options?.method === 'POST' || path === '/rest/v1/rpc/toggle_timesheet_day';
    const json: unknown = tracked && typeof options?.body === 'string' ? JSON.parse(options.body) : {};
    const item: unknown = Array.isArray(json) ? json[0] : json;
    const body = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const jobId = typeof body.job_id === 'string' ? body.job_id : typeof body.p_job_id === 'string' ? body.p_job_id : undefined;
    const date = typeof body.p_date === 'string' ? body.p_date : undefined;
    if (tracked) events.push({ kind: 'dispatch', path, jobId, date });
    // The wrapped SDK observer proves cloned-body completion before returning.
    const response = await fetch(input, options);
    if (tracked) events.push({ kind: 'complete', path, jobId, date, status: response.status });
    return response;
  };
  return { events, fetch: observed };
}
