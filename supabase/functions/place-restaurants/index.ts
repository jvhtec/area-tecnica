import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Function called with method:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('Request body:', body);
    
    const { location, radius = 2000, maxResults = 20 } = body;

    // Test response
    const testRestaurants = [
      {
        id: "test-1",
        place_id: "test-1",
        name: "Test Restaurant 1",
        formatted_address: "Test Address 1, Madrid, Spain",
        rating: 4.5,
        price_level: 2,
        types: ["restaurant", "food"],
        formatted_phone_number: "+34 123 456 789",
        website: "https://test1.com",
        geometry: {
          location: {
            lat: 40.4168,
            lng: -3.7038
          }
        },
        distance: 500,
        photos: []
      },
      {
        id: "test-2", 
        place_id: "test-2",
        name: "Test Restaurant 2",
        formatted_address: "Test Address 2, Madrid, Spain",
        rating: 4.2,
        price_level: 1,
        types: ["restaurant", "food"],
        formatted_phone_number: "+34 987 654 321",
        website: "https://test2.com",
        geometry: {
          location: {
            lat: 40.4178,
            lng: -3.7048
          }
        },
        distance: 750,
        photos: []
      }
    ];

    console.log('Returning test data');
    
    return new Response(
      JSON.stringify({ restaurants: testRestaurants }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Function error', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});