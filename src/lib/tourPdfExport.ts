
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

  // Calculate available space for table (leave more space for bottom logo)
  const bottomMargin = 50; // Increased from 30 to 50 for better spacing
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
      bottom: bottomMargin, // Ensure proper bottom margin
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

  // Add footer with better positioning
  const finalY = (pdf as any).lastAutoTable.finalY || startY + 100;
  const footerY = Math.max(finalY + 20, pageHeight - 40); // Ensure footer doesn't overlap

  pdf.setFontSize(10);
  pdf.setTextColor(128, 128, 128);
  pdf.text(
    `Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
    20,
    footerY
  );

  // Add Sector Pro logo at bottom right with proper spacing
  try {
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    logoImg.onload = () => {
      try {
        pdf.addImage(logoImg, 'PNG', pageWidth - 60, footerY - 15, 40, 15);
        pdf.save(`${tour.name}_schedule.pdf`);
      } catch (error) {
        console.warn('Error adding bottom logo:', error);
        pdf.save(`${tour.name}_schedule.pdf`);
      }
    };
    logoImg.onerror = () => {
      console.warn('Could not load bottom logo');
      pdf.save(`${tour.name}_schedule.pdf`);
    };
    logoImg.src = '/sector pro logo.png';
  } catch (error) {
    console.warn('Error loading bottom logo:', error);
    pdf.save(`${tour.name}_schedule.pdf`);
  }
};
