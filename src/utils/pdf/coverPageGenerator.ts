
import { PDFDocument, rgb } from 'pdf-lib';
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
      x: 50,
      y: height - 60,
      size: 24,
      color: rgb(1, 1, 1),
    });
    
    page.drawText(jobTitle, {
      x: 50,
      y: height / 2 + 50,
      size: 36,
      color: rgb(0, 0, 0),
    });
    
    if (dateRangeText) {
      page.drawText(dateRangeText, {
        x: 50,
        y: height / 2,
        size: 16,
        color: rgb(0.3, 0.3, 0.3),
      });
    }
    
    if (logoUrl) {
      try {
        console.log("Attempting to load logo on cover page:", logoUrl);
        const logoResponse = await fetch(logoUrl);
        const logoImageData = await logoResponse.arrayBuffer();
        let logoImage;
        
        if (logoUrl.toLowerCase().endsWith('.png')) {
          logoImage = await pdfDoc.embedPng(logoImageData);
        } else {
          logoImage = await pdfDoc.embedJpg(logoImageData);
        }
        
        if (logoImage) {
          const imgWidth = 150;
          const imgHeight = (logoImage.height / logoImage.width) * imgWidth;
          
          page.drawImage(logoImage, {
            x: width - imgWidth - 50,
            y: height / 2 - (imgHeight / 2),
            width: imgWidth,
            height: imgHeight,
          });
          console.log("Logo successfully added to cover page");
        }
      } catch (logoError) {
        console.error("Error adding logo to cover page:", logoError);
      }
    } else {
      console.log("No logo URL provided for cover page");
    }
    
    page.drawText("Complete Technical Documentation", {
      x: 50,
      y: height / 2 - 50,
      size: 16,
      color: rgb(0.5, 0.5, 0.5),
    });
    
    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  } catch (error) {
    console.error("Error generating cover page:", error);
    throw error;
  }
};
