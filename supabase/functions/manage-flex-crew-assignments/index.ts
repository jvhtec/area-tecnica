
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
      .select('*')
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
        .select('*')
        .eq('crew_call_id', crewCall.id)
        .eq('technician_id', technician_id)
        .single();

      if (existingAssignment) {
        console.log(`Assignment already exists for technician ${technician_id} in crew call ${crewCall.id}`);
        return new Response(
          JSON.stringify({ success: true, message: 'Assignment already exists' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Add resource to crew call
      const addUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${crewCall.flex_element_id}/add-resource/${technician.flex_resource_id}`;
      
      console.log(`Adding resource to Flex crew call: ${addUrl}`);
      
      const addResponse = await fetch(addUrl, {
        method: 'POST',
        headers: {
          'X-Auth-Token': flexAuthToken,
          'Content-Type': 'application/json',
        },
      });

      if (!addResponse.ok) {
        const errorText = await addResponse.text();
        console.error(`Failed to add resource to Flex crew call: ${addResponse.status} - ${errorText}`);
        return new Response(
          JSON.stringify({ error: `Failed to add resource to Flex: ${addResponse.status}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const addResult = await addResponse.json();
      console.log('Successfully added resource to Flex crew call:', addResult);

      // Store the assignment with the line item ID
      const { error: insertError } = await supabase
        .from('flex_crew_assignments')
        .insert({
          crew_call_id: crewCall.id,
          technician_id: technician_id,
          flex_line_item_id: addResult.id
        });

      if (insertError) {
        console.error('Error storing crew assignment:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to store assignment in database' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Resource added to crew call', flex_line_item_id: addResult.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'remove') {
      // Get existing assignment
      const { data: assignment, error: assignmentError } = await supabase
        .from('flex_crew_assignments')
        .select('*')
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
