import { loadPdfLibs } from '@/utils/pdf/lazyPdf';

export interface RfIemSystemData {
  model: string;
  quantity_hh?: number;
  quantity_bp?: number;
  band?: string;
  provided_by?: 'festival' | 'band';
}

export interface ArtistRfIemData {
  name: string;
  stage: number;
  wirelessSystems: RfIemSystemData[];
  iemSystems: RfIemSystemData[];
}

export interface RfIemTablePdfData {
  jobTitle: string;
  logoUrl?: string;
  artists: ArtistRfIemData[];
}

// Helper function to aggregate provider information from systems
const getProviderSummary = (systems: RfIemSystemData[]): string => {
  if (!systems || systems.length === 0) return '';
  
  const providers = systems.map(system => system.provided_by || 'festival');
  const uniqueProviders = [...new Set(providers)];
  
  if (uniqueProviders.length === 1) {
    return uniqueProviders[0] === 'festival' ? 'Festival' : 'Banda';
  } else {
    return 'Mixto';
  }
};

export const exportRfIemTablePDF = async (data: RfIemTablePdfData): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
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
  pdf.text(`${data.jobTitle} - Resumen RF e IEM`, 15, 20);
  
  // Filter artists to only include those with RF or IEM data
  const filteredArtists = data.artists.filter(artist => 
    (artist.wirelessSystems && artist.wirelessSystems.length > 0) || 
    (artist.iemSystems && artist.iemSystems.length > 0)
  );
  
  // Prepare table data
  const tableData = filteredArtists.map(artist => {
    // Calculate total RF handhelds and bodypacks
    const totalRfHH = artist.wirelessSystems.reduce((sum, sys) => sum + (sys.quantity_hh || 0), 0);
    const totalRfBP = artist.wirelessSystems.reduce((sum, sys) => sum + (sys.quantity_bp || 0), 0);
    
    // Calculate total IEM channels and bodypacks
    const totalIemChannels = artist.iemSystems.reduce((sum, sys) => sum + (sys.quantity_hh || 0), 0);
    const totalIemBodpacks = artist.iemSystems.reduce((sum, sys) => sum + (sys.quantity_bp || 0), 0);
    
    // Get RF models and frequency bands
    const rfModels = [...new Set(artist.wirelessSystems.map(sys => sys.model))].join(', ');
    const rfBands = [...new Set(artist.wirelessSystems
      .filter(sys => sys.band)
      .map(sys => sys.band)
    )].join(', ');
    
    // Get IEM models and frequency bands
    const iemModels = [...new Set(artist.iemSystems.map(sys => sys.model))].join(', ');
    const iemBands = [...new Set(artist.iemSystems
      .filter(sys => sys.band)
      .map(sys => sys.band)
    )].join(', ');

    // Get provider summaries from individual systems
    const rfProvidedBy = getProviderSummary(artist.wirelessSystems);
    const iemProvidedBy = getProviderSummary(artist.iemSystems);

    return [
      artist.name,
      `Escenario ${artist.stage}`,
      rfProvidedBy,
      rfModels,
      rfBands, 
      totalRfHH,
      totalRfBP,
      iemProvidedBy,
      iemModels,
      iemBands,
      totalIemChannels,
      totalIemBodpacks
    ];
  });

  // Add the table with headers
  autoTable(pdf, {
    head: [[
      'Artista', 
      'Escenario',
      'RF Proporcionado por',
      'Modelos RF',
      'Bandas RF', 
      'Manos',
      'Petacas',
      'IEM Proporcionado por',
      'Modelos IEM',
      'Bandas IEM', 
      'Canales IEM',
      'Petacas IEM'
    ]],
    body: tableData,
    startY: 30,
    headStyles: {
      fillColor: [125, 1, 1], // Red color for header
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
      2: { cellWidth: 22 }, // RF Provider
      3: { cellWidth: 30 }, // RF Models
      4: { cellWidth: 25 }, // RF Bands
      5: { cellWidth: 15 }, // Handhelds
      6: { cellWidth: 15 }, // Bodypacks
      7: { cellWidth: 22 }, // IEM Provider
      8: { cellWidth: 30 }, // IEM Models
      9: { cellWidth: 25 }, // IEM Bands
      10: { cellWidth: 15 }, // IEM Channels
      11: { cellWidth: 15 }, // IEM Bodypacks
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
        
        const date = new Date().toLocaleDateString('es-ES');
        pdf.text(`Generado: ${date}`, 15, pageHeight - 10);
        
        pdf.text(`Pagina ${i} de ${totalPages}`, pageWidth - 30, pageHeight - 10);
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
