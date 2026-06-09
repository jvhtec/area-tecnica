import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    let userId: string | undefined;
    try {
      ({ userId } = await req.json());
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    if (!userId) {
      return jsonResponse({ error: 'User ID is required' }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // AuthN of requester
    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const { data: { user: requestingUser } } = await supabaseAdmin.auth.getUser(token);
    if (!requestingUser) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // AuthZ: require admin or management
    const { data: requesterProfile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', requestingUser.id)
      .maybeSingle();

    if (profileErr) throw profileErr;
    if (!requesterProfile || !['admin', 'management'].includes(requesterProfile.role)) {
      return jsonResponse({ error: 'Unauthorized - admin or management role required' }, 403);
    }

    // Guard against self-deletion (would orphan the requester's own session/audit trail)
    if (userId === requestingUser.id) {
      return jsonResponse({ error: 'You cannot delete your own account' }, 400);
    }

    // Confirm the target exists for a clear 404 instead of a silent success
    const { data: targetUser, error: getErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (getErr || !targetUser?.user) {
      return jsonResponse({ error: 'User not found' }, 404);
    }

    console.log('Deleting user:', userId, 'requested by:', requestingUser.id);

    // Deleting from auth.users cascades to profiles and, via the normalized
    // ON DELETE rules, to all dependent records.
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      // Surface the underlying reason (e.g. a foreign-key still blocking the
      // delete) rather than a generic 400, so it is actionable.
      return jsonResponse(
        {
          error: 'Failed to delete user',
          details: deleteError.message,
          code: (deleteError as { code?: string }).code,
        },
        502,
      );
    }

    return jsonResponse({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error in delete-user function:', error);
    return jsonResponse(
      {
        error: 'Unexpected error',
        details: (error as Error).message,
      },
      500,
    );
  }
});
