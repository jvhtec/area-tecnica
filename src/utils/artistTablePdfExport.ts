import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { detectArtistConflicts, StageSetupData, ArtistConflicts } from './pdf/conflictDetection';

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

export interface ArtistTablePdfData {
  jobTitle: string;
  date: string;
  stage?: string;
  stageNames?: Record<number, string>;
  artists: Array<{
    name: string;
    stage: number;
    showTime: {
      start: string;
      end: string;
    };
    soundcheck?: {
      start: string;
      end: string;
    };
    technical: {
      fohTech: boolean;
      monTech: boolean;
      fohConsole: {
        model: string;
        providedBy: string;
      };
      monConsole: {
        model: string;
        providedBy: string;
      };
      wireless: {
        systems: any[];
        providedBy: string;
      };
      iem: {
        systems: any[];
        providedBy: string;
      };
      monitors: {
        enabled: boolean;
        quantity: number;
      };
    };
    extras: {
      sideFill: boolean;
      drumFill: boolean;
      djBooth: boolean;
    };
    notes?: string;
    micKit: 'festival' | 'band';
    wiredMics: Array<{
      model: string;
      quantity: number;
      exclusive_use?: boolean;
      notes?: string;
    }>;
    infrastructure: {
      infra_cat6?: boolean;
      infra_cat6_quantity?: number;
      infra_hma?: boolean;
      infra_hma_quantity?: number;
      infra_coax?: boolean;
      infra_coax_quantity?: number;
      infra_opticalcon_duo?: boolean;
      infra_opticalcon_duo_quantity?: number;
      infra_analog?: number;
      other_infrastructure?: string;
      infrastructure_provided_by?: string;
    };
    riderMissing: boolean;
  }>;
  logoUrl?: string;
  stageSetups?: Record<number, StageSetupData>; // New: stage setup data for conflict detection
}

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

// Enhanced infrastructure formatting with conflict detection
const formatInfrastructureForPdf = (infrastructure: any, conflicts?: ArtistConflicts['infrastructure']) => {
  console.log('formatInfrastructureForPdf called with:', infrastructure);
  
  if (!infrastructure) {
    console.log('No infrastructure data provided');
    return 'None';
  }

  const infraItems: string[] = [];
  
  try {
    if (infrastructure.infra_cat6 && infrastructure.infra_cat6_quantity) {
      const hasConflict = conflicts?.cat6?.hasConflict;
      const item = `${infrastructure.infra_cat6_quantity}x CAT6`;
      infraItems.push(hasConflict ? `⚠️${item}` : item);
    }
    if (infrastructure.infra_hma && infrastructure.infra_hma_quantity) {
      const hasConflict = conflicts?.hma?.hasConflict;
      const item = `${infrastructure.infra_hma_quantity}x HMA`;
      infraItems.push(hasConflict ? `⚠️${item}` : item);
    }
    if (infrastructure.infra_coax && infrastructure.infra_coax_quantity) {
      const hasConflict = conflicts?.coax?.hasConflict;
      const item = `${infrastructure.infra_coax_quantity}x Coax`;
      infraItems.push(hasConflict ? `⚠️${item}` : item);
    }
    if (infrastructure.infra_opticalcon_duo && infrastructure.infra_opticalcon_duo_quantity) {
      const hasConflict = conflicts?.opticalconDuo?.hasConflict;
      const item = `${infrastructure.infra_opticalcon_duo_quantity}x OpticalCON DUO`;
      infraItems.push(hasConflict ? `⚠️${item}` : item);
    }
    if (infrastructure.infra_analog && infrastructure.infra_analog > 0) {
      const hasConflict = conflicts?.analog?.hasConflict;
      const item = `${infrastructure.infra_analog}x Analog`;
      infraItems.push(hasConflict ? `⚠️${item}` : item);
    }
    if (infrastructure.other_infrastructure) {
      infraItems.push(infrastructure.other_infrastructure);
    }
    
    console.log('Infrastructure items found:', infraItems);
    return infraItems.length > 0 ? infraItems.join(", ") : "None";
  } catch (error) {
    console.error('Error formatting infrastructure:', error);
    return 'Error formatting infrastructure';
  }
};

