import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface TransportRequestItem {
  transport_type: string;
  leftover_space_meters?: number | null;
}

interface CreateTransportRequestBody {
  job_id: string;
  subrental_id?: string | null;
  description?: string;
  department: string;
  note?: string | null;
  items?: TransportRequestItem[];
  requested_by?: string; // Optional, will use authenticated user if not provided
  auto_created?: boolean; // Flag to indicate this was auto-created from a subrental
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json() as CreateTransportRequestBody;

    // Validate required fields
    if (!body?.job_id || !body?.department) {
      return new Response(JSON.stringify({ error: 'Missing required fields: job_id and department' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate department
    const validDepartments = ['sound', 'lights', 'video', 'logistics'];
    if (!validDepartments.includes(body.department)) {
      return new Response(JSON.stringify({ error: 'Invalid department. Must be one of: sound, lights, video, logistics' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user: requestingUser } } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (!requestingUser) {
      throw new Error('Not authenticated');
    }

    const createdBy = body.requested_by || requestingUser.id;
    let description = body.description || '';
    let vendor_name = '';

    // If subrental_id is provided, fetch subrental details and auto-populate description
    if (body.subrental_id) {
      const { data: subrental, error: subrentalErr } = await supabaseAdmin
        .from('sub_rentals')
        .select(`
          *,
          equipment:equipment (
            name,
            category
          )
        `)
        .eq('id', body.subrental_id)
        .maybeSingle();

      if (subrentalErr) {
        console.error('Error fetching subrental:', subrentalErr);
        throw new Error('Failed to fetch subrental details');
      }

      if (subrental) {
        // Extract vendor name from notes if available
        vendor_name = subrental.notes || 'Unknown Vendor';

        // Auto-generate description if not provided
        if (!description) {
          const equipmentName = subrental.equipment?.name || 'equipment';
          description = `Subrental pickup: ${vendor_name} (${equipmentName})`;
        }

        // Check for duplicate transport request for this subrental
        const { data: existingRequest } = await supabaseAdmin
          .from('transport_requests')
          .select('id, status')
          .eq('job_id', body.job_id)
          .eq('department', body.department)
          .contains('note', body.subrental_id) // Check if subrental_id is mentioned in note
          .neq('status', 'cancelled')
          .maybeSingle();

        if (existingRequest) {
          console.log('Transport request already exists for this subrental:', existingRequest.id);
          return new Response(
            JSON.stringify({
              id: existingRequest.id,
              message: 'Transport request already exists for this subrental',
              existing: true
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
      }
    }

    // Prepare note field (include subrental_id for tracking)
    let note = body.note || '';
    if (body.subrental_id) {
      note = note ? `${note} [subrental:${body.subrental_id}]` : `[subrental:${body.subrental_id}]`;
    }

    // Create transport request
    const { data: transportRequest, error: insertErr } = await supabaseAdmin
      .from('transport_requests')
      .insert({
        job_id: body.job_id,
        department: body.department,
        description: description || null,
        note: note || null,
        status: 'requested',
        created_by: createdBy,
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('Error creating transport request:', insertErr);
      throw insertErr;
    }

    // Create transport request items if provided
    if (body.items && body.items.length > 0) {
      const itemsToInsert = body.items
        .filter((item) => !!item.transport_type)
        .map((item) => ({
          request_id: transportRequest.id,
          transport_type: item.transport_type,
          leftover_space_meters: item.leftover_space_meters ?? null,
        }));

      if (itemsToInsert.length > 0) {
        const { error: itemsErr } = await supabaseAdmin
          .from('transport_request_items')
          .insert(itemsToInsert);

        if (itemsErr) {
          console.error('Error creating transport request items:', itemsErr);
          throw itemsErr;
        }
      }
    }

    // Send push notification to logistics
    try {
      await supabaseAdmin.functions.invoke('push', {
        body: {
          action: 'broadcast',
          type: 'logistics.transport.requested',
          job_id: body.job_id,
          department: body.department,
          request_id: transportRequest.id,
          description: description || undefined,
        },
      });
    } catch (pushErr) {
      console.error('Error sending push notification:', pushErr);
      // Don't fail the request if notification fails
    }

    return new Response(
      JSON.stringify({
        id: transportRequest.id,
        message: 'Transport request created successfully',
        description: description
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('create-transport-request error:', error);
    return new Response(
      JSON.stringify({ error: (error as any).message ?? 'Unexpected error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
