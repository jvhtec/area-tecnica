
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helper function to sanitize filenames for Supabase Storage
const sanitizeFileName = (name: string) => {
  return name
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-zA-Z0-9.-]/g, '-') // Replace invalid characters with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, '') // Trim leading/trailing hyphens
    .toLowerCase(); // Lowercase for consistency
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

    // Fonts for better measuring and centering
    const helveticaBold = await mergedPdf.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await mergedPdf.embedFont(StandardFonts.Helvetica);

    // Add title in white on header - truly centered
    const titleFontSize = 24;
    const titleText = 'Memoria Tecnica - Sonido';
    const titleWidth = helveticaBold.widthOfTextAtSize(titleText, titleFontSize);
    const titleX = Math.max(20, (width - titleWidth) / 2);
    coverPage.drawText(titleText, {
      x: titleX,
      y: height - 25,
      size: titleFontSize,
      color: rgb(1, 1, 1),
      font: helveticaBold
    });

    // Add centered project name with wrapping
    const projectNameSize = 24;
    const maxNameWidth = width - 80;
    const wrapText = (text: string, maxWidth: number) => {
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let current = '';
      for (const w of words) {
        const test = current ? current + ' ' + w : w;
        const testWidth = helveticaBold.widthOfTextAtSize(test.toUpperCase(), projectNameSize);
        if (testWidth <= maxWidth) {
          current = test;
        } else {
          if (current) lines.push(current);
          current = w;
        }
      }
      if (current) lines.push(current);
      return lines;
    };
    const nameLines = wrapText(projectName, maxNameWidth);
    const totalNameHeight = nameLines.length * (projectNameSize + 4);
    let nameY = height / 2 + totalNameHeight / 2;
    for (const line of nameLines) {
      const lineText = line.toUpperCase();
      const lineWidth = helveticaBold.widthOfTextAtSize(lineText, projectNameSize);
      const lineX = Math.max(20, (width - lineWidth) / 2);
      coverPage.drawText(lineText, {
        x: lineX,
        y: nameY,
        size: projectNameSize,
        color: rgb(0, 0, 0),
        font: helveticaBold
      });
      nameY -= projectNameSize + 4;
    }

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

    // Helper to fetch footer logo from public logos first, then fallback
    const fetchFooterLogo = async (): Promise<Uint8Array | null> => {
      const candidates = [
        `${supabaseUrl}/storage/v1/object/public/public%20logos/sectorpro.png`,
        `${supabaseUrl}/storage/v1/object/public/company-assets/sector-pro-logo.png`
      ];
      for (const url of candidates) {
        try {
          const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } });
          if (res.ok) return new Uint8Array(await res.arrayBuffer());
        } catch (_) { /* continue */ }
      }
      return null;
    };

    // Add Sector Pro logo at the bottom
    try {
      const logoBytes = await fetchFooterLogo();
      if (!logoBytes) throw new Error('Footer logo not found in public logos or company-assets');
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

    // Add index title (centered)
    const indexTitle = 'Tabla de Contenidos';
    const indexWidth = helveticaBold.widthOfTextAtSize(indexTitle, titleFontSize);
    const indexX = Math.max(20, (width - indexWidth) / 2);
    indexPage.drawText(indexTitle, {
      x: indexX,
      y: height - 25,
      size: titleFontSize,
      color: rgb(1, 1, 1),
      font: helveticaBold
    });

    // Add Sector Pro logo to index page
    try {
      const logoBytes = await fetchFooterLogo();
      if (!logoBytes) throw new Error('Footer logo not found for index');
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

    // Do not add footer to merged PDFs; only cover and index include logo.

    const pdfBytes = await mergedPdf.save();
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);

    // Folder-safe project name for storage path
    const sanitizedProjectName = sanitizeFileName(projectName || 'proyecto');
    // Display-friendly job name in the file name (allow spaces & parentheses, remove slashes)
    const displayProjectName = (projectName || 'Proyecto')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\\/]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim();

    // Requested format: Memoria Tecnica Sonido - Job Name (DDMMYY).pdf
    const fileName = `Memoria Tecnica Sonido - ${displayProjectName} (${dd}${mm}${yy}).pdf`;
    const objectPath = `${sanitizedProjectName}/${fileName}`;

    // Choose a bucket and upload using the Supabase client; fall back across candidates
    const bucketCandidates = ['Memoria Tecnica', 'memoria-tecnica'];
    let selectedBucket = '';
    let lastUploadErr: any = null;
    for (const candidate of bucketCandidates) {
      try {
        const encodedBucket = encodeURIComponent(candidate);
        const encodedPath = encodeURI(objectPath);
        const uploadResp = await fetch(`${supabaseUrl}/storage/v1/object/${encodedBucket}/${encodedPath}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/pdf',
            // Allow overwriting existing files to avoid 409 Duplicate errors
            'x-upsert': 'true'
          },
          body: pdfBytes
        });
        if (uploadResp.ok) { selectedBucket = candidate; break; }
        // If bucket not found, try to create and retry once
        if (uploadResp.status === 404) {
          await fetch(`${supabaseUrl}/storage/v1/bucket`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id: candidate, name: candidate, public: false })
          });
          const retryResp = await fetch(`${supabaseUrl}/storage/v1/object/${encodedBucket}/${encodedPath}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/pdf',
              'x-upsert': 'true'
            },
            body: pdfBytes
          });
          if (retryResp.ok) { selectedBucket = candidate; break; }
          lastUploadErr = new Error(`Upload retry failed: ${retryResp.status} ${retryResp.statusText} ${await retryResp.text()}`);
        } else if (uploadResp.status === 409) {
          // Duplicate resource: treat as success since file already exists
          selectedBucket = candidate;
          break;
        } else {
          const bodyTxt = await uploadResp.text();
          // Some gateways respond 400 with a JSON body carrying statusCode=409 for duplicates
          if (bodyTxt.includes('"statusCode"') && bodyTxt.includes('409') && bodyTxt.toLowerCase().includes('duplicate')) {
            selectedBucket = candidate;
            break;
          }
          lastUploadErr = new Error(`Upload failed: ${uploadResp.status} ${uploadResp.statusText} ${bodyTxt}`);
        }
      } catch (e) {
        lastUploadErr = e;
      }
    }
    if (!selectedBucket) {
      console.error('Upload failed for all buckets:', lastUploadErr);
      throw new Error(`Failed to upload merged PDF: ${lastUploadErr?.message || 'unknown error'}`);
    }

    // Generate signed URL for private access (expires based on expiresIn parameter)
    console.log('Generating signed URL...');
    // Try to create a signed URL using SDK, fall back to REST if bucket name causes issues
    let signedUrl = '';
    try {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(selectedBucket)
        .createSignedUrl(objectPath, expiresIn);
      if (signedUrlError) throw signedUrlError;
      signedUrl = signedUrlData.signedUrl;
    } catch (e) {
      // REST fallback
      const encodedBucket = encodeURIComponent(selectedBucket);
      const res = await fetch(`${supabaseUrl}/storage/v1/object/sign/${encodedBucket}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ expiresIn, paths: [objectPath] })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Failed to sign URL: ${res.status} ${res.statusText} ${txt}`);
      }
      const body = await res.json();
      // Response is array of objects with signedURL
      signedUrl = body[0]?.signedURL || body[0]?.signedUrl || '';
      if (!signedUrl) throw new Error('Signed URL missing in response');
    }

    console.log('Signed URL generated successfully');

    return new Response(JSON.stringify({
      url: signedUrl,
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
