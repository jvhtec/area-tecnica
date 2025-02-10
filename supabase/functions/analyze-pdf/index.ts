
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { HfInference } from 'https://esm.sh/@huggingface/inference@2.6.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileUrl } = await req.json();
    console.log('Starting PDF analysis for URL:', fileUrl);

    // First download the PDF content
    console.log('Downloading PDF from URL...');
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.statusText}`);
    }

    // Get the PDF content as an ArrayBuffer
    const pdfContent = await response.arrayBuffer();
    console.log('PDF content retrieved, size:', pdfContent.byteLength);

    // Convert ArrayBuffer to Base64
    const base64Content = btoa(String.fromCharCode(...new Uint8Array(pdfContent)));
    console.log('PDF content converted to base64');

    const hf = new HfInference(Deno.env.get('HUGGING_FACE_API_KEY'));

    // First, find where the equipment list is located
    const locationAnalysis = await hf.documentQuestionAnswering({
      model: 'impira/layoutlm-document-qa',
      inputs: {
        question: "On which pages are equipment lists, technical riders, or input lists located? Just respond with page numbers.",
        image: base64Content
      }
    });

    console.log('Location analysis:', locationAnalysis);

    // Then analyze microphones with a more specific prompt
    const micAnalysis = await hf.documentQuestionAnswering({
      model: 'impira/layoutlm-document-qa',
      inputs: {
        question: "Extract only microphone models and their quantities. Format should be like '2x SM58' or '3 Beta58'. Ignore any other equipment.",
        image: base64Content
      }
    });

    console.log('Microphone analysis:', micAnalysis);

    // Analyze stands with a more specific prompt
    const standAnalysis = await hf.documentQuestionAnswering({
      model: 'impira/layoutlm-document-qa',
      inputs: {
        question: "Extract only microphone stand types and quantities. Format should be like '4x Tall Boom Stand' or '2 Short Stand'. Ignore any other equipment.",
        image: base64Content
      }
    });

    console.log('Stand analysis:', standAnalysis);

    // Improved parsing for microphone results
    const micResults = (micAnalysis.answer || '').split(/[,\n;]/).map(item => {
      // Support multiple formats: "2x SM58", "3 Beta58", "SM58 (4)", etc.
      const patterns = [
        /(\d+)\s*x?\s*([\w\s-]+)/i,  // "2x SM58" or "3 Beta58"
        /([\w\s-]+)\s*\((\d+)\)/i,   // "SM58 (4)"
        /([\w\s-]+)\s*:\s*(\d+)/i    // "SM58: 4"
      ];

      for (const pattern of patterns) {
        const match = item.trim().match(pattern);
        if (match) {
          return {
            quantity: parseInt(match[1] || match[2]),
            model: match[2] || match[1]
          };
        }
      }
      return null;
    }).filter(Boolean);

    // Improved parsing for stand results
    const standResults = (standAnalysis.answer || '').split(/[,\n;]/).map(item => {
      const patterns = [
        /(\d+)\s*x?\s*([\w\s-]+stand[\w\s-]*)/i,  // "2x Tall Boom Stand"
        /([\w\s-]+stand[\w\s-]*)\s*\((\d+)\)/i,   // "Tall Boom Stand (4)"
        /([\w\s-]+stand[\w\s-]*)\s*:\s*(\d+)/i    // "Tall Boom Stand: 4"
      ];

      for (const pattern of patterns) {
        const match = item.trim().match(pattern);
        if (match) {
          return {
            quantity: parseInt(match[1] || match[2]),
            type: (match[2] || match[1]).trim()
          };
        }
      }
      return null;
    }).filter(Boolean);

    const results = {
      microphones: micResults.length > 0 ? micResults : [],
      stands: standResults.length > 0 ? standResults : [],
      relevantPages: locationAnalysis.answer,
      rawAnalysis: {
        location: locationAnalysis.answer,
        microphones: micAnalysis.answer,
        stands: standAnalysis.answer
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

  } catch (error) {
    console.error('Error in analyze-pdf function:', error);
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
