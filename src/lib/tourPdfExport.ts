
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fetchTourLogo } from '@/utils/pdf/tourLogoUtils';

export const exportTourPDF = async (tour: any) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;

  // Add subtle background
  pdf.setFillColor(248, 250, 252);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');

  // Try to load tour logo
  let logoUrl: string | undefined;
  try {
    logoUrl = await fetchTourLogo(tour.id);
  } catch (error) {
    console.warn('Could not load tour logo:', error);
  }

  // Header section with improved styling
  let startY = 30;
  
  // Add header background
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(15, 15, pageWidth - 30, 45, 3, 3, 'FD');

  if (logoUrl) {
    try {
      // Add logo with better positioning
      pdf.addImage(logoUrl, 'PNG', 25, 20, 35, 35);
      
      // Tour name with improved typography
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(51, 65, 85);
      pdf.text(tour.name, 70, 35);
      
      // Subtitle with styling
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text('Tour Schedule', 70, 45);
      
      startY = 75;
    } catch (error) {
      console.warn('Error adding logo to PDF:', error);
      // Fallback to text-only header
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(51, 65, 85);
      pdf.text(tour.name, 25, 35);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text('Tour Schedule', 25, 45);
      startY = 75;
    }
  } else {
    // Text-only header with improved styling
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(51, 65, 85);
    pdf.text(tour.name, 25, 35);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text('Tour Schedule', 25, 45);
    startY = 75;
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
  const bottomMargin = 70;
  const availableHeight = pageHeight - startY - bottomMargin;

  // Add table with professional styling
  autoTable(pdf, {
    head: [['Date', 'Day', 'Venue', 'Setup Type']],
    body: tableData,
    startY: startY + 10,
    theme: 'grid',
    styles: {
      fontSize: 10,
      cellPadding: 8,
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [71, 85, 105],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 11,
      cellPadding: 10,
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [51, 65, 85],
      fontSize: 10,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { 
      top: startY + 10, 
      bottom: bottomMargin,
      left: 20, 
      right: 20 
    },
    tableWidth: 'auto',
    columnStyles: {
      0: { 
        cellWidth: 35,
        halign: 'center',
        fontStyle: 'bold'
      },
      1: { 
        cellWidth: 35,
        halign: 'center'
      },
      2: { 
        cellWidth: 'auto',
        halign: 'left'
      },
      3: { 
        cellWidth: 45,
        halign: 'center',
        fontSize: 9
      }
    }
  });

  // Enhanced footer section
  const finalY = (pdf as any).lastAutoTable.finalY || startY + 100;
  const footerY = Math.max(finalY + 30, pageHeight - 50);

  // Add footer background
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(15, footerY - 10, pageWidth - 30, 25, 2, 2, 'FD');

  // Footer text with better styling
  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  pdf.setFont('helvetica', 'normal');
  pdf.text(
    `Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
    25,
    footerY
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
