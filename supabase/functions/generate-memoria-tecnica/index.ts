
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument, rgb } from "https://cdn.skypack.dev/pdf-lib@1.17.1?dts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Helper function to sanitize filenames for Supabase Storage
const sanitizeFileName = (name: string) => {
  return name
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-zA-Z0-9-_.]/g, '_') // Replace invalid characters with underscores
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .toLowerCase(); // Convert to lowercase for consistency
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    const { documentUrls, projectName, logoUrl, expiresIn = 3600 } = await req.json(); // expiresIn defaults to 1 hour
    console.log('Starting PDF generation with inputs:', {
      projectName,
      logoUrl,
      documentUrls,
      expiresIn
    });

    // Initialize Supabase client for signed URLs
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const mergedPdf = await PDFDocument.create();
    const width = 595;
    const height = 842;
    const headerHeight = 35;
    const corporateColor = rgb(125 / 255, 1 / 255, 1 / 255);

    // Create cover page
    const coverPage = mergedPdf.addPage([width, height]);

    // Add corporate header
    coverPage.drawRectangle({
      x: 0,
      y: height - headerHeight,
      width: width,
      height: headerHeight,
      color: corporateColor
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
      x: width / 2 - 30,
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
        
        const fetchWithRetry = async (url: string, retries = 3, timeout = 5000) => {
          for (let i = 0; i < retries; i++) {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), timeout);
              const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                  'Cache-Control': 'no-cache',
                  'Pragma': 'no-cache'
                }
              });
              clearTimeout(timeoutId);
              
              if (!response.ok) {
                throw new Error(`Failed to fetch logo: ${response.statusText}`);
              }
              return response;
            } catch (error) {
              console.error(`Attempt ${i + 1} failed:`, error);
              if (i === retries - 1) throw error;
              await new Promise(r => setTimeout(r, 1000));
            }
          }
          throw new Error('Max retries reached');
        };

        const logoResponse = await fetchWithRetry(logoUrl);
        const logoImageBytes = new Uint8Array(await logoResponse.arrayBuffer());

        let logoImage;
        if (logoUrl.toLowerCase().endsWith('.png')) {
          logoImage = await mergedPdf.embedPng(logoImageBytes);
        } else if (logoUrl.toLowerCase().endsWith('.jpg') || logoUrl.toLowerCase().endsWith('.jpeg')) {
          logoImage = await mergedPdf.embedJpg(logoImageBytes);
        } else {
          const header = logoImageBytes.slice(0, 8);
          const isPng = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47;
          if (isPng) {
            logoImage = await mergedPdf.embedPng(logoImageBytes);
          } else {
            logoImage = await mergedPdf.embedJpg(logoImageBytes);
          }
        }

        console.log('Logo successfully embedded, dimensions:', logoImage.width, 'x', logoImage.height);
        
        const maxLogoHeight = 100;
        const maxLogoWidth = 200;
        
        if (logoImage.width <= 0 || logoImage.height <= 0) {
          throw new Error('Invalid logo dimensions');
        }
        
        const scaleFactor = Math.min(maxLogoWidth / logoImage.width, maxLogoHeight / logoImage.height);
        const scaledWidth = logoImage.width * scaleFactor;
        const scaledHeight = logoImage.height * scaleFactor;

        coverPage.drawImage(logoImage, {
          x: (width - scaledWidth) / 2,
          y: height - headerHeight - scaledHeight - 50,
          width: scaledWidth,
          height: scaledHeight
        });

        console.log('Logo successfully added to cover page');
      } catch (error) {
        console.error('Error processing customer logo:', error);
      }
    }

    // Add Sector Pro logo at the bottom
    try {
      const sectorProLogoUrl = `${supabaseUrl}/storage/v1/object/public/company-assets/sector-pro-logo.png`;
      console.log('Fetching Sector Pro logo from:', sectorProLogoUrl);
      
      const logoResponse = await fetch(sectorProLogoUrl, {
        headers: {
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
        height: targetLogoHeight
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
      color: corporateColor
    });

    // Add index title
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
      const sectorProLogoUrl = `${supabaseUrl}/storage/v1/object/public/company-assets/sector-pro-logo.png`;
      const logoResponse = await fetch(sectorProLogoUrl, {
        headers: {
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
        height: targetLogoHeight
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

    // Add index items
    let yOffset = height - 100;
    const lineSpacing = 25;
    const leftMargin = 40;

    Object.entries(documentUrls).forEach(([key, _url]) => {
      if (titles[key]) {
        indexPage.drawText(`• ${titles[key]}`, {
          x: leftMargin,
          y: yOffset,
          size: 12,
          color: rgb(0, 0, 0)
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
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!pdfResponse.ok) throw new Error(`Failed to fetch PDF: ${pdfResponse.statusText}`);
        
        const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
        const pdf = await PDFDocument.load(pdfBytes);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        
        pages.forEach((page) => mergedPdf.addPage(page));
      } catch (error) {
        console.error(`Error processing PDF for ${key}:`, error);
      }
    }

    const pdfBytes = await mergedPdf.save();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '');

    // Use the sanitizeFileName function for better file naming
    const sanitizedProjectName = sanitizeFileName(projectName || 'proyecto');
    const fileName = `memoria_tecnica_sonido_${sanitizedProjectName}_${timestamp}.pdf`;

    // Check if bucket exists and create it if it doesn't (as PRIVATE bucket)
    const bucketName = 'Memoria Tecnica'; // Using your existing bucket name
    try {
      const bucketCheckResponse = await fetch(`${supabaseUrl}/storage/v1/bucket/${encodeURIComponent(bucketName)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
        }
      });

      if (bucketCheckResponse.status === 404) {
        console.log('Bucket does not exist, creating it as private...');
        const createBucketResponse = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: bucketName,
            name: bucketName,
            public: false, // PRIVATE BUCKET
            file_size_limit: null,
            allowed_mime_types: null
          })
        });

        if (!createBucketResponse.ok) {
          const errorText = await createBucketResponse.text();
          console.error('Failed to create bucket:', errorText);
          throw new Error(`Failed to create bucket: ${createBucketResponse.status}`);
        }
        console.log('Private bucket created successfully');
      }
    } catch (error) {
      console.error('Error checking/creating bucket:', error);
      // Continue anyway - the bucket might exist but the check failed
    }

    // Upload to private bucket using raw fetch
    const encodedBucketName = encodeURIComponent(bucketName);
    const uploadResponse = await fetch(`${supabaseUrl}/storage/v1/object/${encodedBucketName}/${fileName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/pdf'
      },
      body: pdfBytes
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Upload error details:', errorText);
      throw new Error(`Failed to upload merged PDF: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }

    // Generate signed URL for private access (expires based on expiresIn parameter)
    console.log('Generating signed URL...');
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(fileName, expiresIn);

    if (signedUrlError) {
      console.error('Error creating signed URL:', signedUrlError);
      throw new Error(`Failed to create signed URL: ${signedUrlError.message}`);
    }

    console.log('Signed URL generated successfully');

    return new Response(JSON.stringify({
      url: signedUrlData.signedUrl,
      fileName: fileName,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      expiresIn: expiresIn
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Error in PDF generation:', error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
