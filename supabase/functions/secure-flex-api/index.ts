
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

const FLEX_API_BASE_URL = 'https://sectorpro.flexrentalsolutions.com/f5/api';

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
    
    const response = await fetch(flexUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': authToken,
        'apikey': authToken,
      },
      body: payload ? JSON.stringify(payload) : undefined
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
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.message?.includes('authentication') ? 401 : 400,
      },
    )
  }
})
