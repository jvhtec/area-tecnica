
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument, rgb } from "https://cdn.skypack.dev/pdf-lib@1.17.1?dts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentUrls, projectName, logoUrl } = await req.json();
    
    console.log('Starting PDF generation with inputs:', { projectName, logoUrl, documentUrls });

    const mergedPdf = await PDFDocument.create();
    const width = 595;
    const height = 842;
    const headerHeight = 35;
    const corporateColor = rgb(102/255, 0/255, 0/255);
    const whiteColor = rgb(1, 1, 1);
    
    // Create cover page
    const coverPage = mergedPdf.addPage([width, height]);
    
    // Add corporate header
    coverPage.drawRectangle({
      x: 0,
      y: height - headerHeight,
      width: width,
      height: headerHeight,
      color: corporateColor,
    });

    // Add title in white on header - centered
    coverPage.drawText('Memoria Tecnica - Sonido', {
      x: (width/2) -20,
      y: height - 25,
      size: 24,
      color: whiteColor,
      align: 'center'
    });

    // Add centered project name
    coverPage.drawText(projectName.toUpperCase(), {
      x: (width/2) - 10,
      y: height/2,
      size: 24,
      color: rgb(0, 0, 0),
      align: 'center'
    });

    // Add customer logo if provided
    if (logoUrl) {
      try {
        console.log('Fetching customer logo from URL:', logoUrl);
        const logoResponse = await fetch(logoUrl);
        if (!logoResponse.ok) throw new Error(`Failed to fetch logo: ${logoResponse.statusText}`);
        
        const logoImageBytes = new Uint8Array(await logoResponse.arrayBuffer());
        let logoImage;
        
        if (logoUrl.toLowerCase().endsWith('.png')) {
          logoImage = await mergedPdf.embedPng(logoImageBytes);
        } else {
          logoImage = await mergedPdf.embedJpg(logoImageBytes);
        }
        
        const maxLogoHeight = 100;
        const maxLogoWidth = 200;
        const scaleFactor = Math.min(
          maxLogoWidth / logoImage.width,
          maxLogoHeight / logoImage.height
        );
        const scaledWidth = logoImage.width * scaleFactor;
        const scaledHeight = logoImage.height * scaleFactor;

        coverPage.drawImage(logoImage, {
          x: (width - scaledWidth) / 2,
          y: height - headerHeight - scaledHeight - 50,
          width: scaledWidth,
          height: scaledHeight,
        });
      } catch (error) {
        console.error('Error processing customer logo:', error);
      }
    }

    // Append all document PDFs
    for (const [key, url] of Object.entries(documentUrls)) {
      if (!url) continue;

      try {
        console.log(`Fetching PDF from URL: ${url}`);
        const pdfResponse = await fetch(url);
        if (!pdfResponse.ok) throw new Error(`Failed to fetch PDF: ${pdfResponse.statusText}`);
        
        const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
        const pdf = await PDFDocument.load(pdfBytes);
        
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
      } catch (error) {
        console.error(`Error processing PDF for ${key}:`, error);
        throw new Error(`Failed to process PDF: ${error.message}`);
      }
    }

    const pdfBytes = await mergedPdf.save();
    
    // Generate a safe filename with timestamp to avoid conflicts
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFileName = `Memoria-Tecnica-Sonido-${projectName}-${timestamp}.pdf`;
    const safeFileName = baseFileName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^a-zA-Z0-9- .]/g, '_') // Replace other special chars with underscore
      .trim();
    
    console.log('Generated safe filename:', safeFileName);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    // Use the correct upload URL format (without 'public' in the path)
    const uploadPath = `${supabaseUrl}/storage/v1/object/memoria-tecnica/${encodeURIComponent(safeFileName)}`;
    console.log('Uploading to path:', uploadPath);

    const uploadResponse = await fetch(uploadPath, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/pdf',
        'Cache-Control': 'max-age=3600',
      },
      body: pdfBytes,
    });

    if (!uploadResponse.ok) {
      console.error('Upload failed with status:', uploadResponse.status);
      const errorText = await uploadResponse.text();
      console.error('Upload error details:', errorText);
      throw new Error(`Storage upload failed: ${uploadResponse.status} - ${errorText}`);
    }

    console.log('PDF uploaded successfully');
    
    // After successful upload, construct the public URL for downloading
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/memoria-tecnica/${encodeURIComponent(safeFileName)}`;
    
    return new Response(
      JSON.stringify({ url: publicUrl }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Error in PDF generation:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack,
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 500,
      }
    );
  }
});
