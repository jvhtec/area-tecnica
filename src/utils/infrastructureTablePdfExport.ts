import { loadPdfLibs } from '@/utils/pdf/lazyPdf';

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
  const { jsPDF, autoTable } = await loadPdfLibs();
  // Group artists by stage
  const artistsByStage = data.artists.reduce((acc, artist) => {
    const stageNum = artist.stage;
    if (!acc[stageNum]) {
      acc[stageNum] = [];
    }
    acc[stageNum].push(artist);
    return acc;
  }, {} as Record<number, ArtistInfrastructureData[]>);
  
  // Sort stages numerically
  const stageNumbers = Object.keys(artistsByStage).map(Number).sort((a, b) => a - b);
  
  // Create a PDF document to store all stage pages
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });
  
  // For each stage, create a separate page
  let isFirstPage = true;
  
  for (const stageNum of stageNumbers) {
    const stageArtists = artistsByStage[stageNum];
    
    // If not the first page, add a new page
    if (!isFirstPage) {
      pdf.addPage();
    }
    isFirstPage = false;
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const bottomMargin = 25; // Increase bottom margin to avoid overlap with logo
    
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
    
    // Add title with stage number
    pdf.setFontSize(18);
    pdf.text(`${data.jobTitle} - Infraestructura - Escenario ${stageNum}`, 15, 20);
    
    // Prepare table data for this stage
    const tableData = stageArtists.map(artist => {
      return [
        artist.name,
        `Escenario ${artist.stage}`,
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
        'Artista', 
        'Escenario',
        'Proporcionado por',
        'CAT6',
        'HMA', 
        'Coax',
        'OpticalCon Duo',
        'Lineas Analogicas',
        'Otros'
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
      },
      margin: { bottom: bottomMargin } // Add bottom margin to avoid overlap with logo
    });
    
    // Add footer with date, page numbers, and company logo
    const date = new Date().toLocaleDateString('es-ES');
    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.text(`Generado: ${date}`, 15, pageHeight - bottomMargin + 10);
    pdf.text(`Infraestructura Escenario ${stageNum}`, pageWidth / 2, pageHeight - bottomMargin + 10, { align: 'center' });
    
    // Add the logo to the center bottom of the page
    const logo = new Image();
    logo.crossOrigin = 'anonymous';
    logo.src = '/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png';
    
    await new Promise<void>((resolve) => {
      logo.onload = () => {
        const logoWidth = 50;
        const logoHeight = logoWidth * (logo.height / logo.width);
        
        const xPosition = (pageWidth - logoWidth) / 2;
        const yLogo = pageHeight - logoHeight - 5;
        
        try {
          pdf.addImage(logo, 'PNG', xPosition, yLogo, logoWidth, logoHeight);
        } catch (error) {
          console.error(`Error adding logo on page for stage ${stageNum}:`, error);
        }
        
        resolve();
      };
      
      logo.onerror = () => {
        console.error('Failed to load logo');
        resolve();
      };
    });
  }
  
  // Add page numbers after all pages have been created
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.text(`Pagina ${i} de ${totalPages}`, pageWidth - 30, pageHeight - 10);
  }
  
  return pdf.output('blob');
};
