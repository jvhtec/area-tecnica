import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireAdminOrManagement } from '../_shared/auth.ts';
import { reconcileFlexCrew } from '../_shared/flexCrewReconciliation.ts';
import { createHttpHandler, HttpError, jsonResponse, readBoundedJsonObject } from '../_shared/http.ts';

/** Legacy add/remove bodies now request current-state crew reconciliation. */
serve(createHttpHandler(async (req) => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  const caller = await requireAdminOrManagement(supabase, req, { logContext: 'manage-flex-crew-assignments' });
  const body = await readBoundedJsonObject(req);
  const { job_id, department, action } = body;
  if (typeof job_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(job_id)
    || (department !== 'sound' && department !== 'lights')
    || !['add', 'remove', 'reconcile'].includes(String(action))) {
    throw new HttpError(400, 'Job, supported department and action are required');
  }
  const token = Deno.env.get('X_AUTH_TOKEN') || Deno.env.get('FLEX_X_AUTH_TOKEN') || '';
  if (!token) throw new HttpError(503, 'Flex authentication not configured');
  const summary = await reconcileFlexCrew(supabase, job_id, department, token);
  const { error } = await supabase.rpc('log_activity_as', {
    _actor_id: caller.userId, _code: 'flex.crew.updated', _job_id: job_id,
    _entity_type: 'flex', _entity_id: null,
    _payload: { action: 'reconcile', department, ...summary }, _visibility: null,
  });
  if (error) console.warn('Could not record Flex reconciliation activity', error);
  return jsonResponse({ success: true, message: 'Crew reconciled to current assignments', ...summary });
}, { allowedMethods: ['POST'] }));
