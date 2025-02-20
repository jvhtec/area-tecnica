
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
    const headerHeight = 60;
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

    // Add title in white on header
    const titleFontSize = 24;
    coverPage.drawText('MEMORIA TÉCNICA', {
      x: (width - titleFontSize * 7) / 2,
      y: height - 45,
      size: titleFontSize,
      color: rgb(1, 1, 1),
    });

    // Add centered project name
    const projectNameSize = 24;
    const estimatedCharWidth = 0.6;
    coverPage.drawText(projectName.toUpperCase(), {
      x: (width - (projectNameSize * projectName.length * estimatedCharWidth)) / 2,
      y: height / 2,
      size: projectNameSize,
      color: rgb(0, 0, 0),
    });

    // Add customer logo if provided
    if (logoUrl) {
      try {
        console.log('Fetching logo from URL:', logoUrl);
        const logoResponse = await fetch(logoUrl);
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
        console.error('Error processing logo:', error);
      }
    }

    // Add Sector Pro logo at the bottom
    const sectorProLogo = await PDFDocument.load(await fetch('/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png').then(res => res.arrayBuffer()));
    const [sectorProLogoPage] = sectorProLogo.getPages();
    const { width: logoWidth, height: logoHeight } = sectorProLogoPage.getSize();
    
    const targetLogoHeight = 50;
    const targetLogoWidth = (logoWidth / logoHeight) * targetLogoHeight;
    
    coverPage.drawImage(sectorProLogoPage, {
      x: (width - targetLogoWidth) / 2,
      y: 60,
      width: targetLogoWidth,
      height: targetLogoHeight,
    });

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

    // Add index title
    indexPage.drawText('ÍNDICE', {
      x: (width - titleFontSize * 3) / 2,
      y: height - 45,
      size: titleFontSize,
      color: rgb(1, 1, 1),
    });

    // Add Sector Pro logo to index page
    indexPage.drawImage(sectorProLogoPage, {
      x: (width - targetLogoWidth) / 2,
      y: 60,
      width: targetLogoWidth,
      height: targetLogoHeight,
    });

    // Define document titles and their mappings
    const titles = {
      material: "Listado de Material",
      soundvision: "Informe SoundVision",
      weight: "Informe de Pesos",
      power: "Informe de Consumos",
      rigging: "Plano de Rigging"
    };

    // Add index items with better spacing
    let yOffset = height - 200;
    const lineSpacing = 40;
    let pageNumber = 3;

    Object.entries(documentUrls).forEach(([key, _url]) => {
      if (titles[key]) {
        indexPage.drawText(`• ${titles[key]}`, {
          x: 50,
          y: yOffset,
          size: 12,
          color: rgb(0.1, 0.1, 0.1),
        });

        indexPage.drawText(pageNumber.toString(), {
          x: width - 50,
          y: yOffset,
          size: 12,
          color: rgb(0.1, 0.1, 0.1),
        });

        yOffset -= lineSpacing;
        pageNumber++;
      }
    });

    // Append all document PDFs
    for (const [key, url] of Object.entries(documentUrls)) {
      if (!url) continue;

      try {
        console.log(`Fetching PDF from URL: ${url}`);
        const pdfResponse = await fetch(url);
        const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
        const pdf = await PDFDocument.load(pdfBytes);
        
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
      } catch (error) {
        console.error(`Error processing PDF for ${key}:`, error);
      }
    }

    const pdfBytes = await mergedPdf.save();
    
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '');
    const fileName = `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.pdf`;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const uploadResponse = await fetch(`${supabaseUrl}/storage/v1/object/memoria-tecnica/${fileName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/pdf',
      },
      body: pdfBytes,
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload merged PDF');
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/memoria-tecnica/${fileName}`;
    
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

