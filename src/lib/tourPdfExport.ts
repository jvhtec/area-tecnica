
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

  // Function to add Sector Pro logo and save PDF
  const addSectorProLogoAndSave = () => {
    return new Promise<void>((resolve) => {
      try {
        const sectorLogoPath = '/sector pro logo.png';
        console.log("Attempting to add Sector Pro logo from:", sectorLogoPath);
        
        const sectorImg = new Image();
        
        sectorImg.onload = () => {
          try {
            const logoWidth = 40;
            const logoHeight = 15;
            const xPosition = (pageWidth - logoWidth) / 2; // Center horizontally
            const yPosition = pageHeight - 30; // 30 units from bottom
            
            console.log(`Adding Sector Pro logo at position: x=${xPosition}, y=${yPosition}`);
            
            pdf.addImage(
              sectorImg, 
              'PNG', 
              xPosition,
              yPosition,
              logoWidth,
              logoHeight
            );
            
            console.log('Sector Pro logo added successfully');
          } catch (err) {
            console.error('Error adding Sector Pro logo to PDF:', err);
          }
          
          // Save PDF after logo is added (or failed)
          console.log('Saving PDF...');
          pdf.save(`${tour.name}_schedule.pdf`);
          resolve();
        };
        
        sectorImg.onerror = (err) => {
          console.error('Failed to load Sector Pro logo:', err);
          // Save PDF even if logo fails
          console.log('Saving PDF without logo...');
          pdf.save(`${tour.name}_schedule.pdf`);
          resolve();
        };
        
        // Set timeout fallback
        const timeout = setTimeout(() => {
          console.warn('Sector Pro logo loading timed out');
          // Save PDF if timeout occurs
          console.log('Saving PDF after timeout...');
          pdf.save(`${tour.name}_schedule.pdf`);
          resolve();
        }, 3000); // Reduced timeout to 3 seconds
        
        // Clear timeout if image loads successfully
        sectorImg.onload = () => {
          clearTimeout(timeout);
          try {
            const logoWidth = 40;
            const logoHeight = 15;
            const xPosition = (pageWidth - logoWidth) / 2;
            const yPosition = pageHeight - 30;
            
            console.log(`Adding Sector Pro logo at position: x=${xPosition}, y=${yPosition}`);
            
            pdf.addImage(
              sectorImg, 
              'PNG', 
              xPosition,
              yPosition,
              logoWidth,
              logoHeight
            );
            
            console.log('Sector Pro logo added successfully');
          } catch (err) {
            console.error('Error adding Sector Pro logo to PDF:', err);
          }
          
          console.log('Saving PDF with logo...');
          pdf.save(`${tour.name}_schedule.pdf`);
          resolve();
        };
        
        // Start loading the image
        sectorImg.src = sectorLogoPath;
        console.log('Started loading Sector Pro logo...');
        
      } catch (logoErr) {
        console.error('Error in logo loading setup:', logoErr);
        // Save PDF if there's an exception
        console.log('Saving PDF after exception...');
        pdf.save(`${tour.name}_schedule.pdf`);
        resolve();
      }
    });
  };

  // Execute logo loading and save
  await addSectorProLogoAndSave();
};
