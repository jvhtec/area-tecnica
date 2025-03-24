
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