// Enhanced console formatting with conflict detection
const formatConsoleForPdf = (console: { model: string; providedBy: string }, conflict?: any) => {
  const hasConflict = conflict?.hasConflict;
  const base = `${console.model} (${console.providedBy})`;
  return hasConflict ? `⚠️${base}` : base;
};

// Enhanced wireless systems formatting with conflict detection
const formatWirelessSystemsForPdf = (systems: any[] = [], conflicts: any[] = [], isIEM = false) => {
  if (systems.length === 0) return "None";
  
  return systems.map((system, index) => {
    const conflict = conflicts[index];
    const hasConflict = conflict?.hasConflict;
    
    let systemText = '';
    if (isIEM) {
      const channels = system.quantity_hh || system.quantity || 0;
      const beltpacks = system.quantity_bp || 0;
      systemText = `${system.model}: ${channels} ch${beltpacks > 0 ? `, ${beltpacks} bp` : ''}`;
    } else {
      const hh = system.quantity_hh || 0;
      const bp = system.quantity_bp || 0;
      const total = hh + bp;
      if (hh > 0 && bp > 0) {
        systemText = `${system.model}: ${hh}x HH, ${bp}x BP`;
      } else if (total > 0) {
        systemText = `${system.model}: ${total}x`;
      } else {
        systemText = system.model;
      }
    }
    
    return hasConflict ? `⚠️${systemText}` : systemText;
  }).join("; ");
};

// Enhanced monitor formatting with conflict detection
const formatMonitorsForPdf = (monitors: { enabled: boolean; quantity: number }, conflict?: any) => {
  if (!monitors.enabled) return 'None';
  
  const hasConflict = conflict?.hasConflict;
  const base = `${monitors.quantity}x`;
  return hasConflict ? `⚠️${base}` : base;
};

// Enhanced extras formatting with conflict detection
const formatExtrasForPdf = (extras: any, conflicts?: ArtistConflicts['extras']) => {
  const items: string[] = [];
  
  if (extras.sideFill) {
    const hasConflict = conflicts?.sideFill?.hasConflict;
    items.push(hasConflict ? '⚠️SF' : 'SF');
  }
  if (extras.drumFill) {
    const hasConflict = conflicts?.drumFill?.hasConflict;
    items.push(hasConflict ? '⚠️DF' : 'DF');
  }
  if (extras.djBooth) {
    const hasConflict = conflicts?.djBooth?.hasConflict;
    items.push(hasConflict ? '⚠️DJ' : 'DJ');
  }
  
  return items.length > 0 ? items.join(', ') : 'None';
};

const formatWiredMicsForPdf = (mics: Array<{ model: string; quantity: number; exclusive_use?: boolean; notes?: string }> = []) => {
  if (mics.length === 0) return "None";
  return mics.map(mic => {
    const exclusiveIndicator = mic.exclusive_use ? " (E)" : "";
    return `${mic.quantity}x ${mic.model}${exclusiveIndicator}`;
  }).join(", ");
};

