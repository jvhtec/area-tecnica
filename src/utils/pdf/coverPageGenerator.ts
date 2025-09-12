
import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib';
import { supabase } from '@/lib/supabase';

export const generateCoverPage = async (
  jobId: string,
  jobTitle: string,
  logoUrl?: string
): Promise<Blob> => {
  try {
    console.log("Generating cover page for festival documentation");
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    
    const { width, height } = page.getSize();
    const leftMargin = 50;
    const rightMargin = 50;

    // Embed fonts for consistent measurement and wrapping
    const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    const { data: jobData } = await supabase
      .from("jobs")
      .select("start_time, end_time")
      .eq("id", jobId)
      .single();
      
    let dateRangeText = "";
    if (jobData?.start_time && jobData?.end_time) {
      const startDate = new Date(jobData.start_time);
      const endDate = new Date(jobData.end_time);
      
      const options: Intl.DateTimeFormatOptions = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      };
      
      if (startDate.getTime() === endDate.getTime()) {
        dateRangeText = startDate.toLocaleDateString(undefined, options);
      } else {
        dateRangeText = `${startDate.toLocaleDateString(undefined, options)} - ${endDate.toLocaleDateString(undefined, options)}`;
      }
    }
    
    page.drawRectangle({
      x: 0,
      y: height - 100,
      width,
      height: 100,
      color: rgb(125/255, 1/255, 1/255), // Corporate red
    });
    
    page.drawText("FESTIVAL DOCUMENTATION", {
      x: leftMargin,
      y: height - 60,
      size: 24,
      color: rgb(1, 1, 1),
    });
    
    // Try to fetch and draw logo first to compute available text area
    let drawnLogoWidth = 0;
    let drawnLogoHeight = 0;
    if (logoUrl) {
      try {
        console.log("Attempting to load logo on cover page:", logoUrl);
        // Attempt fetch. If unauthorized, retry with Supabase auth header
        let logoResponse = await fetch(logoUrl);
        if (!logoResponse.ok && logoResponse.status === 401) {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;
          if (token) {
            logoResponse = await fetch(logoUrl, {
              headers: { Authorization: `Bearer ${token}` },
            });
          }
        }
        if (!logoResponse.ok) {
          throw new Error(`Logo fetch failed with status ${logoResponse.status}`);
        }
        const contentType = logoResponse.headers.get('Content-Type') || '';
        const logoImageData = await logoResponse.arrayBuffer();
        let logoImage;

        const isPngByHeader = /png/i.test(contentType);
        const isJpgByHeader = /(jpe?g)/i.test(contentType);
        const isPngByExt = /\.png(\?|$)/i.test(logoUrl);
        const isJpgByExt = /\.jpe?g(\?|$)/i.test(logoUrl);

        // Peek first bytes for signature if needed
        const bytes = new Uint8Array(logoImageData.slice(0, 8));
        const isPngBySig = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
        const isJpgBySig = bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;

        const assumePng = isPngByHeader || isPngByExt || isPngBySig;
        const assumeJpg = isJpgByHeader || isJpgByExt || isJpgBySig;

        try {
          if (assumePng) {
            logoImage = await pdfDoc.embedPng(logoImageData);
          } else if (assumeJpg) {
            logoImage = await pdfDoc.embedJpg(logoImageData);
          } else {
            // Try PNG then JPG as fallback
            try {
              logoImage = await pdfDoc.embedPng(logoImageData);
            } catch {
              logoImage = await pdfDoc.embedJpg(logoImageData);
            }
          }
        } catch (embedErr) {
          console.error('Failed to embed logo (unsupported format?):', embedErr, 'content-type:', contentType);
          throw embedErr;
        }
        
        if (logoImage) {
          const imgWidth = 150;
          const imgHeight = (logoImage.height / logoImage.width) * imgWidth;
          
          page.drawImage(logoImage, {
            x: width - imgWidth - rightMargin,
            y: height / 2 - (imgHeight / 2),
            width: imgWidth,
            height: imgHeight,
          });
          drawnLogoWidth = imgWidth;
          drawnLogoHeight = imgHeight;
          console.log("Logo successfully added to cover page");
        }
      } catch (logoError) {
        console.error("Error adding logo to cover page:", logoError);
      }
    } else {
      console.log("No logo URL provided for cover page");
    }
    
    // Compute max width for title text (avoid overlapping the logo area if present)
    const titleMaxRightX = drawnLogoWidth > 0 ? (width - rightMargin - drawnLogoWidth - 20) : (width - rightMargin);
    const titleMaxWidth = Math.max(100, titleMaxRightX - leftMargin);

    // Draw wrapped job title
    const titleFontSize = 36;
    const titleLineHeight = 42;
    const titleStartY = height / 2 + 50;
    const titleLines = wrapText(jobTitle || '', titleFont, titleFontSize, titleMaxWidth);
    titleLines.forEach((line, idx) => {
      page.drawText(line, {
        x: leftMargin,
        y: titleStartY - idx * titleLineHeight,
        size: titleFontSize,
        color: rgb(0, 0, 0),
        font: titleFont,
      });
    });
    
    // Draw date range below title
    if (dateRangeText) {
      const dateY = titleStartY - titleLines.length * titleLineHeight - 12;
      page.drawText(dateRangeText, {
        x: leftMargin,
        y: dateY,
        size: 16,
        color: rgb(0.3, 0.3, 0.3),
        font: bodyFont,
      });
      // Subtitle below date
      page.drawText("Complete Technical Documentation", {
        x: leftMargin,
        y: dateY - 30,
        size: 16,
        color: rgb(0.5, 0.5, 0.5),
        font: bodyFont,
      });
    } else {
      // If no dates, still draw subtitle below the title
      const subY = titleStartY - titleLines.length * titleLineHeight - 12;
      page.drawText("Complete Technical Documentation", {
        x: leftMargin,
        y: subY,
        size: 16,
        color: rgb(0.5, 0.5, 0.5),
        font: bodyFont,
      });
    }
    
    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  } catch (error) {
    console.error("Error generating cover page:", error);
    throw error;
  }
};

// Helper: simple greedy text wrapper based on font metrics
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(trial, fontSize);
    if (width <= maxWidth || current.length === 0) {
      current = trial;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
