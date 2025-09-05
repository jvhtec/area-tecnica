
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

    // Add title in white on header - centered
    const titleFontSize = 24;
    coverPage.drawText('Memoria Tecnica - Sonido', {
      x: 160,
      y: height - 25,
      size: titleFontSize,
      color: rgb(1, 1, 1, 1),
      maxWidth: width - 40,
      align: 'center'
    });

    // Add centered project name
    const projectNameSize = 24;
    coverPage.drawText(projectName.toUpperCase(), {
      x: (width /2) - 30,
      y: height / 2 + projectNameSize / 2,
      size: projectNameSize,
      color: rgb(0, 0, 0),
      maxWidth: width - 40,
      align: 'center'
    });

    // Add customer logo if provided
    if (logoUrl) {
      try {
        console.log('Fetching customer logo from URL:', logoUrl);
        
        const fetchWithRetry = async (url: string, retries = 3, timeout = 10000) => {
          for (let i = 0; i < retries; i++) {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), timeout);
              
              const response = await fetch(url, { 
                signal: controller.signal,
                headers: {
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Cache-Control': 'no-cache',
                  'Pragma': 'no-cache'
                }
              });
              
              clearTimeout(timeoutId);
              
              if (!response.ok) {
                throw new Error(`Failed to fetch logo: ${response.status} ${response.statusText}`);
              }
              
              return response;
            } catch (error) {
              console.error(`Attempt ${i + 1} failed:`, error);
              if (i === retries - 1) throw error;
              await new Promise(r => setTimeout(r, 1000)); // Wait before retry
            }
          }
          throw new Error('Max retries reached');
        };
        
        const logoResponse = await fetchWithRetry(logoUrl);
        const logoImageBytes = new Uint8Array(await logoResponse.arrayBuffer());
        
        // Detect image type from URL or mime type
        let logoImage;
        if (logoUrl.toLowerCase().endsWith('.png')) {
          logoImage = await mergedPdf.embedPng(logoImageBytes);
        } else if (logoUrl.toLowerCase().endsWith('.jpg') || logoUrl.toLowerCase().endsWith('.jpeg')) {
          logoImage = await mergedPdf.embedJpg(logoImageBytes);
        } else {
          // Try to detect by content
          const header = logoImageBytes.slice(0, 8);
          const isPng = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47;
          
          if (isPng) {
            logoImage = await mergedPdf.embedPng(logoImageBytes);
          } else {
            // Default to JPG if unknown
            logoImage = await mergedPdf.embedJpg(logoImageBytes);
          }
        }
        
        console.log('Logo successfully embedded, dimensions:', logoImage.width, 'x', logoImage.height);
        
        const maxLogoHeight = 100;
        const maxLogoWidth = 200;
        
        // Check if dimensions are valid
        if (logoImage.width <= 0 || logoImage.height <= 0) {
          throw new Error('Invalid logo dimensions');
        }
        
        const scaleFactor = Math.min(
          maxLogoWidth / logoImage.width,
          maxLogoHeight / logoImage.height
        );
        const scaledWidth = logoImage.width * scaleFactor;
        const scaledHeight = logoImage.height * scaleFactor;

        console.log('Drawing logo with dimensions:', scaledWidth, 'x', scaledHeight);
        
        coverPage.drawImage(logoImage, {
          x: (width - scaledWidth) / 2,
          y: height - headerHeight - scaledHeight - 50,
          width: scaledWidth,
          height: scaledHeight,
        });
        
        console.log('Logo successfully added to cover page');
      } catch (error) {
        console.error('Error processing customer logo:', error);
      }
    }

    // Add Sector Pro logo at the bottom
    try {
      const sectorProLogoUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/company-assets/sector-pro-logo.png`;
      console.log('Fetching Sector Pro logo from:', sectorProLogoUrl);
      
      const logoResponse = await fetch(sectorProLogoUrl, {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!logoResponse.ok) throw new Error(`Failed to fetch Sector Pro logo: ${logoResponse.statusText}`);
      
      const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
      const sectorProLogo = await mergedPdf.embedPng(logoBytes);
      
      const targetLogoHeight = 20;
      const targetLogoWidth = (sectorProLogo.width / sectorProLogo.height) * targetLogoHeight;
      
      coverPage.drawImage(sectorProLogo, {
        x: (width - targetLogoWidth) / 2,
        y: 40,
        width: targetLogoWidth,
        height: targetLogoHeight,
      });
    } catch (error) {
      console.error('Error adding Sector Pro logo:', error);
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
    indexPage.drawText('Tabla de Contenidos', {
      x: 180,
      y: height - 25,
      size: titleFontSize,
      color: rgb(1, 1, 1, 1),
      maxWidth: width - 40,
      align: 'center'
    });

    // Add Sector Pro logo to index page
    try {
      const sectorProLogoUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/company-assets/sector-pro-logo.png`;
      const logoResponse = await fetch(sectorProLogoUrl, {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!logoResponse.ok) throw new Error(`Failed to fetch Sector Pro logo for index: ${logoResponse.statusText}`);
      
      const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
      const sectorProLogo = await mergedPdf.embedPng(logoBytes);
      
      const targetLogoHeight = 20;
      const targetLogoWidth = (sectorProLogo.width / sectorProLogo.height) * targetLogoHeight;
      
      indexPage.drawImage(sectorProLogo, {
        x: (width - targetLogoWidth) / 2,
        y: 40,
        width: targetLogoWidth,
        height: targetLogoHeight,
      });
    } catch (error) {
      console.error('Error adding Sector Pro logo to index:', error);
    }

    // Define document titles and their mappings
    const titles = {
      material: "Listado de Material",
      soundvision: "Informe SoundVision",
      weight: "Informe de Pesos",
      power: "Informe de Consumos",
      rigging: "Plano de Rigging"
    };

    // Add index items with proper spacing and alignment
    let yOffset = height - 100;
    const lineSpacing = 25;
    const leftMargin = 40;

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

    // Append all document PDFs
    for (const [key, url] of Object.entries(documentUrls)) {
      if (!url) continue;

      try {
        console.log(`Fetching PDF from URL: ${url}`);
        const pdfResponse = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!pdfResponse.ok) throw new Error(`Failed to fetch PDF: ${pdfResponse.statusText}`);
        
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
    const fileName = `Memoria Tecnica - Sonido -''${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.pdf`;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const uploadResponse = await fetch(`${supabaseUrl}/storage/v1/object/Memoria Tecnica/${encodeURIComponent(fileName)}`, {
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

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/Memoria Tecnica/${encodeURIComponent(fileName)}`;
    
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