export const exportArtistTablePDF = async (data: ArtistTablePdfData): Promise<Blob> => {
  console.log('exportArtistTablePDF called with data:', data);
  
  const doc = new jsPDF('landscape');
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

  // Add title
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  const titleText = `${data.jobTitle} - Artist Schedule`;
  const stageText = data.stage && data.stage !== 'all' ? ` - ${data.stageNames?.[parseInt(data.stage)] || `Stage ${data.stage}`}` : '';
  doc.text(`${titleText}${stageText}`, pageWidth / 2, 15, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text(new Date(data.date).toLocaleDateString('en-GB'), pageWidth / 2, 25, { align: 'center' });

  // === ARTIST TABLE ===
  const tableData = data.artists.map(artist => {
    console.log(`Processing artist: ${artist.name}`, {
      infrastructure: artist.infrastructure,
      micKit: artist.micKit,
      wiredMics: artist.wiredMics?.length || 0
    });

    // Detect conflicts for this artist
    const stageSetup = data.stageSetups?.[artist.stage];
    const conflicts = detectArtistConflicts(artist, stageSetup || null);

    return [
      artist.name,
      data.stageNames?.[artist.stage] || `Stage ${artist.stage}`,
      `${artist.showTime.start} - ${artist.showTime.end}`,
      artist.soundcheck ? `${artist.soundcheck.start} - ${artist.soundcheck.end}` : 'No',
      `FOH: ${formatConsoleForPdf(artist.technical.fohConsole, conflicts.fohConsole)}\nMON: ${formatConsoleForPdf(artist.technical.monConsole, conflicts.monConsole)}`,
      `Wireless: ${formatWirelessSystemsForPdf(artist.technical.wireless.systems, conflicts.wireless)}\nIEM: ${formatWirelessSystemsForPdf(artist.technical.iem.systems, conflicts.iem, true)}`,
      `Kit: ${artist.micKit}\n${artist.micKit === 'festival' ? formatWiredMicsForPdf(artist.wiredMics) : 'Band provides'}`,
      formatMonitorsForPdf(artist.technical.monitors, conflicts.monitors),
      formatInfrastructureForPdf(artist.infrastructure, conflicts.infrastructure),
      formatExtrasForPdf(artist.extras, conflicts.extras),
      artist.notes || 'No notes',
      artist.riderMissing ? 'Missing' : 'Complete'
    ];
  });

  console.log('Table data prepared:', tableData.length, 'rows');

  autoTable(doc, {
    head: [['Artist', 'Stage', 'Show\nTime', 'Sound\ncheck', 'Consoles', 'Wireless/IEM', 'Microphones', 'Mons', 'Infra', 'Extras', 'Notes', 'Rider']],
    body: tableData,
    startY: 40,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      valign: 'top',
    },
    headStyles: {
      fillColor: [125, 1, 1],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 25 }, // Artist
      1: { cellWidth: 15 }, // Stage
      2: { cellWidth: 20 }, // Show Time
      3: { cellWidth: 20 }, // Soundcheck
      4: { cellWidth: 40 }, // Consoles
      5: { cellWidth: 35 }, // Wireless/IEM
      6: { cellWidth: 30 }, // Microphones
      7: { cellWidth: 15 }, // Monitors
      8: { cellWidth: 25 }, // Infrastructure
      9: { cellWidth: 15 }, // Extras
      10: { cellWidth: 25 }, // Notes
      11: { cellWidth: 15 }, // Rider Status
    },
    didParseCell: (data) => {
      // Make "Missing" text red in the Rider Status column (column 11)
      if (data.column.index === 11 && data.cell.text[0] === 'Missing') {
        data.cell.styles.textColor = [255, 0, 0]; // Red color
      }
      
      // Make conflict indicators (⚠️) red in all other columns
      if (data.column.index !== 11 && data.cell.text[0] && data.cell.text[0].includes('⚠️')) {
        data.cell.styles.textColor = [255, 0, 0]; // Red color for conflicts
      }
    },
    margin: { left: 10, right: 10 },
  });

  // === COMPANY LOGO (CENTERED AT BOTTOM) ===
  console.log("Attempting to load Sector Pro logo");
  const sectorImg = await loadImageSafely('/sector pro logo.png', 'Sector Pro logo');
  if (sectorImg) {
    try {
      const logoWidth = 20;
      const ratio = sectorImg.width / sectorImg.height;
      const logoHeight = logoWidth / ratio;
      
      doc.addImage(
        sectorImg, 
        'PNG', 
        pageWidth / 2 - logoWidth / 2,
        pageHeight - logoHeight - 5,
        logoWidth,
        logoHeight
      );
      console.log("Sector Pro logo added successfully at bottom center");
    } catch (error) {
      console.error('Error adding Sector Pro logo to PDF:', error);
    }
  } else {
    const altSectorImg = await loadImageSafely('/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png', 'alternative Sector Pro logo');
    if (altSectorImg) {
      try {
        const logoWidth = 20;
        const ratio = altSectorImg.width / altSectorImg.height;
        const logoHeight = logoWidth / ratio;
        
        doc.addImage(
          altSectorImg, 
          'PNG', 
          pageWidth / 2 - logoWidth / 2,
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

  // Footer with date
  doc.setFontSize(8);
  doc.setTextColor(51, 51, 51);
  doc.text(`Generated: ${createdDate}`, 10, pageHeight - 10);
  
  console.log('Artist table PDF generation completed');
  return doc.output('blob');
};
