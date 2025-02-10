
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

    // If PDF is too large, return an error
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (pdfContent.byteLength > MAX_SIZE) {
      return new Response(
        JSON.stringify({
          error: 'PDF file too large',
          details: 'PDF must be less than 10MB'
        }),
        { 
          status: 400,
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Convert ArrayBuffer to Base64 in chunks to avoid stack overflow
    const chunk_size = 1024 * 1024; // 1MB chunks
    const chunks = [];
    const uint8Array = new Uint8Array(pdfContent);
    
    for (let i = 0; i < uint8Array.length; i += chunk_size) {
      const chunk = uint8Array.slice(i, i + chunk_size);
      chunks.push(String.fromCharCode(...chunk));
    }
    
    const base64Content = btoa(chunks.join(''));
    console.log('PDF content converted to base64');

    const hf = new HfInference(Deno.env.get('HUGGING_FACE_API_KEY'));

    // First, find where the equipment list is located with a very specific prompt
    const locationAnalysis = await hf.documentQuestionAnswering({
      model: 'impira/layoutlm-document-qa',
      inputs: {
        question: "On which pages are technical equipment lists or input lists located? Just respond with page numbers, nothing else.",
        image: base64Content
      }
    });

    console.log('Location analysis:', locationAnalysis);

    // Then analyze microphones with a more specific prompt
    const micAnalysis = await hf.documentQuestionAnswering({
      model: 'impira/layoutlm-document-qa',
      inputs: {
        question: "List only microphone models and their quantities. Format: '2x SM58' or '3 Beta58'. Ignore any other equipment.",
        image: base64Content
      }
    });

    console.log('Microphone analysis:', micAnalysis);

    // Analyze stands with a more specific prompt
    const standAnalysis = await hf.documentQuestionAnswering({
      model: 'impira/layoutlm-document-qa',
      inputs: {
        question: "List only microphone stand types and quantities. Format: '4x Tall Boom Stand' or '2 Short Stand'. Ignore other items.",
        image: base64Content
      }
    });

    console.log('Stand analysis:', standAnalysis);

    // Improved parsing for microphone results
    const micResults = (micAnalysis.answer || '').split(/[,\n;]/).map(item => {
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
