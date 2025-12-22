import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Status = 'tentativa' | 'confirmado' | 'cancelado';

interface RequestBody {
  folder_id?: string;       // flex_folders.id
  element_id?: string;      // Flex documentId
  status: Status;
  cascade?: boolean;        // apply to children if master
}

const FLEX_API_BASE_URL = Deno.env.get('FLEX_API_BASE_URL') || 'https://sectorpro.flexrentalsolutions.com/f5/api';

const workflowActions: Record<'master'|'sub', Record<Status, string>> = {
  master: {
    confirmado: "7b46c4b7-a196-498a-9f83-787a0ed5ac88",
    tentativa:  "b7648474-3a2d-41ba-8c2f-c68499729a70",
    cancelado:  "e1a7f8d4-b48d-42dd-a570-1cb1aea474f0",
  },
  sub: {
    confirmado: "df6f44cc-b04f-11df-b8d5-00e08175e43e",
    tentativa:  "152062cc-b050-11df-b8d5-00e08175e43e",
    cancelado:  "34c0b30c-b050-11df-b8d5-00e08175e43e",
  }
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function extractFlexErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as any;
  if (typeof p.exceptionMessage === 'string' && p.exceptionMessage.trim()) return p.exceptionMessage.trim();
  if (typeof p.error === 'string' && p.error.trim()) return p.error.trim();
  if (p.success === false && typeof p.message === 'string' && p.message.trim()) return p.message.trim();
  return null;
}

function annotateFlexResponse(payload: unknown, meta: Record<string, unknown>, fallbackMessage?: string): Record<string, unknown> {
  if (isPlainObject(payload)) return { ...payload, __meta: meta };
  const res: Record<string, unknown> = { __meta: meta };
  if (fallbackMessage) res.message = fallbackMessage;
  if (payload !== undefined) res.payload = payload as any;
  return res;
}

