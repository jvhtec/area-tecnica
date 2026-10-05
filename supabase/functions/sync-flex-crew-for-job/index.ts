import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireAdminOrManagement } from '../_shared/auth.ts';
import { reconcileFlexCrew } from '../_shared/flexCrewReconciliation.ts';
import { createHttpHandler, HttpError, jsonResponse, readBoundedJsonObject } from '../_shared/http.ts';

/** Bulk and single sync share durable ownership of each physical crew call. */
serve(createHttpHandler(async (req) => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  await requireAdminOrManagement(supabase, req, { logContext: 'sync-flex-crew-for-job' });
  const body = await readBoundedJsonObject(req);
  if (typeof body.job_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.job_id)) {
    throw new HttpError(400, 'Job is required');
  }
  const token = Deno.env.get('X_AUTH_TOKEN') || Deno.env.get('FLEX_X_AUTH_TOKEN') || '';
  if (!token) throw new HttpError(503, 'Flex authentication not configured');
  const requested = body.departments;
  if (requested !== undefined && (!Array.isArray(requested)
    || requested.some(d => d !== 'sound' && d !== 'lights'))) {
    throw new HttpError(400, 'Only sound and lights crew calls are supported');
  }
  const { data: calls, error } = await supabase.from('flex_crew_calls')
    .select('department').eq('job_id', body.job_id);
  if (error) throw new HttpError(503, 'Could not load crew calls');
  const departments = [...new Set((calls ?? []).map(c => c.department))]
    .filter((d): d is 'sound' | 'lights' => (d === 'sound' || d === 'lights')
      && (!Array.isArray(requested) || requested.length === 0 || requested.includes(d)));
  const summary: Record<string, Awaited<ReturnType<typeof reconcileFlexCrew>>> = {};
  for (const department of departments) {
    summary[department] = await reconcileFlexCrew(supabase, body.job_id, department, token);
  }
  return jsonResponse({ ok: true, job_id: body.job_id, summary });
}, { allowedMethods: ['POST'] }));
