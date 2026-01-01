import { WirelessSystem, IEMSystem } from '@/types/festival-equipment';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';

export interface ArtistTechnicalInfo {
  fohTech: boolean;
  monTech: boolean;
  fohConsole: { model: string; providedBy: string };
  monConsole: { model: string; providedBy: string };
  wireless: {
    systems?: WirelessSystem[];
    model?: string;
    providedBy: string;
    handhelds?: number;
    bodypacks?: number;
    band?: string;
    hh?: number;
    bp?: number;
  };
  iem: {
    systems?: IEMSystem[];
    model?: string;
    providedBy: string;
    quantity?: number;
    band?: string;
  };
  monitors: {
    enabled: boolean;
    quantity: number;
  };
}

// Local interfaces for internal PDF generation use
interface WirelessSystemDetail {
  quantity_hh?: number;
  quantity_bp?: number;
  model: string;
  band?: string;
}

interface IEMSystemDetail {
  quantity: number;
  model: string;
  band?: string;
}

export interface ArtistInfrastructure {
  providedBy: string;
  cat6: { enabled: boolean; quantity: number };
  hma: { enabled: boolean; quantity: number };
  coax: { enabled: boolean; quantity: number };
  opticalconDuo: { enabled: boolean; quantity: number };
  analog: number;
  other: string;
}

export interface ArtistPdfData {
  name: string;
  stage: number;
  date: string;
  schedule: {
    show: { start: string; end: string };
    soundcheck?: { start: string; end: string };
  };
  technical: ArtistTechnicalInfo;
  infrastructure: ArtistInfrastructure;
  extras: {
    sideFill: boolean;
    drumFill: boolean;
    djBooth: boolean;
    wired: string;
  };
  notes?: string;
  logoUrl?: string;
  wiredMics?: Array<{
    model: string;
    quantity: number;
    exclusive_use?: boolean;
    notes?: string;
  }>;
  micKit?: 'festival' | 'band' | 'mixed';
  riderMissing?: boolean;
}

// Helper functions to process wireless and IEM data
const getWirelessSummary = (systems: WirelessSystem[] = []) => {
  const totalHH = systems.reduce((sum, system) => sum + (system.quantity_hh || 0), 0);
  const totalBP = systems.reduce((sum, system) => sum + (system.quantity_bp || 0), 0);
  return { hh: totalHH, bp: totalBP };
};

const getIEMSummary = (systems: IEMSystem[] = []) => {
  const totalChannels = systems.reduce((sum, system) => sum + (system.quantity_hh || 0), 0);
  const totalBodpacks = systems.reduce((sum, system) => sum + (system.quantity_bp || 0), 0);
  return { 
    channels: totalChannels, 
    bodypacks: totalBodpacks,
    total: totalChannels // For backward compatibility
  };
};

// Enhanced image loading function
const loadImageSafely = async (src: string, description: string): Promise<HTMLImageElement | null> => {
  console.log(`Loading ${description} from:`, src);
  
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    const timeout = setTimeout(() => {
      console.warn(`Timeout loading ${description} from:`, src);
      resolve(null);
    }, 10000); // 10 second timeout
    
    img.onload = () => {
      clearTimeout(timeout);
      console.log(`Successfully loaded ${description}`);
      resolve(img);
    };
    
    img.onerror = (error) => {
      clearTimeout(timeout);
      console.error(`Failed to load ${description} from:`, src, error);
      resolve(null);
    };
    
    img.src = src;
  });
};

