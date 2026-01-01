
import { format } from 'date-fns';
import { fetchTourLogo } from '@/utils/pdf/tourLogoUtils';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';

export const exportTourPDF = async (tour: any) => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;

  // === HEADER SECTION === (consistent with other PDFs)
  pdf.setFillColor(125, 1, 1); // Red header background like other PDFs
  pdf.rect(0, 0, pageWidth, 30, 'F');

  // Try to load tour logo
  let logoUrl: string | undefined;
  try {
    logoUrl = await fetchTourLogo(tour.id);
  } catch (error) {
    console.warn('Could not load tour logo:', error);
  }

  // Add logo if available (positioned like other PDFs)
  if (logoUrl) {
    try {
      pdf.addImage(logoUrl, 'PNG', 5, 5, 25, 20);
    } catch (error) {
      console.warn('Error adding logo to PDF:', error);
    }
  }

  // Header text (white text on red background)
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.text(tour.name, pageWidth / 2, 15, { align: 'center' });
  
  pdf.setFontSize(12);
  pdf.text('Tour Schedule', pageWidth / 2, 25, { align: 'center' });

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

  // === ARTIST TABLE === (using consistent styling from other PDFs)
  autoTable(pdf, {
    head: [['Date', 'Day', 'Venue', 'Setup Type']],
    body: tableData,
    startY: 40,
    theme: 'grid',
    styles: {
      fontSize: 10,
      cellPadding: 3,
      valign: 'top',
    },
    headStyles: {
      fillColor: [125, 1, 1], // Same red as header
      textColor: [255, 255, 255],
      fontSize: 11,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 30, halign: 'center' }, // Date
      1: { cellWidth: 30, halign: 'center' }, // Day
      2: { cellWidth: 'auto', halign: 'left' }, // Venue
      3: { cellWidth: 40, halign: 'center' }, // Setup Type
    },
    margin: { left: 10, right: 10 },
  });

  // === FOOTER === (consistent with other PDFs)
  const finalY = (pdf as any).lastAutoTable.finalY || 100;
  
  // Footer text
  pdf.setFontSize(10);
  pdf.setTextColor(125, 1, 1); // Same red as header
  pdf.text(
    `Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
    10,
    finalY + 20
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

// Build the same Tour Schedule PDF, but return as a Blob for uploads
export const buildTourSchedulePdfBlob = async (tour: any): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;

  // Header
  pdf.setFillColor(125, 1, 1);
  pdf.rect(0, 0, pageWidth, 30, 'F');

  // Try to load tour logo
  let logoUrl: string | undefined;
  try {
    logoUrl = await fetchTourLogo(tour.id);
  } catch (error) {
    console.warn('Could not load tour logo:', error);
  }
  if (logoUrl) {
    try { pdf.addImage(logoUrl, 'PNG', 5, 5, 25, 20); } catch (e) { console.warn('Error adding logo to PDF:', e); }
  }

  // Title
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.text(tour.name, pageWidth / 2, 15, { align: 'center' });
  pdf.setFontSize(12);
  pdf.text('Tour Schedule', pageWidth / 2, 25, { align: 'center' });

  // Rows
  const sortedDates = tour.tour_dates?.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [];
  const tableData = sortedDates.map((date: any) => [
    format(new Date(date.date), 'dd/MM/yyyy'),
    format(new Date(date.date), 'EEEE'),
    date.location?.name || 'TBC',
    date.is_tour_pack_only ? 'Tour Pack Only' : 'Full Setup'
  ]);

  autoTable(pdf, {
    head: [['Date', 'Day', 'Venue', 'Setup Type']],
    body: tableData,
    startY: 40,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 3, valign: 'top' },
    headStyles: { fillColor: [125, 1, 1], textColor: [255, 255, 255], fontSize: 11, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 30, halign: 'center' }, 1: { cellWidth: 30, halign: 'center' }, 2: { cellWidth: 'auto', halign: 'left' }, 3: { cellWidth: 40, halign: 'center' } },
    margin: { left: 10, right: 10 },
  });

  // Footer stamp
  const finalY = (pdf as any).lastAutoTable?.finalY || 100;
  pdf.setFontSize(10);
  pdf.setTextColor(125, 1, 1);
  pdf.text(`Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 10, finalY + 20);

  // Try to place Sector Pro logo on footer (best-effort)
  try {
    // Same approach as exportTourPDF, but without blocking save flow if it fails
    const loadImageAsBase64 = async (imagePath: string): Promise<string | null> => {
      try {
        const response = await fetch(imagePath);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        const blob = await response.blob();
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to convert image to base64'));
          reader.readAsDataURL(blob);
        });
      } catch (err) {
        console.warn('Footer logo load failed:', err);
        return null;
      }
    };
    const paths = ['/sector pro logo.png', './sector pro logo.png', 'sector pro logo.png'];
    let b64: string | null = null;
    for (const p of paths) { b64 = await loadImageAsBase64(p); if (b64) break; }
    if (b64) {
      const logoWidth = 40;
      const logoHeight = 15;
      const x = (pageWidth - logoWidth) / 2;
      const y = pageHeight - 30;
      try { pdf.addImage(b64, 'PNG', x, y, logoWidth, logoHeight); } catch {}
    }
  } catch {}

  // Return blob for upload
  // @ts-ignore jsPDF types accept 'blob' in runtime
  return pdf.output('blob');
};
