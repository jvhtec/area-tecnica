
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { businessRoleIdFor, inferTierFromRoleCode } from './flexBusinessRoles.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  job_id: string;
  technician_id: string;
  department: 'sound' | 'lights';
  action: 'add' | 'remove';
}

async function resolveActorId(supabase: ReturnType<typeof createClient>, req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) {
      console.warn('[manage-flex-crew-assignments] Unable to resolve actor id:', error);
      return null;
    }
    return data.user?.id ?? null;
  } catch (err) {
    console.warn('[manage-flex-crew-assignments] Error resolving actor id', err);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { job_id, technician_id, department, action } = await req.json() as RequestBody;
    const actorId = await resolveActorId(supabase, req);

    console.log(`Managing Flex crew assignment: ${action} technician ${technician_id} for job ${job_id} in department ${department}`);

    // Get technician's flex_resource_id
    const { data: technician, error: techError } = await supabase
      .from('profiles')
      .select('flex_resource_id, first_name, last_name')
      .eq('id', technician_id)
      .single();

    if (techError || !technician) {
      console.error('Error fetching technician:', techError);
      return new Response(
        JSON.stringify({ error: 'Technician not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!technician.flex_resource_id) {
      console.log(`Technician ${technician.first_name} ${technician.last_name} has no flex_resource_id, skipping Flex API call`);
      return new Response(
        JSON.stringify({ success: true, message: 'Technician has no Flex resource ID, skipped API call' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get crew call for this job and department
    const { data: crewCall, error: crewCallError } = await supabase
      .from('flex_crew_calls')
      .select('id, flex_element_id')
      .eq('job_id', job_id)
      .eq('department', department)
      .single();

    if (crewCallError || !crewCall) {
      console.error('Error fetching crew call:', crewCallError);
      return new Response(
        JSON.stringify({ error: 'Crew call not found for this job and department' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const flexAuthToken = Deno.env.get('X_AUTH_TOKEN');
    if (!flexAuthToken) {
      console.error('X_AUTH_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Flex authentication not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'add') {
      // Check if assignment already exists
      const { data: existingAssignment } = await supabase
        .from('flex_crew_assignments')
        .select('id, flex_line_item_id')
        .eq('crew_call_id', crewCall.id)
        .eq('technician_id', technician_id)
        .maybeSingle();

      let effectiveLineItemId: string | null = existingAssignment?.flex_line_item_id ?? null;
      const alreadyExists = !!existingAssignment;

      // Add resource to crew call
      const addUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${crewCall.flex_element_id}/add-resource/${technician.flex_resource_id}`;
      
      console.log(`Adding resource to Flex crew call: ${addUrl}`);

      const flexHeaders: Record<string,string> = {
        'X-Auth-Token': flexAuthToken,
        'apikey': flexAuthToken,
        'X-Requested-With': 'XMLHttpRequest',
        'X-API-Client': 'flex5-desktop',
        'Accept': '*/*',
      };

      if (!alreadyExists) {
        // Attempt 1: simple POST
        let addOk = false;
        let addResult: any = {};
        try {
          const addResponse = await fetch(addUrl, { method: 'POST', headers: flexHeaders });
          addOk = addResponse.ok;
          addResult = addOk ? await addResponse.json().catch(() => ({} as any)) : {};
        } catch (_) {}

        // Attempt 2: form-encoded POST
        if (!addOk) {
          try {
            const params = new URLSearchParams();
            params.set('resourceParentId', '');
            params.set('managedResourceLineItemType', 'contact');
            params.set('quantity', '1');
            params.set('parentLineItemId', '');
            params.set('nextSiblingId', '');
            const addResponse2 = await fetch(addUrl, { method: 'POST', headers: { ...flexHeaders, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body: params.toString() });
            addOk = addResponse2.ok;
            addResult = addOk ? await addResponse2.json().catch(() => ({} as any)) : {};
          } catch (_) {}
        }

        if (!addOk) {
          console.error('Failed to add resource to Flex crew call via both attempts');
        }

        // Extract lineItemId from various response shapes observed
        const extractedLineItemId: string | null = (addResult && (
          addResult.id || addResult.lineItemId || (addResult.data && (addResult.data.id || addResult.data.lineItemId)) || (Array.isArray(addResult.addedResourceLineIds) && addResult.addedResourceLineIds[0])
        )) || null;
        console.log('Add response parsed line item id:', extractedLineItemId, 'raw:', addResult);

        // Start with extracted id
        effectiveLineItemId = extractedLineItemId as string | null;
      }

      // Discover lineItemId if missing by scanning row-data for this resourceId (works for both new and existing)
      if (!effectiveLineItemId) {
        try {
          const qs3 = new URLSearchParams();
          qs3.set('_dc', String(Date.now()));
          for (const c of ['contact','business-role','pickup-date','return-date','notes','quantity','status']) qs3.append('codeList', c);
          qs3.set('node', 'root');
          const rdUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${encodeURIComponent(crewCall.flex_element_id)}/row-data/?${qs3.toString()}`;
          const rdRes = await fetch(rdUrl, { headers: flexHeaders });
          if (rdRes.ok) {
            const arr = await rdRes.json().catch(() => null) as any;
            if (Array.isArray(arr)) {
              const resId = technician.flex_resource_id as string;
              // Some responses expose resourceId at top-level, others under resource.id or resource.resourceId
              const hit = arr.find((r: any) => {
                const cand = r?.resourceId || r?.resource?.id || r?.resource?.resourceId;
                return cand === resId;
              });
              if (hit?.id) effectiveLineItemId = hit.id as string;
            }
          }
        } catch (_) { /* ignore */ }
      }

      // Fallback: try findRowData endpoint if still missing
      if (!effectiveLineItemId) {
        try {
          const qs4 = new URLSearchParams();
          for (const c of ['contact','business-role','pickup-date','return-date','notes','quantity','status']) qs4.append('codeList', c);
          const rdUrl2 = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${encodeURIComponent(crewCall.flex_element_id)}/row-data/findRowData?${qs4.toString()}`;
          const rdRes2 = await fetch(rdUrl2, { headers: flexHeaders });
          if (rdRes2.ok) {
            const arr2 = await rdRes2.json().catch(() => null) as any;
            if (Array.isArray(arr2)) {
              const resId = technician.flex_resource_id as string;
              const hit2 = arr2.find((r: any) => {
                const cand = r?.resourceId || r?.resource?.id || r?.resource?.resourceId;
                return cand === resId;
              });
              if (hit2?.id) effectiveLineItemId = hit2.id as string;
            }
          }
        } catch (_) { /* ignore */ }
      }

      // Store or update the assignment with the line item ID
      if (!alreadyExists) {
        const { error: insertError } = await supabase
          .from('flex_crew_assignments')
          .insert({
            crew_call_id: crewCall.id,
            technician_id: technician_id,
            flex_line_item_id: effectiveLineItemId
          });
        if (insertError) {
          console.error('Error storing crew assignment:', insertError);
          return new Response(
            JSON.stringify({ error: 'Failed to store assignment in database' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else if (!existingAssignment?.flex_line_item_id && effectiveLineItemId) {
        // Backfill missing line item id if we discovered it
        await supabase
          .from('flex_crew_assignments')
          .update({ flex_line_item_id: effectiveLineItemId })
          .eq('id', existingAssignment!.id);
      }

      // Attempt to set business-role for SOUND department after adding
      try {
        if (department === 'sound' && (effectiveLineItemId)) {
          const { data: ja } = await supabase
            .from('job_assignments')
            .select('sound_role')
            .eq('job_id', job_id)
            .eq('technician_id', technician_id)
            .maybeSingle();
          const role = ja?.sound_role ?? null;
          const tier = inferTierFromRoleCode(role);
          const roleId = businessRoleIdFor('sound', tier);
          if (roleId) {
            const rowDataUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${encodeURIComponent(crewCall.flex_element_id)}/row-data/`;
            const setRes = await fetch(rowDataUrl, {
              method: 'POST',
              headers: { ...flexHeaders, 'Content-Type': 'application/json' },
              body: JSON.stringify({ lineItemId: effectiveLineItemId, fieldType: 'business-role', payloadValue: roleId })
            });
            if (!setRes.ok) {
              console.warn('[manage-flex-crew-assignments] Failed to set business-role', setRes.status);
            }
          }
        }
      } catch (err) {
        console.warn('[manage-flex-crew-assignments] Error attempting to set business-role', err);
      }

      try {
        const logActivity = async () => {
          await supabase.rpc('log_activity_as', {
            _actor_id: actorId,
            _code: 'flex.crew.updated',
            _job_id: job_id,
            _entity_type: 'flex',
            _entity_id: crewCall.id,
            _payload: {
              action: 'add',
              department,
              technician_id,
            },
            _visibility: null,
          });
        };

        if (typeof EdgeRuntime !== 'undefined' && 'waitUntil' in EdgeRuntime) {
          EdgeRuntime.waitUntil(logActivity());
        } else {
          await logActivity();
        }
      } catch (activityError) {
        console.warn('[manage-flex-crew-assignments] Failed to log add activity', activityError);
      }

      return new Response(
        JSON.stringify({ success: true, message: alreadyExists ? 'Assignment already exists (role updated if applicable)' : 'Resource added to crew call', flex_line_item_id: effectiveLineItemId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'remove') {
      // Get existing assignment
      const { data: assignment, error: assignmentError } = await supabase
        .from('flex_crew_assignments')
        .select('id, flex_line_item_id')
        .eq('crew_call_id', crewCall.id)
        .eq('technician_id', technician_id)
        .single();

      if (assignmentError || !assignment) {
        console.log(`No assignment found for technician ${technician_id} in crew call ${crewCall.id}`);
        return new Response(
          JSON.stringify({ success: true, message: 'No assignment to remove' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Remove from Flex
      const removeUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${assignment.flex_line_item_id}`;
      
      console.log(`Removing line item from Flex: ${removeUrl}`);
      
      const removeResponse = await fetch(removeUrl, {
        method: 'DELETE',
        headers: {
          'X-Auth-Token': flexAuthToken,
          'apikey': flexAuthToken,
        },
      });

      if (!removeResponse.ok) {
        const errorText = await removeResponse.text();
        console.error(`Failed to remove line item from Flex: ${removeResponse.status} - ${errorText}`);
        return new Response(
          JSON.stringify({ error: `Failed to remove from Flex: ${removeResponse.status}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Successfully removed line item from Flex');

      // Remove from database
      const { error: deleteError } = await supabase
        .from('flex_crew_assignments')
        .delete()
        .eq('id', assignment.id);

      if (deleteError) {
        console.error('Error removing crew assignment from database:', deleteError);
        return new Response(
          JSON.stringify({ error: 'Failed to remove assignment from database' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const logActivity = async () => {
          await supabase.rpc('log_activity_as', {
            _actor_id: actorId,
            _code: 'flex.crew.updated',
            _job_id: job_id,
            _entity_type: 'flex',
            _entity_id: crewCall.id,
            _payload: {
              action: 'remove',
              department,
              technician_id,
            },
            _visibility: null,
          });
        };

        if (typeof EdgeRuntime !== 'undefined' && 'waitUntil' in EdgeRuntime) {
          EdgeRuntime.waitUntil(logActivity());
        } else {
          await logActivity();
        }
      } catch (activityError) {
        console.warn('[manage-flex-crew-assignments] Failed to log remove activity', activityError);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Resource removed from crew call' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in manage-flex-crew-assignments:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
