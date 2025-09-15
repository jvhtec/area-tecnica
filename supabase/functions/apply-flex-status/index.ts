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
        .select('id, element_id, parent_id, current_status')
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
    const isMaster = !folderRow?.parent_id; // if null => master
    const type: 'master'|'sub' = isMaster ? 'master' : 'sub';
    const workflowActionId = workflowActions[type][status];

    // Resolve Flex auth token: prefer env, else fetch via get-secret using caller's auth
    let flexAuthToken = Deno.env.get('X_AUTH_TOKEN') || '';
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

    const url = `https://sectorpro.flexrentalsolutions.com/f5/api/workflow-action/${targetElementId}/process/${workflowActionId}?bulkProcess=false`;
    const flexRes = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Auth-Token': flexAuthToken,
        'Content-Type': 'application/json',
      },
      body: '{}'
    });

    let responseJson: any = null;
    try { responseJson = await flexRes.json(); } catch { responseJson = { status: flexRes.status } }

    const success = flexRes.ok;

    // Update DB current_status if we have folder context
    if (folderRow) {
      await supabase
        .from('flex_folders')
        .update({ current_status: status })
        .eq('id', folderRow.id);

      // Log
      await supabase.from('flex_status_log').insert({
        folder_id: folderRow.id,
        previous_status: folderRow.current_status,
        new_status: status,
        action_type: 'api',
        processed_by: processedBy,
        success,
        flex_response: responseJson,
        error: success ? null : (typeof responseJson === 'object' ? JSON.stringify(responseJson) : String(responseJson))
      });

      // Cascade to children if requested and master
      if (success && cascade && isMaster) {
        const { data: children } = await supabase
          .from('flex_folders')
          .select('id, element_id, current_status')
          .eq('parent_id', folderRow.id);
        if (children && children.length) {
          for (const child of children) {
            try {
              const childUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/workflow-action/${child.element_id}/process/${workflowActions.sub[status]}?bulkProcess=false`;
              const childRes = await fetch(childUrl, {
                method: 'POST',
                headers: { 'X-Auth-Token': flexAuthToken, 'Content-Type': 'application/json' },
                body: '{}'
              });
              let childJson: any = null; try { childJson = await childRes.json(); } catch {}
              const childSuccess = childRes.ok;
              await supabase
                .from('flex_folders')
                .update({ current_status: status })
                .eq('id', child.id);
              await supabase.from('flex_status_log').insert({
                folder_id: child.id,
                previous_status: child.current_status,
                new_status: status,
                action_type: 'api',
                processed_by: processedBy,
                success: childSuccess,
                flex_response: childJson,
                error: childSuccess ? null : (typeof childJson === 'object' ? JSON.stringify(childJson) : String(childJson))
              });
            } catch (childErr) {
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
    return new Response(JSON.stringify({ success, response: responseJson }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});

  } catch (error: any) {
    console.error('apply-flex-status error:', error);
    // Return structured error with 200 to avoid opaque 5xx on client
    return new Response(JSON.stringify({ success: false, error: 'Internal server error', details: error?.message || String(error) }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  }
});
