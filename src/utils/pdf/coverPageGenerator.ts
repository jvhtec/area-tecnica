
import { PDFDocument, rgb } from 'pdf-lib';
import { supabase } from '@/lib/supabase';

export const generateCoverPage = async (
  jobId: string,
  jobTitle: string,
  logoUrl?: string
): Promise<Blob> => {
  try {
    console.log("Generating enhanced cover page for festival documentation");
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    
    const { width, height } = page.getSize();
    
    // Fetch job data for enhanced cover information
    const { data: jobData } = await supabase
      .from("jobs")
      .select(`
        start_time, 
        end_time, 
        description,
        locations (
          name,
          formatted_address
        )
      `)
      .eq("id", jobId)
      .single();

    // Fetch artist count
    const { count: artistCount } = await supabase
      .from("festival_artists")
      .select("*", { count: 'exact' })
      .eq("job_id", jobId);

    // Fetch stage count
    const { data: gearSetup } = await supabase
      .from("festival_gear_setups")
      .select("max_stages")
      .eq("job_id", jobId)
      .single();
      
    let dateRangeText = "";
    let venueText = "";
    
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

    // Fix locations property access
    if (jobData?.locations && typeof jobData.locations === 'object') {
      const location = jobData.locations as { name?: string; formatted_address?: string };
      venueText = location.name || location.formatted_address || "";
    }
    
    // Header with burgundy background
    page.drawRectangle({
      x: 0,
      y: height - 100,
      width,
      height: 100,
      color: rgb(139/255, 21/255, 33/255), // Burgundy
    });
    
    page.drawText("FESTIVAL DOCUMENTATION", {
      x: 50,
      y: height - 45,
      size: 28,
      color: rgb(1, 1, 1),
    });

    page.drawText("Complete Technical Production Guide", {
      x: 50,
      y: height - 70,
      size: 14,
      color: rgb(0.9, 0.9, 0.9),
    });
    
    // Festival title
    page.drawText(jobTitle, {
      x: 50,
      y: height / 2 + 80,
      size: 42,
      color: rgb(139/255, 21/255, 33/255),
    });
    
    // Date range
    if (dateRangeText) {
      page.drawText(dateRangeText, {
        x: 50,
        y: height / 2 + 40,
        size: 18,
        color: rgb(0.2, 0.2, 0.2),
      });
    }

    // Venue
    if (venueText) {
      page.drawText(venueText, {
        x: 50,
        y: height / 2 + 10,
        size: 16,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
    
    // Festival stats
    let statsY = height / 2 - 40;
    
    if (artistCount !== null) {
      page.drawText(`${artistCount} Artists`, {
        x: 50,
        y: statsY,
        size: 14,
        color: rgb(0.3, 0.3, 0.3),
      });
      statsY -= 25;
    }

    if (gearSetup?.max_stages) {
      page.drawText(`${gearSetup.max_stages} Stages`, {
        x: 50,
        y: statsY,
        size: 14,
        color: rgb(0.3, 0.3, 0.3),
      });
      statsY -= 25;
    }

    // Description if available
    if (jobData?.description) {
      const maxWidth = 400;
      const descriptionLines = splitTextToFit(jobData.description, maxWidth, 12);
      
      descriptionLines.forEach((line, index) => {
        page.drawText(line, {
          x: 50,
          y: statsY - (index * 18),
          size: 12,
          color: rgb(0.5, 0.5, 0.5),
        });
      });
    }
    
    // Logo placement
    if (logoUrl) {
      try {
        console.log("Loading logo for cover page:", logoUrl);
        const logoResponse = await fetch(logoUrl);
        const logoImageData = await logoResponse.arrayBuffer();
        let logoImage;
        
        if (logoUrl.toLowerCase().endsWith('.png')) {
          logoImage = await pdfDoc.embedPng(logoImageData);
        } else {
          logoImage = await pdfDoc.embedJpg(logoImageData);
        }
        
        if (logoImage) {
          const logoSize = 120;
          const aspectRatio = logoImage.height / logoImage.width;
          const logoWidth = logoSize;
          const logoHeight = logoSize * aspectRatio;
          
          page.drawImage(logoImage, {
            x: width - logoWidth - 50,
            y: height / 2 + 20,
            width: logoWidth,
            height: logoHeight,
          });
          console.log("Logo successfully added to cover page");
        }
      } catch (logoError) {
        console.error("Error adding logo to cover page:", logoError);
      }
    }
    
    // Footer with generation timestamp
    const timestamp = new Date().toLocaleString();
    page.drawText(`Generated on ${timestamp}`, {
      x: 50,
      y: 50,
      size: 10,
      color: rgb(0.6, 0.6, 0.6),
    });
    
    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  } catch (error) {
    console.error("Error generating enhanced cover page:", error);
    throw error;
  }
};

// Helper function to split text into lines that fit within a given width
function splitTextToFit(text: string, maxWidth: number, fontSize: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  // Rough estimation: each character is about 0.6 times the font size in width
  const charWidth = fontSize * 0.6;
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = testLine.length * charWidth;
    
    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Word is too long, split it
        lines.push(word);
      }
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}
