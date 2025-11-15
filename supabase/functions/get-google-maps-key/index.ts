import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_ALLOWED_ROLES = [
  'admin',
  'management',
  'house_tech',
  'technician',
  'logistics',
]

const getAllowedRoles = () => {
  const configuredRoles = Deno.env.get('GOOGLE_MAPS_ALLOWED_ROLES')

  if (!configuredRoles) {
    return DEFAULT_ALLOWED_ROLES
  }

  if (configuredRoles.trim() === '*') {
    // Wildcard allows every authenticated user to request the key.
    return null
  }

  return configuredRoles
    .split(',')
    .map((role) => role.trim())
    .filter((role) => role.length > 0)
}

const ALLOWED_ROLES = getAllowedRoles()

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        },
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error('Invalid authentication when requesting Google Maps key', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        },
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('Profile lookup failed when requesting Google Maps key', profileError)
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        },
      )
    }

    if (ALLOWED_ROLES && !ALLOWED_ROLES.includes(profile.role)) {
      console.warn(`Unauthorized role attempted to fetch Google Maps key: ${profile.role}`)
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        },
      )
    }

    const googleMapsKey = Deno.env.get('GOOGLE_MAPS_API_KEY')

    if (!googleMapsKey) {
      console.error('GOOGLE_MAPS_API_KEY not found in environment')
      return new Response(
        JSON.stringify({ error: 'Google Maps API key not configured' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        },
      )
    }

    console.log(
      `Google Maps key requested by user ${user.id} (${profile.email ?? 'unknown email'}) at ${new Date().toISOString()}`,
    )

    return new Response(
      JSON.stringify({ apiKey: googleMapsKey }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error fetching Google Maps API key:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
