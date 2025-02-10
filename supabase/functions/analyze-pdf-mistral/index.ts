
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log("Edge Function: analyze-pdf-mistral initialized");

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

    if (!fileUrl) {
      throw new Error('No file URL provided');
    }

    // Validate URL format
    try {
      new URL(fileUrl);
    } catch (e) {
      throw new Error(`Invalid file URL: ${fileUrl}`);
    }

    // Download the PDF content with timeout and error handling
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(fileUrl, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        console.error('PDF download failed:', response.status, response.statusText);
        throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
      }

      if (!response.headers.get('content-type')?.includes('pdf')) {
        console.warn('Warning: Response content-type is not PDF:', response.headers.get('content-type'));
      }

      // Convert PDF to base64
      const pdfContent = await response.arrayBuffer();
      console.log('PDF size:', pdfContent.byteLength, 'bytes');
      
      // Limit the content size if too large (50MB max)
      if (pdfContent.byteLength > 50 * 1024 * 1024) {
        throw new Error('PDF file is too large (max 50MB)');
      }

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
              content: 'You are a technical document analyzer. Extract microphone and stand information from the provided document and format it as JSON. Only include items with clear quantities mentioned.'
            },
            {
              role: 'user',
              content: `Please analyze this technical document and list all microphones and stands with their quantities. Format as JSON with structure: {"microphones":[{"model":"string","quantity":number}],"stands":[{"type":"string","quantity":number}]}. Document content: ${base64Content}`
            }
          ],
          temperature: 0.1,
          max_tokens: 2000,
          top_p: 0.9
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
        
        // Clean up the response text by removing any markdown formatting
        const cleanText = analysisText.replace(/```json\n?|\n?```/g, '').trim();
        console.log('Cleaned analysis text:', cleanText);
        
        const analysis = JSON.parse(cleanText);

        // Validate and ensure proper structure
        const results = {
          microphones: Array.isArray(analysis.microphones) ? analysis.microphones : [],
          stands: Array.isArray(analysis.stands) ? analysis.stands : [],
          rawAnalysis: {
            mistral: cleanText
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

    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError.name === 'AbortError') {
        throw new Error('PDF download timed out after 30 seconds');
      }
      throw fetchError;
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
