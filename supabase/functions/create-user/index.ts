import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreateUserBody {
  email: string;
  firstName: string;
  nickname?: string;
  lastName: string;
  department?: string;
  phone?: string;
  dni?: string;
  residencia?: string;
  role?: string; // optional; defaults handled by DB
  flex_resource_id?: string; // optional Flex contact id
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json() as CreateUserBody;

    if (!body?.email || !body?.firstName || !body?.lastName) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // AuthN of requester
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

    // AuthZ: require admin or management
    const { data: requesterProfile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', requestingUser.id)
      .maybeSingle();

    if (profileErr) throw profileErr;
    if (!requesterProfile || !['admin', 'management'].includes(requesterProfile.role)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create auth user with a standard default password
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: 'default',
      email_confirm: true,
      user_metadata: {
        first_name: body.firstName,
        nickname: body.nickname,
        last_name: body.lastName,
        phone: body.phone,
        department: body.department,
        dni: body.dni,
        residencia: body.residencia,
        needs_password_change: true,
      },
    });

    if (authError) throw authError;

    // Optionally set role and flex_resource_id if provided
    const updates: Record<string, any> = {};
    if (body.role) updates.role = body.role;
    if (body.nickname) updates.nickname = body.nickname;
    if (body.flex_resource_id) updates.flex_resource_id = body.flex_resource_id;
    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', authData.user.id);
      if (updErr) throw updErr;
    }

    return new Response(
      JSON.stringify({ id: authData.user.id, email: authData.user.email }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('create-user error:', error);
    return new Response(JSON.stringify({ error: (error as any).message ?? 'Unexpected error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