export const exportArtistPDF = async (data: ArtistPdfData): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const createdDate = new Date().toLocaleDateString('en-GB');

  // === HEADER SECTION ===
  doc.setFillColor(125, 1, 1);
  doc.rect(0, 0, pageWidth, 30, 'F');

  // Load festival logo if provided
  let festivalLogoLoaded = false;
  if (data.logoUrl) {
    console.log("Attempting to load festival logo:", data.logoUrl);
    
    const festivalImg = await loadImageSafely(data.logoUrl, 'festival logo');
    if (festivalImg) {
      try {
        console.log("Festival logo loaded, dimensions:", festivalImg.width, "x", festivalImg.height);
        const maxHeight = 18;
        const ratio = festivalImg.width / festivalImg.height;
        const logoHeight = Math.min(maxHeight, festivalImg.height);
        const logoWidth = logoHeight * ratio;
        
        doc.addImage(festivalImg, 'JPEG', 5, 5, logoWidth, logoHeight);
        festivalLogoLoaded = true;
        console.log("Festival logo added successfully to PDF");
      } catch (error) {
        console.error('Error adding festival logo to PDF:', error);
      }
    }
  }

  // If festival logo failed, try fallback logo
  if (!festivalLogoLoaded) {
    console.log("Trying fallback logo");
    const fallbackImg = await loadImageSafely('/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png', 'fallback logo');
    if (fallbackImg) {
      try {
        const maxHeight = 18;
        const ratio = fallbackImg.width / fallbackImg.height;
        const logoHeight = Math.min(maxHeight, fallbackImg.height);
        const logoWidth = logoHeight * ratio;
        
        doc.addImage(fallbackImg, 'PNG', 5, 5, logoWidth, logoHeight);
        console.log("Fallback logo added successfully");
      } catch (error) {
        console.error('Error adding fallback logo to PDF:', error);
      }
    }
  }

  // Add title and date
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(`${data.name} - Stage ${data.stage}`, pageWidth / 2, 15, { align: 'center' });
  doc.setFontSize(12);
  doc.text(new Date(data.date).toLocaleDateString('en-GB'), pageWidth / 2, 25, { align: 'center' });

  let yPosition = 40;

  // === SCHEDULE SECTION ===
  doc.setFontSize(12);
  doc.setTextColor(125, 1, 1);
  doc.text("Schedule", 14, yPosition);
  yPosition += 8;

  doc.setFontSize(9);
  doc.setTextColor(51, 51, 51);
  doc.text(`Show Time: ${data.schedule.show.start} - ${data.schedule.show.end}`, 14, yPosition);
  yPosition += 6;
  if (data.schedule.soundcheck) {
    doc.text(`Soundcheck: ${data.schedule.soundcheck.start} - ${data.schedule.soundcheck.end}`, 14, yPosition);
    yPosition += 6;
  }
  yPosition += 4;

  // === TECHNICAL STAFF ===
  const technicalStaffRows = [
    ['FOH Tech', data.technical.fohTech ? 'Yes' : 'No'],
    ['MON Tech', data.technical.monTech ? 'Yes' : 'No']
  ];

  autoTable(doc, {
    head: [['Position', 'Tech Required']],
    body: technicalStaffRows,
    startY: yPosition,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [125, 1, 1],
      textColor: [255, 255, 255],
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 40 }
    },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 8;

  // === CONSOLE REQUIREMENTS ===
  const consoleRows = [
    ['FOH Console', data.technical.fohConsole.model, data.technical.fohConsole.providedBy],
    ['MON Console', data.technical.monConsole.model, data.technical.monConsole.providedBy]
  ];

  autoTable(doc, {
    head: [['Position', 'Model', 'Provided By']],
    body: consoleRows,
    startY: yPosition,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [125, 1, 1],
      textColor: [255, 255, 255],
    },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 8;

  // === WIRED MICROPHONES ===
  if (data.wiredMics && data.wiredMics.length > 0) {
    const wiredMicRows = data.wiredMics.map(mic => [
      mic.model,
      mic.quantity.toString(),
      mic.exclusive_use ? 'Yes' : 'No',
      mic.notes || '-'
    ]);

    autoTable(doc, {
      head: [['Microphone Model', 'Quantity', 'Exclusive Use', 'Notes']],
      body: wiredMicRows,
      startY: yPosition,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 55 }
      }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 8;
  }

  // === RF & WIRELESS ===
  const wirelessRows: any[] = [];
  
  // Process wireless systems with individual provider information
  if (data.technical.wireless.systems && data.technical.wireless.systems.length > 0) {
    data.technical.wireless.systems.forEach(system => {
      const systemProvider = system.provided_by || data.technical.wireless.providedBy;
      
      if (system.quantity_hh && system.quantity_hh > 0) {
        wirelessRows.push([
          'Handheld',
          system.quantity_hh,
          system.model,
          system.band || '-',
          systemProvider
        ]);
      }
      if (system.quantity_bp && system.quantity_bp > 0) {
        wirelessRows.push([
          'Bodypack',
          system.quantity_bp,
          system.model,
          system.band || '-',
          systemProvider
        ]);
      }
    });
  } else if (data.technical.wireless.handhelds || data.technical.wireless.bodypacks) {
    // Handle legacy format
    if (data.technical.wireless.handhelds) {
      wirelessRows.push([
        'Handheld',
        data.technical.wireless.handhelds,
        data.technical.wireless.model || '-',
        data.technical.wireless.band || '-',
        data.technical.wireless.providedBy
      ]);
    }
    if (data.technical.wireless.bodypacks) {
      wirelessRows.push([
        'Bodypack',
        data.technical.wireless.bodypacks,
        data.technical.wireless.model || '-',
        data.technical.wireless.band || '-',
        data.technical.wireless.providedBy
      ]);
    }
  }

  // Process IEM systems with individual provider information
  if (data.technical.iem.systems && data.technical.iem.systems.length > 0) {
    data.technical.iem.systems.forEach(system => {
      const systemProvider = system.provided_by || data.technical.iem.providedBy;
      
      if (system.quantity_hh && system.quantity_hh > 0) {
        wirelessRows.push([
          'IEM Channels',
          system.quantity_hh,
          system.model,
          system.band || '-',
          systemProvider
        ]);
      }
      if (system.quantity_bp && system.quantity_bp > 0) {
        wirelessRows.push([
          'IEM Bodypacks',
          system.quantity_bp,
          system.model,
          system.band || '-',
          systemProvider
        ]);
      }
    });
  } else if (data.technical.iem.quantity) {
    // Handle legacy format
    wirelessRows.push([
      'IEM System',
      data.technical.iem.quantity,
      data.technical.iem.model || '-',
      data.technical.iem.band || '-',
      data.technical.iem.providedBy
    ]);
  }

  if (wirelessRows.length > 0) {
    autoTable(doc, {
      head: [['Type', 'Qty', 'Model', 'Band', 'Provided By']],
      body: wirelessRows,
      startY: yPosition,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
      },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 8;
  }

  // === MONITORS ===
  if (data.technical.monitors.enabled) {
    const monitorRows = [
      ['Monitors', data.technical.monitors.quantity]
    ];

    autoTable(doc, {
      head: [['Type', 'Quantity']],
      body: monitorRows,
      startY: yPosition,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
      },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 8;
  }

  // === INFRASTRUCTURE ===
  const infrastructureRows = [
    data.infrastructure.cat6.enabled && ['CAT6', data.infrastructure.cat6.quantity],
    data.infrastructure.hma.enabled && ['HMA', data.infrastructure.hma.quantity],
    data.infrastructure.coax.enabled && ['Coax', data.infrastructure.coax.quantity],
    data.infrastructure.opticalconDuo.enabled && ['OpticalCon Duo', data.infrastructure.opticalconDuo.quantity],
    data.infrastructure.analog > 0 && ['Analog Lines', data.infrastructure.analog]
  ].filter(Boolean);

  if (infrastructureRows.length > 0) {
    autoTable(doc, {
      head: [['Type', 'Quantity']],
      body: infrastructureRows,
      startY: yPosition,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
      },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 8;
  }

  // === EXTRAS ===
  const extraRows = [
    data.extras.sideFill && ['Side Fill', 'Yes'],
    data.extras.drumFill && ['Drum Fill', 'Yes'],
    data.extras.djBooth && ['DJ Booth', 'Yes'],
    data.extras.wired && ['Additional Wired', data.extras.wired]
  ].filter(Boolean);

  if (extraRows.length > 0) {
    autoTable(doc, {
      head: [['Extra Requirements', 'Details']],
      body: extraRows,
      startY: yPosition,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
      },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 8;
  }

  // === NOTES ===
  if (data.notes) {
    doc.setFontSize(12);
    doc.setTextColor(125, 1, 1);
    doc.text("Notes", 14, yPosition);
    yPosition += 8;

    doc.setFontSize(9);
    doc.setTextColor(51, 51, 51);
    const splitNotes = doc.splitTextToSize(data.notes, pageWidth - 28);
    doc.text(splitNotes, 14, yPosition);
    yPosition += splitNotes.length * 5 + 10;
  }

  // === COMPANY LOGO (CENTERED AT BOTTOM) ===
  console.log("Attempting to load Sector Pro logo");
  const sectorImg = await loadImageSafely('/sector pro logo.png', 'Sector Pro logo');
  if (sectorImg) {
    try {
      const logoWidth = 20;
      const ratio = sectorImg.width / sectorImg.height;
      const logoHeight = logoWidth / ratio;
      
      // Center horizontally at bottom of page
      doc.addImage(
        sectorImg, 
        'PNG', 
        pageWidth / 2 - logoWidth / 2,  // Center horizontally
        pageHeight - logoHeight - 10,
        logoWidth,
        logoHeight
      );
      console.log("Sector Pro logo added successfully at bottom center");
    } catch (error) {
      console.error('Error adding Sector Pro logo to PDF:', error);
    }
  } else {
    // Try alternative Sector Pro logo
    const altSectorImg = await loadImageSafely('/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png', 'alternative Sector Pro logo');
    if (altSectorImg) {
      try {
        const logoWidth = 20;
        const ratio = altSectorImg.width / altSectorImg.height;
        const logoHeight = logoWidth / ratio;
        
        // Center horizontally at bottom of page
        doc.addImage(
          altSectorImg, 
          'PNG', 
          pageWidth / 2 - logoWidth / 2,  // Center horizontally
          pageHeight - logoHeight - 10, 
          logoWidth, 
          logoHeight
        );
        console.log("Alternative Sector Pro logo added successfully at bottom center");
      } catch (error) {
        console.error('Error adding alternative Sector Pro logo to PDF:', error);
      }
    }
  }

  // Footer with date (moved to left to avoid overlap with centered logo)
  doc.setFontSize(8);
  doc.setTextColor(51, 51, 51);
  doc.text(`Generated: ${createdDate}`, 10, pageHeight - 10);
  
  console.log('Individual artist PDF generation completed');
  return doc.output('blob');
};
