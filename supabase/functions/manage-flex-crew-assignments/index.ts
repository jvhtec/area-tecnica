
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import { businessRoleIdFor, inferTierFromRoleCode } from './flexBusinessRoles.ts'
import { resolveFlexAuthToken } from '../_shared/flexAuthToken.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface RequestBody {
  job_id: string;
  technician_id: string;
  department: 'sound' | 'lights';
  action: 'add' | 'remove';
}

interface InsertError {
  crew_call_id: string;
  technician_id: string;
  flex_line_item_id: string | null;
  error_message: string;
}

interface FlexCrewAssignment {
  id: string;
  technician_id: string;
  flex_line_item_id: string | null;
}

/** Standard codeList params for Flex row-data queries */
const FLEX_CODE_LIST = ['contact', 'business-role', 'pickup-date', 'return-date', 'notes', 'quantity', 'status'] as const;

/** Build query params for Flex row-data endpoint */
function buildFlexRowDataParams(includeTimestamp = true): URLSearchParams {
  const qs = new URLSearchParams();
  if (includeTimestamp) {
    qs.set('_dc', String(Date.now()));
  }
  for (const c of FLEX_CODE_LIST) {
    qs.append('codeList', c);
  }
  qs.set('node', 'root');
  return qs;
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

/**
 * Discover a line item ID by scanning Flex row-data for a given resource ID.
 * Returns the line item ID if found, null otherwise.
 */
async function discoverLineItemId(
  crewCallElementId: string,
  resourceId: string,
  flexHeaders: Record<string, string>
): Promise<string | null> {
  // Attempt 1: row-data endpoint
  try {
    const qs = buildFlexRowDataParams();
    const rdUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${encodeURIComponent(crewCallElementId)}/row-data/?${qs.toString()}`;
    const rdRes = await fetch(rdUrl, { headers: flexHeaders });
    if (rdRes.ok) {
      const arr = await rdRes.json().catch(() => null) as any;
      if (Array.isArray(arr)) {
        const hit = arr.find((r: any) => {
          const cand = r?.resourceId || r?.resource?.id || r?.resource?.resourceId;
          return cand === resourceId;
        });
        if (hit?.id) return hit.id as string;
      }
    }
  } catch (e) {
    console.debug('[discoverLineItemId] row-data attempt failed:', e);
  }

  // Attempt 2: findRowData fallback
  try {
    const qs2 = buildFlexRowDataParams(false);
    const rdUrl2 = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${encodeURIComponent(crewCallElementId)}/row-data/findRowData?${qs2.toString()}`;
    const rdRes2 = await fetch(rdUrl2, { headers: flexHeaders });
    if (rdRes2.ok) {
      const arr2 = await rdRes2.json().catch(() => null) as any;
      if (Array.isArray(arr2)) {
        const hit2 = arr2.find((r: any) => {
          const cand = r?.resourceId || r?.resource?.id || r?.resource?.resourceId;
          return cand === resourceId;
        });
        if (hit2?.id) return hit2.id as string;
      }
    }
  } catch (e) {
    console.debug('[discoverLineItemId] findRowData attempt failed:', e);
  }

  return null;
}

/**
 * Set business role for a line item in a crew call (SOUND department only).
 */
async function setBusinessRole(
  supabase: ReturnType<typeof createClient>,
  department: string,
  jobId: string,
  technicianId: string,
  crewCallElementId: string,
  lineItemId: string,
  flexHeaders: Record<string, string>
): Promise<void> {
  if (department !== 'sound' || !lineItemId) return;

  try {
    const { data: ja } = await supabase
      .from('job_assignments')
      .select('sound_role')
      .eq('job_id', jobId)
      .eq('technician_id', technicianId)
      .maybeSingle();

    const role = ja?.sound_role ?? null;
    const tier = inferTierFromRoleCode(role);
    const roleId = businessRoleIdFor('sound', tier);

    if (roleId) {
      const rowDataUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${encodeURIComponent(crewCallElementId)}/row-data/`;
      const setRes = await fetch(rowDataUrl, {
        method: 'POST',
        headers: { ...flexHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineItemId, fieldType: 'business-role', payloadValue: roleId })
      });
      if (!setRes.ok) {
        console.warn('[setBusinessRole] Failed to set business-role', setRes.status);
      }
    }
  } catch (err) {
    console.warn('[setBusinessRole] Error setting business-role', err);
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
    
    // Require authenticated actor for write operations
    if (!actorId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const flexAuthToken = await resolveFlexAuthToken(supabase, actorId);
    if (!flexAuthToken) {
      console.error('No Flex API token available');
      return new Response(
        JSON.stringify({ error: 'Flex authentication not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Define flexHeaders once after token validation
    const flexHeaders: Record<string, string> = {
      'X-Auth-Token': flexAuthToken,
      'apikey': flexAuthToken,
      'X-Requested-With': 'XMLHttpRequest',
      'X-API-Client': 'flex5-desktop',
      'Accept': '*/*',
    };

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

      if (!alreadyExists) {
        // Attempt 1: simple POST
        let addOk = false;
        let addResult: any = {};
        try {
          const addResponse = await fetch(addUrl, { method: 'POST', headers: flexHeaders });
          addOk = addResponse.ok;
          addResult = addOk ? await addResponse.json().catch(() => ({} as any)) : {};
        } catch (e) {
          console.debug('[add] Simple POST failed:', e);
        }

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
          } catch (e) {
            console.debug('[add] Form-encoded POST failed:', e);
          }
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

      // Discover lineItemId if missing
      if (!effectiveLineItemId) {
        effectiveLineItemId = await discoverLineItemId(crewCall.flex_element_id, technician.flex_resource_id, flexHeaders);
        if (effectiveLineItemId) {
          console.log('Discovered line item ID:', effectiveLineItemId);
        }
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

      // Set business-role for SOUND department (setBusinessRole guards against null lineItemId)
      if (effectiveLineItemId) {
        await setBusinessRole(supabase, department, job_id, technician_id, crewCall.flex_element_id, effectiveLineItemId, flexHeaders);
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

      let lineItemIdToDelete = assignment.flex_line_item_id;

      // If line item ID is missing, try to discover it
      if (!lineItemIdToDelete) {
        console.log(`Line item ID missing for assignment ${assignment.id}, attempting discovery...`);
        lineItemIdToDelete = await discoverLineItemId(crewCall.flex_element_id, technician.flex_resource_id, flexHeaders);
        if (lineItemIdToDelete) {
          console.log(`Discovered line item ID: ${lineItemIdToDelete}`);
        }
      }

      // If we still don't have a line item ID, fall back to clear-and-repopulate
      if (!lineItemIdToDelete) {
        console.log('Line item ID discovery failed, falling back to clear-and-repopulate strategy');

        // 1. Get all current flex_crew_assignments for this crew call
        const { data: allAssignments } = await supabase
          .from('flex_crew_assignments')
          .select('id, technician_id, flex_line_item_id')
          .eq('crew_call_id', crewCall.id) as { data: FlexCrewAssignment[] | null };

        // 2. Get technicians that should remain (all except the one being removed)
        const remainingTechIds = (allAssignments ?? [])
          .filter((a) => a.technician_id !== technician_id)
          .map((a) => a.technician_id);

        // 3. Get flex_resource_ids for remaining technicians
        const { data: remainingTechs } = remainingTechIds.length > 0
          ? await supabase
              .from('profiles')
              .select('id, flex_resource_id')
              .in('id', remainingTechIds)
          : { data: [] };

        // 4. Delete all line items from Flex for this crew call
        const deletionErrors: { itemId: string; status: number; message: string }[] = [];
        try {
          const qs = buildFlexRowDataParams();
          const rdUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${encodeURIComponent(crewCall.flex_element_id)}/row-data/?${qs.toString()}`;
          const rdRes = await fetch(rdUrl, { headers: flexHeaders });
          if (rdRes.ok) {
            const arr = await rdRes.json().catch(() => null) as any;
            if (Array.isArray(arr)) {
              // Delete each contact line item with error tracking
              for (const item of arr) {
                if (item?.id) {
                  const delUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${item.id}`;
                  try {
                    const delRes = await fetch(delUrl, { method: 'DELETE', headers: flexHeaders });
                    if (!delRes.ok) {
                      const errorText = await delRes.text().catch(() => 'Unknown error');
                      deletionErrors.push({ itemId: item.id, status: delRes.status, message: errorText });
                      console.error(`[clear-and-repopulate] Failed to delete line item ${item.id}: ${delRes.status} - ${errorText}`);
                    }
                  } catch (e) {
                    const errMsg = e instanceof Error ? e.message : String(e);
                    deletionErrors.push({ itemId: item.id, status: 0, message: errMsg });
                    console.error(`[clear-and-repopulate] Exception deleting line item ${item.id}:`, e);
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error('[clear-and-repopulate] Error fetching row-data for deletion:', e);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch Flex crew call data for clear-and-repopulate', details: e instanceof Error ? e.message : String(e) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // If any deletions failed, abort and return error - don't delete from DB
        if (deletionErrors.length > 0) {
          console.error(`[clear-and-repopulate] ${deletionErrors.length} Flex deletion(s) failed, aborting to prevent DB/Flex divergence`);
          return new Response(
            JSON.stringify({
              error: 'Failed to clear Flex crew call - some line items could not be deleted',
              failed_deletions: deletionErrors,
              message: 'DB assignments were NOT deleted to prevent divergence. Please retry or manually clean up Flex.'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // 5. Delete all flex_crew_assignments from DB for this crew call
        const { error: dbDeleteError } = await supabase
          .from('flex_crew_assignments')
          .delete()
          .eq('crew_call_id', crewCall.id);

        if (dbDeleteError) {
          console.error('[clear-and-repopulate] Failed to delete DB assignments:', dbDeleteError);
          return new Response(
            JSON.stringify({
              error: 'Failed to delete crew assignments from database',
              details: dbDeleteError.message,
              message: 'Flex items were cleared but DB deletion failed. Manual cleanup may be required.'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // 6. Re-add remaining technicians with business role assignment
        let readdedCount = 0;
        const insertErrors: InsertError[] = [];

        for (const tech of (remainingTechs ?? [])) {
          if (!tech.flex_resource_id) continue;

          const addUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${crewCall.flex_element_id}/add-resource/${tech.flex_resource_id}`;
          let newLineItemId: string | null = null;

          // Attempt 1: simple POST
          try {
            const addRes = await fetch(addUrl, { method: 'POST', headers: flexHeaders });
            if (addRes.ok) {
              const j = await addRes.json().catch(() => ({} as any));
              newLineItemId = j?.id || j?.lineItemId || j?.data?.id || j?.data?.lineItemId || (Array.isArray(j?.addedResourceLineIds) && j.addedResourceLineIds[0]) || null;
            }
          } catch (e) {
            console.debug(`[re-add] Simple POST failed for tech ${tech.id}:`, e);
          }

          // Attempt 2: form-encoded POST
          if (!newLineItemId) {
            try {
              const params = new URLSearchParams();
              params.set('resourceParentId', '');
              params.set('managedResourceLineItemType', 'contact');
              params.set('quantity', '1');
              params.set('parentLineItemId', '');
              params.set('nextSiblingId', '');
              const addRes2 = await fetch(addUrl, {
                method: 'POST',
                headers: { ...flexHeaders, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                body: params.toString()
              });
              if (addRes2.ok) {
                const j2 = await addRes2.json().catch(() => ({} as any));
                newLineItemId = j2?.id || j2?.lineItemId || j2?.data?.id || j2?.data?.lineItemId || (Array.isArray(j2?.addedResourceLineIds) && j2.addedResourceLineIds[0]) || null;
              }
            } catch (e) {
              console.debug(`[re-add] Form-encoded POST failed for tech ${tech.id}:`, e);
            }
          }

          // Attempt 3: discover line item ID if still missing
          if (!newLineItemId) {
            newLineItemId = await discoverLineItemId(crewCall.flex_element_id, tech.flex_resource_id, flexHeaders);
            if (newLineItemId) {
              console.log(`[re-add] Discovered line item ID for tech ${tech.id}: ${newLineItemId}`);
            }
          }

          // Set business role for this technician (before DB insert, after we have line item ID)
          if (newLineItemId) {
            await setBusinessRole(supabase, department, job_id, tech.id, crewCall.flex_element_id, newLineItemId, flexHeaders);
          }

          // Insert into DB with error handling
          const { error: insertError } = await supabase.from('flex_crew_assignments').insert({
            crew_call_id: crewCall.id,
            technician_id: tech.id,
            flex_line_item_id: newLineItemId
          });

          if (insertError) {
            console.error(`[re-add] Failed to insert assignment for tech ${tech.id}:`, insertError);
            insertErrors.push({
              crew_call_id: crewCall.id,
              technician_id: tech.id,
              flex_line_item_id: newLineItemId,
              error_message: insertError.message
            });
          } else {
            readdedCount++;
          }
        }

        console.log(`Clear-and-repopulate completed: removed 1, re-added ${readdedCount} technicians${insertErrors.length > 0 ? `, ${insertErrors.length} insert error(s)` : ''}`);

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
                strategy: 'clear-and-repopulate',
                readded_count: readdedCount,
                insert_errors: insertErrors.length > 0 ? insertErrors : undefined,
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
          JSON.stringify({
            success: true,
            message: 'Resource removed via clear-and-repopulate',
            strategy: 'clear-and-repopulate',
            readded_count: readdedCount,
            insert_errors: insertErrors.length > 0 ? insertErrors : undefined
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Normal path: we have a line item ID to delete
      const removeUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${lineItemIdToDelete}`;

      console.log(`Removing line item from Flex: ${removeUrl}`);

      const removeResponse = await fetch(removeUrl, {
        method: 'DELETE',
        headers: flexHeaders,
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
