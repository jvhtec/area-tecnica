
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument, rgb } from "https://cdn.skypack.dev/pdf-lib@1.17.1?dts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentUrls, projectName, logoUrl } = await req.json();
    
    console.log('Starting PDF generation with inputs:', { projectName, logoUrl, documentUrls });

    // Create merged PDF
    const mergedPdf = await PDFDocument.create();
    
    // Standard page dimensions
    const width = 595;
    const height = 842;
    const headerHeight = 35;
    
    // Corporate color (matches the existing brand)
    const corporateColor = rgb(125/255, 1/255, 1/255);
    
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

    // Add title
    coverPage.drawText('Memoria Tecnica - Video', {
      x: 160,
      y: height - 25,
      size: 24,
      color: rgb(1, 1, 1),
      maxWidth: width - 40,
    });

    // Add project name
    coverPage.drawText(projectName.toUpperCase(), {
      x: (width / 2) - 30,
      y: height / 2 + 12,
      size: 24,
      color: rgb(0, 0, 0),
      maxWidth: width - 40,
    });

    // Add customer logo if provided
    if (logoUrl) {
      try {
        console.log('Fetching customer logo from URL:', logoUrl);
        const logoResponse = await fetch(logoUrl);
        if (!logoResponse.ok) {
          throw new Error(`Failed to fetch logo: ${logoResponse.statusText}`);
        }
        
        const logoImageBytes = new Uint8Array(await logoResponse.arrayBuffer());
        const logoImage = await mergedPdf.embedJpg(logoImageBytes);
        
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

    // Add Sector Pro logo at the bottom
    try {
      const sectorProLogoUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/company-assets/sector-pro-logo.png`;
      console.log('Fetching Sector Pro logo from:', sectorProLogoUrl);
      
      const logoResponse = await fetch(sectorProLogoUrl);
      if (!logoResponse.ok) {
        throw new Error(`Failed to fetch Sector Pro logo: ${logoResponse.statusText}`);
      }
      
      const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
      const sectorProLogo = await mergedPdf.embedPng(logoBytes);
      
      const targetHeight = 20;
      const targetWidth = (sectorProLogo.width / sectorProLogo.height) * targetHeight;
      
      coverPage.drawImage(sectorProLogo, {
        x: (width - targetWidth) / 2,
        y: 40,
        width: targetWidth,
        height: targetHeight,
      });
    } catch (error) {
      console.error('Error adding Sector Pro logo:', error);
    }

    // Create table of contents page
    const tocPage = mergedPdf.addPage([width, height]);
    
    // Add "Tabla de Contenidos" title
    tocPage.drawText('Tabla de Contenidos', {
      x: 50,
      y: height - 100,
      size: 24,
      color: rgb(0, 0, 0),
    });

    // Define the documents order and titles
    const documentOrder = [
      { id: 'material', title: 'Listado de Material' },
      { id: 'weight', title: 'Informe de Pesos' },
      { id: 'power', title: 'Informe de Consumos' },
      { id: 'pixel', title: 'Pixel Map' },
    ];

    // Add table of contents entries
    let entryY = height - 150;
    let entryNumber = 1;

    documentOrder.forEach(doc => {
      if (documentUrls[doc.id]) {
        tocPage.drawText(`${entryNumber}. ${doc.title}`, {
          x: 50,
          y: entryY,
          size: 14,
          color: rgb(0, 0, 0),
        });
        entryY -= 30;
        entryNumber++;
      }
    });

    // Append all document PDFs in order
    for (const doc of documentOrder) {
      const url = documentUrls[doc.id];
      if (!url) continue;

      try {
        console.log(`Fetching PDF from URL: ${url}`);
        const pdfResponse = await fetch(url);
        if (!pdfResponse.ok) {
          throw new Error(`Failed to fetch PDF: ${pdfResponse.statusText}`);
        }
        
        const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
        const pdf = await PDFDocument.load(pdfBytes);
        
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
      } catch (error) {
        console.error(`Error processing PDF for ${doc.id}:`, error);
      }
    }

    const pdfBytes = await mergedPdf.save();
    
    // Create a safe filename
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '');
    const safeFileName = `memoria_tecnica_${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.pdf`;
    
    // Get Supabase configuration
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    // Upload to Supabase Storage
    const uploadResponse = await fetch(
      `${supabaseUrl}/storage/v1/object/video-memoria-tecnica/${encodeURIComponent(safeFileName)}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/pdf',
        },
        body: pdfBytes,
      }
    );

    if (!uploadResponse.ok) {
      console.error('Upload failed with status:', uploadResponse.status);
      const errorText = await uploadResponse.text();
      console.error('Upload error details:', errorText);
      throw new Error(`Storage upload failed: ${uploadResponse.status} - ${errorText}`);
    }

    // Get the public URL
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/video-memoria-tecnica/${encodeURIComponent(safeFileName)}`;
    
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
      JSON.stringify({ error: error.message }),
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
