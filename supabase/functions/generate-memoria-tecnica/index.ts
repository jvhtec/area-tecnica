
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
    coverPage.drawText('MEMORIA TÉCNICA', {
      x: width/2,
      y: height - 25,
      size: 24,
      color: whiteColor,
      align: 'center'
    });

    // Add centered project name
    coverPage.drawText(projectName.toUpperCase(), {
      x: width/2,
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

    // Create index page
    const indexPage = mergedPdf.addPage([width, height]);
    
    // Add corporate header to index
    indexPage.drawRectangle({
      x: 0,
      y: height - headerHeight,
      width: width,
      height: headerHeight,
      color: corporateColor,
    });

    // Add index title with proper centering
    indexPage.drawText('TABLA DE CONTENIDOS', {
      x: width/2,
      y: height - 25,
      size: 24,
      color: whiteColor,
      align: 'center'
    });

    // Define document titles and their mappings
    const titles = {
      material: "Listado de Material",
      soundvision: "Informe SoundVision",
      weight: "Informe de Pesos",
      power: "Informe de Consumos",
      rigging: "Plano de Rigging"
    };

    // Add index items with proper spacing and alignment
    let yOffset = height - 150;
    const lineSpacing = 30;
    const leftMargin = 50;

    Object.entries(documentUrls).forEach(([key, _url]) => {
      if (titles[key]) {
        indexPage.drawText(`• ${titles[key]}`, {
          x: leftMargin,
          y: yOffset,
          size: 12,
          color: rgb(0, 0, 0),
        });
        yOffset -= lineSpacing;
      }
    });

    // Add Sector Pro logo to both pages
    try {
      const sectorProLogoUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/company-assets/sector-pro-logo.png`;
      console.log('Fetching Sector Pro logo from:', sectorProLogoUrl);
      
      const logoResponse = await fetch(sectorProLogoUrl);
      if (!logoResponse.ok) throw new Error(`Failed to fetch Sector Pro logo: ${logoResponse.statusText}`);
      
      const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
      const sectorProLogo = await mergedPdf.embedPng(logoBytes);
      
      const targetLogoHeight = 20;
      const targetLogoWidth = (sectorProLogo.width / sectorProLogo.height) * targetLogoHeight;
      
      // Add logo to both pages
      [coverPage, indexPage].forEach(page => {
        page.drawImage(sectorProLogo, {
          x: (width - targetLogoWidth) / 2,
          y: 40,
          width: targetLogoWidth,
          height: targetLogoHeight,
        });
      });
    } catch (error) {
      console.error('Error adding Sector Pro logo:', error);
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
        throw new Error(`Failed to process PDF for ${titles[key]}: ${error.message}`);
      }
    }

    const pdfBytes = await mergedPdf.save();
    
    // Generate a safe filename
    const baseFileName = `Memoria Técnica - Sonido - ${projectName}.pdf`;
    const safeFileName = baseFileName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^a-zA-Z0-9- .]/g, '_'); // Replace other special chars with underscore
    
    console.log('Uploading PDF with filename:', safeFileName);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    // Use proper storage path format with bucket name
    const uploadResponse = await fetch(`${supabaseUrl}/storage/v1/object/memoria-tecnica/${safeFileName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/pdf',
      },
      body: pdfBytes,
    });

    if (!uploadResponse.ok) {
      console.error('Upload failed with status:', uploadResponse.status);
      const errorText = await uploadResponse.text();
      console.error('Upload error details:', errorText);
      throw new Error(`Failed to upload PDF: ${uploadResponse.statusText}`);
    }

    console.log('PDF uploaded successfully');
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/memoria-tecnica/${safeFileName}`;
    
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
        details: error.stack 
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
