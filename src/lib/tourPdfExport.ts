import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fetchTourLogo } from '@/utils/pdf/tourLogoUtils';

// Helper function to load Sector Pro logo
const loadSectorProLogo = (): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    
    const timeout = setTimeout(() => {
      console.warn('Sector Pro logo loading timed out');
      resolve(null);
    }, 5000);
    
    logoImg.onload = () => {
      clearTimeout(timeout);
      console.log('Sector Pro logo loaded successfully');
      resolve(logoImg);
    };
    
    logoImg.onerror = () => {
      clearTimeout(timeout);
      console.warn('Could not load Sector Pro logo');
      resolve(null);
    };
    
    logoImg.src = '/sector pro logo.png';
  });
};

export const exportTourPDF = async (tour: any) => {
  // Load Sector Pro logo first
  const sectorProLogo = await loadSectorProLogo();
  
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

  // Add Sector Pro logo if it loaded successfully
  if (sectorProLogo) {
    try {
      // Position logo at bottom center
      const logoWidth = 40;
      const logoHeight = 15;
      const xPosition = (pageWidth - logoWidth) / 2; // Center horizontally
      const yPosition = pageHeight - 25; // 25 units from bottom
      
      pdf.addImage(sectorProLogo, 'PNG', xPosition, yPosition, logoWidth, logoHeight);
      console.log('Sector Pro logo added successfully at bottom center');
    } catch (error) {
      console.warn('Error adding Sector Pro logo to PDF:', error);
    }
  }

  // Now save the PDF - everything is loaded and added
  pdf.save(`${tour.name}_schedule.pdf`);
};