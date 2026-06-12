
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import { fetchWithRetry } from "../_shared/flexFetch.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

const FLEX_API_BASE_URL = Deno.env.get('FLEX_API_BASE_URL') || 'https://sectorpro.flexrentalsolutions.com/f5/api';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client for authentication
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const authToken = Deno.env.get('X_AUTH_TOKEN')
    
    if (!supabaseUrl || !supabaseKey || !authToken) {
      throw new Error('Missing required environment variables')
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

    // Authorization: only admin/management may proxy Flex API calls
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      throw new Error('Could not verify authorization')
    }
    if (!profile || !['admin', 'management'].includes(profile.role)) {
      throw new Error('Forbidden - admin or management role required')
    }

    // Parse request body
    const { endpoint, method = 'POST', payload } = await req.json()
    
    if (!endpoint) {
      throw new Error('Endpoint is required')
    }

    // Validate endpoint (security measure)
    const allowedEndpoints = ['/element']
    if (!allowedEndpoints.some(allowed => endpoint.startsWith(allowed))) {
      throw new Error('Endpoint not allowed')
    }

    // Sanitize logging - don't expose sensitive data
    console.log(`Making ${method} request to Flex endpoint: ${endpoint} by user: ${user.id}`);

    // Make secure API call to Flex
    const flexUrl = `${FLEX_API_BASE_URL}${endpoint}`
    
    const response = await fetchWithRetry(flexUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': authToken,
        'apikey': authToken,
      },
      body: payload ? JSON.stringify(payload) : undefined
    }, {
      // A timed-out mutation may have been applied by Flex; only GETs are
      // safe to replay after a timeout.
      retryOnTimeout: String(method).toUpperCase() === 'GET',
    });

    console.log('Flex API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("Flex API error response:", errorData);
      throw new Error(errorData.exceptionMessage || `Flex API error: ${response.status}`)
    }

    const data = await response.json()
    console.log("Flex API success response:", data)

    return new Response(
      JSON.stringify({ success: true, data }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error("Error in secure-flex-api:", error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('authentication') || message.includes('Authorization header')
      ? 401
      : message.includes('Forbidden')
        ? 403
        : message.includes('Could not verify') || message.includes('Missing required environment')
          ? 500
          : 400
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status,
      },
    )
  }
})
