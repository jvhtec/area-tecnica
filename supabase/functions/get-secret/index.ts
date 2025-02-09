import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Edge Function: get-secret initialized");

serve(async (req) => {
  console.log("Received request:", req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("Handling CORS preflight request");
    return new Response(null, { 
      headers: corsHeaders 
    });
  }

  try {
    // Get the secret name from the request body
    const { secretName } = await req.json();
    console.log("Requested secret name:", secretName);
    
    // Get the secret value using Deno.env
    const secretValue = Deno.env.get(secretName);
    
    if (!secretValue) {
      console.error(`Secret ${secretName} not found`);
      return new Response(
        JSON.stringify({ error: `Secret ${secretName} not found` }),
        { 
          status: 404,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          }
        }
      );
    }

    console.log(`Successfully retrieved secret: ${secretName}`);
    // Return the secret value
    return new Response(
      JSON.stringify({ [secretName]: secretValue }),
      { 
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    );
  }
});