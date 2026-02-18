import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
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

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const normalizeOptional = (value?: string) => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

const getErrorStatus = (error: unknown) => {
  const status = Number((error as { status?: number })?.status);
  return Number.isInteger(status) && status >= 400 && status < 600 ? status : 400;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    let body: CreateUserBody;
    try {
      body = await req.json() as CreateUserBody;
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const email = body?.email?.trim().toLowerCase();
    const firstName = body?.firstName?.trim();
    const lastName = body?.lastName?.trim();

    if (!email || !firstName || !lastName) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
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
    const { data: { user: requestingUser } } = await supabaseAdmin.auth.getUser(
      token
    );

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
      return jsonResponse({ error: 'Unauthorized' }, 403);
    }

    // Create auth user with a standard default password
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: 'default',
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        nickname: normalizeOptional(body.nickname),
        last_name: lastName,
        phone: normalizeOptional(body.phone),
        department: normalizeOptional(body.department),
        dni: normalizeOptional(body.dni),
        residencia: normalizeOptional(body.residencia),
        needs_password_change: true,
      },
    });

    if (authError) {
      if ((authError as { code?: string }).code === 'email_exists') {
        return jsonResponse(
          {
            error: 'A user with this email address has already been registered',
            code: 'email_exists',
          },
          409,
        );
      }
      throw authError;
    }

    // Optionally set role and flex_resource_id if provided
    const updates: Record<string, any> = {};
    const role = normalizeOptional(body.role);
    const nickname = normalizeOptional(body.nickname);
    const flexResourceId = normalizeOptional(body.flex_resource_id);
    if (role) updates.role = role;
    if (nickname) updates.nickname = nickname;
    if (flexResourceId) updates.flex_resource_id = flexResourceId;
    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', authData.user.id);
      if (updErr) throw updErr;
    }

    return jsonResponse({ id: authData.user.id, email: authData.user.email });
  } catch (error) {
    console.error('create-user error:', error);
    return jsonResponse({
      error: (error as any).message ?? 'Unexpected error',
      code: (error as any).code,
    }, getErrorStatus(error));
  }
});