async function callFlexWorkflowAction(args: {
  elementId: string;
  workflowActionId: string;
  flexAuthToken: string;
}): Promise<{
  ok: boolean;
  httpStatus: number;
  response: Record<string, unknown>;
  errorMessage: string | null;
}> {
  const { elementId, workflowActionId, flexAuthToken } = args;
  const url = `${FLEX_API_BASE_URL}/workflow-action/${encodeURIComponent(elementId)}/process/${encodeURIComponent(workflowActionId)}?bulkProcess=false`;

  const res = await fetch(url, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Auth-Token': flexAuthToken,
      'apikey': flexAuthToken,
      'X-Requested-With': 'XMLHttpRequest',
    },
    // Flex expects a JSON array of WorkflowJobParameter objects (can be empty).
    body: '[]',
  });

  const httpStatus = res.status;
  const contentType = res.headers.get('content-type') || '';
  const rawText = await res.text().catch(() => '');
  const hasBody = rawText.trim().length > 0;

  let parsed: unknown = null;
  if (hasBody) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }
  }

  const meta = {
    url,
    http_status: httpStatus,
    ok: res.ok,
    content_type: contentType,
    redirected: res.redirected,
  };

  // If Flex ever returns an HTML login page (or other non-JSON) with 200, avoid false positives.
  const jsonParsed = parsed !== null;
  const payloadError = extractFlexErrorMessage(parsed);
  const ok = res.ok && (!hasBody || jsonParsed) && !payloadError;

  const response = annotateFlexResponse(
    jsonParsed ? parsed : undefined,
    meta,
    jsonParsed ? undefined : (hasBody ? rawText.slice(0, 2000) : undefined)
  );

  const errorMessage =
    ok
      ? null
      : payloadError
        ? payloadError
        : jsonParsed
          ? `Flex request failed (HTTP ${httpStatus})`
          : hasBody
            ? `Flex returned a non-JSON response (HTTP ${httpStatus})`
            : `Flex request failed (HTTP ${httpStatus})`;

  return { ok, httpStatus, response, errorMessage };
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const body = await req.json() as RequestBody;
    const { folder_id, element_id, status, cascade = false } = body;
    let cascadeResult: null | {
      attempted: number;
      succeeded: number;
      failed: number;
      failures: Array<{
        folder_id: string;
        element_id?: string | null;
        department?: string | null;
        folder_type?: string | null;
        http_status?: number | null;
        error?: string | null;
      }>;
    } = null;

    if (!status || !['tentativa','confirmado','cancelado'].includes(status)) {
      return new Response(JSON.stringify({ error: 'Invalid or missing status' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    // Try to read user info (optional)
    let processedBy: string | null = null;
    const authHeader = req.headers.get('authorization') || undefined;
    try {
      if (authHeader) {
        const { data: { user } } = await supabase.auth.getUser((authHeader || '').replace('Bearer ', ''));
        processedBy = user?.id ?? null;
      }
    } catch {}

    // Load folder row if folder_id provided
    let folderRow: any = null;
    if (folder_id) {
      const { data, error } = await supabase
        .from('flex_folders')
        .select('id, element_id, parent_id, current_status, job_id, folder_type, department')
        .eq('id', folder_id)
        .single();
      if (error || !data) {
        return new Response(JSON.stringify({ error: 'Folder not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }
      folderRow = data;
    } else if (!element_id) {
      return new Response(JSON.stringify({ error: 'folder_id or element_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    const targetElementId = folderRow?.element_id || element_id!;
    const isMaster =
      folderRow
        ? String(folderRow.folder_type || '').toLowerCase() === 'main_event' || !folderRow.parent_id
        : true;
    const type: 'master'|'sub' = isMaster ? 'master' : 'sub';
    const workflowActionId = workflowActions[type][status];

    // Resolve Flex auth token: prefer env, else fetch via get-secret using caller's auth
    let flexAuthToken = Deno.env.get('X_AUTH_TOKEN') || Deno.env.get('FLEX_X_AUTH_TOKEN') || '';
    if (!flexAuthToken) {
      try {
        const { data: secretData, error: secretError } = await supabase.functions.invoke('get-secret', {
          body: { secretName: 'X_AUTH_TOKEN' },
          headers: authHeader ? { authorization: authHeader } : undefined,
        });
        if (!secretError && secretData?.X_AUTH_TOKEN) {
          flexAuthToken = secretData.X_AUTH_TOKEN as string;
        }
      } catch {}
    }
    if (!flexAuthToken) {
      return new Response(JSON.stringify({ success: false, error: 'Flex authentication token missing' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    const { ok: success, response: responseJson, errorMessage } = await callFlexWorkflowAction({
      elementId: targetElementId,
      workflowActionId,
      flexAuthToken,
    });

    // Update DB current_status if we have folder context
    if (folderRow) {
      if (success) {
        await supabase
          .from('flex_folders')
          .update({ current_status: status })
          .eq('id', folderRow.id);
      }

      // Log
      await supabase.from('flex_status_log').insert({
        folder_id: folderRow.id,
        previous_status: folderRow.current_status,
        new_status: status,
        action_type: 'api',
        processed_by: processedBy,
        success,
        flex_response: responseJson,
        error: success ? null : (errorMessage || JSON.stringify(responseJson))
      });

      // Cascade to children if requested and master
      if (success && cascade && isMaster) {
        // Try to locate department subfolders even if parent_id semantics differ (row id vs element id).
        const jobId = folderRow.job_id as string | null;
        const parentKeys = [folderRow.id as string | null, folderRow.element_id as string | null].filter(Boolean) as string[];

        let children: any[] = [];
        if (jobId) {
          if (parentKeys.length) {
            const { data } = await supabase
              .from('flex_folders')
              .select('id, element_id, current_status, parent_id, folder_type, department')
              .eq('job_id', jobId)
              .eq('folder_type', 'department')
              .in('parent_id', parentKeys);
            children = data || [];
          }

          // Fallback: if we still don't have children, just target all department folders for the job.
          if (!children.length) {
            const { data } = await supabase
              .from('flex_folders')
              .select('id, element_id, current_status, parent_id, folder_type, department')
              .eq('job_id', jobId)
              .eq('folder_type', 'department');
            children = data || [];
          }
        }

        cascadeResult = {
          attempted: children.length,
          succeeded: 0,
          failed: 0,
          failures: [],
        };

        if (children.length) {
          for (const child of children) {
            try {
              if (!child?.element_id) {
                cascadeResult.failed += 1;
                cascadeResult.failures.push({
                  folder_id: child?.id || 'unknown',
                  element_id: child?.element_id || null,
                  department: child?.department || null,
                  folder_type: child?.folder_type || null,
                  http_status: null,
                  error: 'Missing child element_id',
                });
                continue;
              }
              const { ok: childSuccess, response: childJson, errorMessage: childErrorMessage } = await callFlexWorkflowAction({
                elementId: child.element_id,
                workflowActionId: workflowActions.sub[status],
                flexAuthToken,
              });

              if (childSuccess) {
                await supabase
                  .from('flex_folders')
                  .update({ current_status: status })
                  .eq('id', child.id);
                cascadeResult.succeeded += 1;
              } else {
                cascadeResult.failed += 1;
                cascadeResult.failures.push({
                  folder_id: child.id,
                  element_id: child.element_id,
                  department: child.department || null,
                  folder_type: child.folder_type || null,
                  http_status: (childJson as any)?.__meta?.http_status ?? null,
                  error: childErrorMessage || JSON.stringify(childJson),
                });
              }

              await supabase.from('flex_status_log').insert({
                folder_id: child.id,
                previous_status: child.current_status,
                new_status: status,
                action_type: 'api',
                processed_by: processedBy,
                success: childSuccess,
                flex_response: childJson,
                error: childSuccess ? null : (childErrorMessage || JSON.stringify(childJson))
              });
            } catch (childErr) {
              cascadeResult.failed += 1;
              cascadeResult.failures.push({
                folder_id: child?.id || 'unknown',
                element_id: child?.element_id || null,
                department: child?.department || null,
                folder_type: child?.folder_type || null,
                http_status: null,
                error: String(childErr),
              });
              await supabase.from('flex_status_log').insert({
                folder_id: child.id,
                previous_status: child.current_status,
                new_status: status,
                action_type: 'api',
                processed_by: processedBy,
                success: false,
                error: String(childErr)
              });
            }
          }
        }
      }
    }

    // Always return 200 so clients can parse structured result
    return new Response(JSON.stringify({ success, response: responseJson, error: success ? null : errorMessage, cascade: cascadeResult }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});

  } catch (error: any) {
    console.error('apply-flex-status error:', error);
    // Return structured error with 200 to avoid opaque 5xx on client
    return new Response(JSON.stringify({ success: false, error: 'Internal server error', details: error?.message || String(error) }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  }
});
