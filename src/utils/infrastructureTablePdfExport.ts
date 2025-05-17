
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface InfrastructureItemData {
  type: 'cat6' | 'hma' | 'coax' | 'opticalcon_duo' | 'analog';
  enabled?: boolean;
  quantity: number;
}

export interface ArtistInfrastructureData {
  name: string;
  stage: number;
  providedBy: string;
  cat6: { enabled: boolean; quantity: number };
  hma: { enabled: boolean; quantity: number };
  coax: { enabled: boolean; quantity: number };
  opticalconDuo: { enabled: boolean; quantity: number };
  analog: number;
  other: string;
}

export interface InfrastructureTablePdfData {
  jobTitle: string;
  logoUrl?: string;
  artists: ArtistInfrastructureData[];
}

export const exportInfrastructureTablePDF = async (data: InfrastructureTablePdfData): Promise<Blob> => {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Add logo if provided
  if (data.logoUrl) {
    try {
      // Fetch logo
      const response = await fetch(data.logoUrl);
      const logoBlob = await response.blob();
      const logoUrl = URL.createObjectURL(logoBlob);
      
      // Calculate max dimensions for logo
      const maxLogoWidth = 40;
      const maxLogoHeight = 15;
      
      pdf.addImage(
        logoUrl,
        'PNG',
        pageWidth - maxLogoWidth - 15,
        10,
        maxLogoWidth,
        maxLogoHeight
      );
      
      // Clean up URL object
      URL.revokeObjectURL(logoUrl);
    } catch (err) {
      console.error('Error loading logo:', err);
    }
  }

  // Add title
  pdf.setFontSize(18);
  pdf.text(`${data.jobTitle} - Infrastructure Needs Overview`, 15, 20);
  
  // Filter artists to only include those with infrastructure data
  const filteredArtists = data.artists.filter(artist => {
    return (
      (artist.cat6.enabled && artist.cat6.quantity > 0) ||
      (artist.hma.enabled && artist.hma.quantity > 0) ||
      (artist.coax.enabled && artist.coax.quantity > 0) ||
      (artist.opticalconDuo.enabled && artist.opticalconDuo.quantity > 0) ||
      artist.analog > 0 ||
      (artist.other && artist.other.trim() !== '')
    );
  });
  
  // Prepare table data
  const tableData = filteredArtists.map(artist => {
    return [
      artist.name,
      `Stage ${artist.stage}`,
      artist.providedBy,
      artist.cat6.enabled ? artist.cat6.quantity : '-',
      artist.hma.enabled ? artist.hma.quantity : '-',
      artist.coax.enabled ? artist.coax.quantity : '-',
      artist.opticalconDuo.enabled ? artist.opticalconDuo.quantity : '-',
      artist.analog > 0 ? artist.analog : '-',
      artist.other || '-'
    ];
  });

  // Add the table with headers
  autoTable(pdf, {
    head: [[
      'Artist Name', 
      'Stage',
      'Provided By',
      'CAT6',
      'HMA', 
      'Coax',
      'OpticalCon Duo',
      'Analog Lines',
      'Other'
    ]],
    body: tableData,
    startY: 30,
    headStyles: {
      fillColor: [125, 1, 1], // Red color for header (same as RF table)
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [240, 240, 245]
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      lineColor: [200, 200, 200],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 40 }, // Artist name
      1: { cellWidth: 15 }, // Stage
      2: { cellWidth: 25 }, // Provided By
      3: { cellWidth: 15 }, // CAT6
      4: { cellWidth: 15 }, // HMA
      5: { cellWidth: 15 }, // Coax
      6: { cellWidth: 25 }, // OpticalCon Duo
      7: { cellWidth: 15 }, // Analog Lines
      8: { cellWidth: 40 }, // Other
    }
  });

  // Add footer with date, page numbers, and company logo
  const addFooter = async () => {
    return new Promise<void>((resolve) => {
      const totalPages = pdf.getNumberOfPages();
      
      // First add the date and page numbers to all pages
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        
        pdf.setFontSize(8);
        pdf.setTextColor(100);
        
        const date = new Date().toLocaleDateString();
        pdf.text(`Generated on ${date}`, 15, pageHeight - 10);
        
        pdf.text(`Page ${i} of ${totalPages}`, pageWidth - 25, pageHeight - 10);
      }
      
      // Now add the logo to the center bottom of all pages
      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      logo.src = '/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png';
      
      logo.onload = () => {
        const logoWidth = 50;
        const logoHeight = logoWidth * (logo.height / logo.width);
        
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          const xPosition = (pageWidth - logoWidth) / 2;
          const yLogo = pageHeight - 20;
          
          try {
            pdf.addImage(logo, 'PNG', xPosition, yLogo - logoHeight, logoWidth, logoHeight);
          } catch (error) {
            console.error(`Error adding logo on page ${i}:`, error);
          }
        }
        
        resolve();
      };
      
      logo.onerror = () => {
        console.error('Failed to load logo');
        resolve();
      };
    });
  };
  
  // Call the async footer function
  await addFooter();
  
  return pdf.output('blob');
};
