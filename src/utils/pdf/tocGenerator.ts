
import { PDFDocument, rgb } from 'pdf-lib';

export const generateTableOfContents = async (
  sections: { title: string; pageCount: number }[],
  logoUrl?: string
): Promise<Blob> => {
  try {
    console.log("Generating table of contents");
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    
    const { width, height } = page.getSize();
    
    page.drawRectangle({
      x: 0,
      y: height - 100,
      width,
      height: 100,
      color: rgb(125/255, 1/255, 1/255), // Corporate red
    });
    
    page.drawText("TABLE OF CONTENTS", {
      x: 50,
      y: height - 60,
      size: 24,
      color: rgb(1, 1, 1),
    });
    
    if (logoUrl) {
      try {
        console.log("Attempting to load logo on TOC page:", logoUrl);
        const logoResponse = await fetch(logoUrl);
        const logoImageData = await logoResponse.arrayBuffer();
        let logoImage;
        
        if (logoUrl.toLowerCase().endsWith('.png')) {
          logoImage = await pdfDoc.embedPng(logoImageData);
        } else {
          logoImage = await pdfDoc.embedJpg(logoImageData);
        }
        
        if (logoImage) {
          const imgWidth = 100;
          const imgHeight = (logoImage.height / logoImage.width) * imgWidth;
          
          page.drawImage(logoImage, {
            x: width - imgWidth - 50,
            y: height - 60 - (imgHeight / 2) + 10,
            width: imgWidth,
            height: imgHeight,
          });
          console.log("Logo successfully added to TOC page");
        }
      } catch (logoError) {
        console.error("Error adding logo to TOC:", logoError);
      }
    } else {
      console.log("No logo URL provided for TOC page");
    }
    
    let currentY = height - 150;
    let pageCounter = 3;
    
    page.drawText("Section", {
      x: 50,
      y: currentY,
      size: 14,
      color: rgb(0, 0, 0),
    });
    
    page.drawText("Page", {
      x: width - 100,
      y: currentY,
      size: 14,
      color: rgb(0, 0, 0),
    });
    
    currentY -= 20;
    
    page.drawLine({
      start: { x: 50, y: currentY },
      end: { x: width - 50, y: currentY },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    
    currentY -= 30;
    
    for (const section of sections) {
      page.drawText(section.title, {
        x: 50,
        y: currentY,
        size: 12,
        color: rgb(0, 0, 0),
      });
      
      page.drawText(pageCounter.toString(), {
        x: width - 100,
        y: currentY,
        size: 12,
        color: rgb(0, 0, 0),
      });
      
      let dotX = 250;
      while (dotX < width - 105) {
        page.drawText(".", {
          x: dotX,
          y: currentY,
          size: 12,
          color: rgb(0.7, 0.7, 0.7),
        });
        dotX += 10;
      }
      
      pageCounter += section.pageCount;
      currentY -= 30;
    }
    
    page.drawText("Page 2", {
      x: width / 2,
      y: 30,
      size: 10,
      color: rgb(0.5, 0.5, 0.5),
    });
    
    const pdfBytes = await pdfDoc.save();
    return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  } catch (error) {
    console.error("Error generating table of contents:", error);
    throw error;
  }
};
