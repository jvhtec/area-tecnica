
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fetchTourLogo } from '@/utils/pdf/tourLogoUtils';

export const exportTourPDF = async (tour: any) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;

  // Try to load tour logo
  let logoUrl: string | undefined;
  try {
    logoUrl = await fetchTourLogo(tour.id);
  } catch (error) {
    console.warn('Could not load tour logo:', error);
  }

  // Header with logo if available
  let startY = 20;
  if (logoUrl) {
    try {
      pdf.addImage(logoUrl, 'PNG', 20, 10, 30, 30);
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text(tour.name, 60, 25);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Tour Schedule', 60, 35);
      startY = 50;
    } catch (error) {
      console.warn('Error adding logo to PDF:', error);
      // Fallback to text-only header
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text(tour.name, 20, 20);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Tour Schedule', 20, 30);
      startY = 40;
    }
  } else {
    // Text-only header
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text(tour.name, 20, 20);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Tour Schedule', 20, 30);
    startY = 40;
  }

  // Sort tour dates
  const sortedDates = tour.tour_dates?.sort((a: any, b: any) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  ) || [];

  // Prepare table data
  const tableData = sortedDates.map((date: any) => [
    format(new Date(date.date), 'dd/MM/yyyy'),
    format(new Date(date.date), 'EEEE'),
    date.location?.name || 'TBC',
    date.is_tour_pack_only ? 'Tour Pack Only' : 'Full Setup'
  ]);

  // Calculate available space for table (leave space for footer)
  const bottomMargin = 60; // Increased space for footer and logo
  const availableHeight = pageHeight - startY - bottomMargin;

  // Add table with improved spacing
  autoTable(pdf, {
    head: [['Date', 'Day', 'Venue', 'Setup Type']],
    body: tableData,
    startY: startY,
    theme: 'striped',
    headStyles: {
      fillColor: [126, 105, 171], // Tour color
      textColor: 255,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 10
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    margin: { 
      top: startY, 
      bottom: bottomMargin,
      left: 20, 
      right: 20 
    },
    tableWidth: 'auto',
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 30 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 40 }
    }
  });

  // Add footer text
  const finalY = (pdf as any).lastAutoTable.finalY || startY + 100;
  const footerTextY = Math.max(finalY + 20, pageHeight - 50);

  pdf.setFontSize(10);
  pdf.setTextColor(128, 128, 128);
  pdf.text(
    `Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
    20,
    footerTextY
  );

  // Function to load image as base64
  const loadImageAsBase64 = async (imagePath: string): Promise<string | null> => {
    try {
      console.log("Attempting to fetch image:", imagePath);
      
      const response = await fetch(imagePath);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = reader.result as string;
          console.log("Successfully converted image to base64");
          resolve(base64String);
        };
        reader.onerror = () => {
          console.error("Error reading image as base64");
          reject(new Error("Failed to convert image to base64"));
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error loading image:", error);
      return null;
    }
  };

  // Function to add Sector Pro logo and save PDF
  const addSectorProLogoAndSave = async () => {
    try {
      console.log("Starting Sector Pro logo loading process");
      
      // Try multiple possible paths for the logo
      const possiblePaths = [
        '/sector pro logo.png',
        './sector pro logo.png',
        'sector pro logo.png'
      ];
      
      let logoBase64: string | null = null;
      
      for (const path of possiblePaths) {
        console.log(`Trying logo path: ${path}`);
        logoBase64 = await loadImageAsBase64(path);
        if (logoBase64) {
          console.log(`Successfully loaded logo from: ${path}`);
          break;
        }
      }
      
      if (logoBase64) {
        try {
          const logoWidth = 40;
          const logoHeight = 15;
          const xPosition = (pageWidth - logoWidth) / 2; // Center horizontally
          const yPosition = pageHeight - 30; // 30 units from bottom
          
          console.log(`Adding Sector Pro logo at position: x=${xPosition}, y=${yPosition}`);
          
          pdf.addImage(
            logoBase64,
            'PNG',
            xPosition,
            yPosition,
            logoWidth,
            logoHeight
          );
          
          console.log('Sector Pro logo added successfully to PDF');
        } catch (addError) {
          console.error('Error adding logo to PDF:', addError);
        }
      } else {
        console.warn('Could not load Sector Pro logo from any path');
      }
      
    } catch (error) {
      console.error('Error in logo loading process:', error);
    }
    
    // Always save the PDF, regardless of logo success/failure
    console.log('Saving PDF...');
    pdf.save(`${tour.name}_schedule.pdf`);
  };

  // Execute logo loading and save
  await addSectorProLogoAndSave();
};
