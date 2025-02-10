
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log("Edge Function: analyze-pdf-mistral initialized");

// Efficient base64 conversion for large files
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const binString = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
  return btoa(binString);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileUrl } = await req.json();
    console.log('Starting PDF analysis with Mistral for URL:', fileUrl);

    // Download the PDF content
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.statusText}`);
    }

    // Convert PDF to base64 using the efficient method
    const pdfContent = await response.arrayBuffer();
    const base64Content = arrayBufferToBase64(pdfContent);
    console.log('PDF content converted to base64');

    // Call Mistral API
    const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY');
    if (!MISTRAL_API_KEY) {
      throw new Error('Mistral API key not found');
    }

    console.log('Calling Mistral API...');
    const mistralResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'system',
            content: `You are an expert at analyzing technical documents and extracting equipment information. 
            I will provide you with a base64 encoded PDF. Focus on identifying any microphones and stands mentioned, 
            including their quantities. Format your response in valid JSON with this structure:
            {
              "microphones": [{"model": "string", "quantity": number}],
              "stands": [{"type": "string", "quantity": number}]
            }`
          },
          {
            role: 'user',
            content: `I have a technical document in base64 format. Please analyze it and extract any mentions of microphones and stands with their quantities. Here's the base64 content: ${base64Content}`
          }
        ],
        temperature: 0.2,
        max_tokens: 4000
      })
    });

    if (!mistralResponse.ok) {
      const errorData = await mistralResponse.text();
      console.error('Mistral API error response:', errorData);
      throw new Error(`Mistral API error: ${mistralResponse.statusText}\nDetails: ${errorData}`);
    }

    const mistralData = await mistralResponse.json();
    console.log('Mistral API response received');

    // Parse Mistral's response
    try {
      const analysisText = mistralData.choices[0].message.content;
      console.log('Raw analysis text:', analysisText);
      
      const analysis = JSON.parse(analysisText);

      // Validate the structure
      const results = {
        microphones: Array.isArray(analysis.microphones) ? analysis.microphones : [],
        stands: Array.isArray(analysis.stands) ? analysis.stands : [],
        rawAnalysis: {
          mistral: analysisText
        }
      };

      console.log('Final analysis results:', results);

      return new Response(
        JSON.stringify(results),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    } catch (parseError) {
      console.error('Error parsing Mistral response:', parseError);
      throw new Error('Failed to parse Mistral analysis results');
    }

  } catch (error) {
    console.error('Error in analyze-pdf-mistral function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack 
      }),
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
