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

    // First analyze the content to identify sections
    const documentAnalysis = await hf.documentQuestionAnswering({
      model: 'impira/layoutlm-document-qa',
      inputs: {
        question: "What equipment is listed in this document?",
        image: base64Content
      }
    });

    console.log('Document analysis:', documentAnalysis);

    // Now analyze microphones specifically
    const micAnalysis = await hf.documentQuestionAnswering({
      model: 'impira/layoutlm-document-qa',
      inputs: {
        question: "List all microphones with their quantities",
        image: base64Content
      }
    });

    console.log('Microphone analysis:', micAnalysis);

    // Analyze stands separately
    const standAnalysis = await hf.documentQuestionAnswering({
      model: 'impira/layoutlm-document-qa',
      inputs: {
        question: "List all microphone stands and their quantities",
        image: base64Content
      }
    });

    console.log('Stand analysis:', standAnalysis);

    // Parse microphone results - looking for patterns like "2x SM58" or "3 Beta58"
    const micResults = (micAnalysis.answer || '').split(/[,\n]/).map(item => {
      const match = item.trim().match(/(\d+)\s*x?\s*([\w\s-]+)/i);
      if (match) {
        return {
          quantity: parseInt(match[1]),
          model: match[2].trim()
        };
      }
      return null;
    }).filter(Boolean);

    // Parse stand results
    const standResults = (standAnalysis.answer || '').split(/[,\n]/).map(item => {
      const match = item.trim().match(/(\d+)\s*x?\s*([\w\s-]+)/i);
      if (match) {
        return {
          quantity: parseInt(match[1]),
          type: match[2].trim()
        };
      }
      return null;
    }).filter(Boolean);

    const results = {
      microphones: micResults.length > 0 ? micResults : [],
      stands: standResults.length > 0 ? standResults : [],
      rawAnalysis: {
        document: documentAnalysis.answer,
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