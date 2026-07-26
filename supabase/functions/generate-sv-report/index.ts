import { serve } from "https://deno.land/std@0.224.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch (error) {
    // A malformed body is the caller's fault; keep it out of the 500 path below.
    console.error('generate-sv-report received invalid JSON:', error)
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }

  try {
    const { eventName, date, venue, details } = payload

    // Here you would implement the actual report generation logic
    // For now, we'll just return a success message
    const result = {
      success: true,
      message: "Report generated successfully",
      data: {
        eventName,
        date,
        venue,
        details,
      }
    }

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    // Log the detail server-side; return a generic message so error internals are not
    // exposed to the caller (CodeQL: information exposure through a stack trace).
    console.error('generate-sv-report failed:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to generate SoundVision report' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
