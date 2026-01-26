
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log("Edge Function: get-secret initialized");

const ALLOWED_SECRETS = ['X_AUTH_TOKEN', 'OPENAI_API_KEY', 'GOOGLE_MAPS_API_KEY'];

serve(async (req) => {
  console.log("Received request:", req.method);

  if (req.method === 'OPTIONS') {
    console.log("Handling CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client for authentication
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required Supabase environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify user authentication
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Authorization header required')
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Invalid authentication')
    }

    // Check if user has admin or management role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      throw new Error('User profile not found')
    }

    if (!['admin', 'management'].includes(profile.role)) {
      throw new Error('Insufficient permissions')
    }

    const { secretName } = await req.json();
    console.log("Requested secret name:", secretName);

    if (!ALLOWED_SECRETS.includes(secretName)) {
      console.error(`Secret ${secretName} not allowed`);
      return new Response(
        JSON.stringify({ error: `Secret ${secretName} not allowed` }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const secretValue = Deno.env.get(secretName);

    if (!secretValue) {
      console.error(`Secret ${secretName} not found`);
      return new Response(
        JSON.stringify({ error: `Secret ${secretName} not found` }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Successfully retrieved secret: ${secretName}`);
    return new Response(
      JSON.stringify({ [secretName]: secretValue }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
