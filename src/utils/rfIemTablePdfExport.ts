
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  wirelessProvidedBy: string;
  iemProvidedBy: string;
}

export interface RfIemTablePdfData {
  jobTitle: string;
  logoUrl?: string;
  artists: ArtistRfIemData[];
}

export const exportRfIemTablePDF = async (data: RfIemTablePdfData): Promise<Blob> => {
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
  pdf.text(`${data.jobTitle} - Artist RF & IEM Overview`, 15, 20);
  
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

    return [
      artist.name,
      `Stage ${artist.stage}`,
      artist.wirelessProvidedBy,
      rfModels,
      rfBands, 
      totalRfHH,
      totalRfBP,
      artist.iemProvidedBy,
      iemModels,
      iemBands,
      totalIemChannels,
      totalIemBodpacks
    ];
  });

  // Add the table with headers
  autoTable(pdf, {
    head: [[
      'Artist Name', 
      'Stage',
      'RF Provided By',
      'RF Models',
      'RF Bands', 
      'Handhelds',
      'Bodypacks',
      'IEM Provided By',
      'IEM Models',
      'IEM Bands', 
      'IEM Channels',
      'IEM Bodypacks'
    ]],
    body: tableData,
    startY: 30,
    headStyles: {
      fillColor: [215, 1, 1], // Fixed to rgb(225, 1, 1)
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

  // Add footer with date and page numbers
  const addFooter = async () => {
    const totalPages = pdf.getNumberOfPages();
    
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      
      pdf.setFontSize(8);
      pdf.setTextColor(100);
      
      const date = new Date().toLocaleDateString();
      pdf.text(`Generated on ${date}`, 15, pageHeight - 10);
      
      pdf.text(`Page ${i} of ${totalPages}`, pageWidth - 25, pageHeight - 10);
      
      // === COMPANY LOGO ===
      try {
        // Add a small company logo at the bottom right
        const companyLogoUrl = 'public/sector pro logo.png';
        const companyImg = new Image();
        companyImg.src = companyLogoUrl; // Added the src assignment
        
        companyImg.onload = () => {
          try {
            // Logo at bottom right
            const logoWidth = 20;
            const ratio = companyImg.width / companyImg.height;
            const logoHeight = logoWidth / ratio;
            
            pdf.addImage( // Changed from doc.addImage to pdf.addImage
              companyImg, 
              'PNG', 
              pageWidth - logoWidth - 10, // X position (right aligned)
              pageHeight - logoHeight - 10, // Y position (bottom aligned)
              logoWidth,
              logoHeight
            );
          } catch (err) {
            console.error('Error adding footer logo:', err);
          }
        };
        
        companyImg.onerror = () => {
          console.error('Failed to load company logo');
        };
      } catch (err) {
        console.error('Error processing company logo:', err);
      }
    }
  };
  
  await addFooter();
  
  return pdf.output('blob');
};
