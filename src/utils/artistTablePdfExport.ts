import { GearMismatch, EquipmentNeeds } from './gearComparisonService';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';

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
      monitorsFromFoh?: boolean;
      fohWavesOutboard?: string;
      monWavesOutboard?: string;
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
    micKit: 'festival' | 'band' | 'mixed';
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
    gearMismatches?: GearMismatch[];
  }>;
  logoUrl?: string;
  includeGearConflicts?: boolean;
  equipmentNeeds?: EquipmentNeeds;
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

// Fixed infrastructure formatting function
const formatInfrastructureForPdf = (infrastructure: any) => {
  console.log('formatInfrastructureForPdf called with:', infrastructure);
  
  if (!infrastructure) {
    console.log('No infrastructure data provided');
    return 'Ninguno';
  }

  const infraItems: string[] = [];
  
  try {
    if (infrastructure.infra_cat6 && infrastructure.infra_cat6_quantity) {
      infraItems.push(`${infrastructure.infra_cat6_quantity}x CAT6`);
    }
    if (infrastructure.infra_hma && infrastructure.infra_hma_quantity) {
      infraItems.push(`${infrastructure.infra_hma_quantity}x HMA`);
    }
    if (infrastructure.infra_coax && infrastructure.infra_coax_quantity) {
      infraItems.push(`${infrastructure.infra_coax_quantity}x Coax`);
    }
    if (infrastructure.infra_opticalcon_duo && infrastructure.infra_opticalcon_duo_quantity) {
      infraItems.push(`${infrastructure.infra_opticalcon_duo_quantity}x OpticalCON DUO`);
    }
    if (infrastructure.infra_analog && infrastructure.infra_analog > 0) {
      infraItems.push(`${infrastructure.infra_analog}x Analog`);
    }
    if (infrastructure.other_infrastructure) {
      infraItems.push(infrastructure.other_infrastructure);
    }
    
    console.log('Infrastructure items found:', infraItems);
    return infraItems.length > 0 ? infraItems.join(", ") : "Ninguno";
  } catch (error) {
    console.error('Error formatting infrastructure:', error);
    return 'Error formatting infrastructure';
  }
};

const formatWiredMicsForPdf = (mics: Array<{ model: string; quantity: number; exclusive_use?: boolean; notes?: string }> = [], micKit: string = 'band') => {
  if (mics.length === 0) return "Ninguno";
  
  return mics.map(mic => {
    const exclusiveIndicator = mic.exclusive_use ? " (E)" : "";
    return `${mic.quantity}x ${mic.model}${exclusiveIndicator}`;
  }).join(", ");
};

const formatWirelessSystemsForPdf = (systems: any[] = [], providedBy: string = "festival", isIEM = false) => {
  if (systems.length === 0) return "Ninguno";
  
  if (providedBy === "mixed") {
    // Show individual system providers when mixed
    return systems.map(system => {
      const provider = system.provided_by || "festival";
      const providerLabel = provider === "festival" ? "(F)" : "(B)";
      
      if (isIEM) {
        const channels = system.quantity_hh || system.quantity || 0;
        const beltpacks = system.quantity_bp || 0;
        return `${system.model}: ${channels} ch${beltpacks > 0 ? `, ${beltpacks} bp` : ''} ${providerLabel}`;
      } else {
        const hh = system.quantity_hh || 0;
        const bp = system.quantity_bp || 0;
        const total = hh + bp;
        if (hh > 0 && bp > 0) {
          return `${system.model}: ${hh}x HH, ${bp}x BP ${providerLabel}`;
        } else if (total > 0) {
          return `${system.model}: ${total}x ${providerLabel}`;
        }
        return `${system.model} ${providerLabel}`;
      }
    }).join("; ");
  } else {
    // Original formatting for single provider
    return systems.map(system => {
      if (isIEM) {
        const channels = system.quantity_hh || system.quantity || 0;
        const beltpacks = system.quantity_bp || 0;
        return `${system.model}: ${channels} ch${beltpacks > 0 ? `, ${beltpacks} bp` : ''}`;
      } else {
        const hh = system.quantity_hh || 0;
        const bp = system.quantity_bp || 0;
        const total = hh + bp;
        if (hh > 0 && bp > 0) {
          return `${system.model}: ${hh}x HH, ${bp}x BP`;
        } else if (total > 0) {
          return `${system.model}: ${total}x`;
        }
        return system.model;
      }
    }).join("; ");
  }
};

const formatConsolesWithTech = (console: { model: string; providedBy: string }, techRequired: boolean, position: string) => {
  const techIndicator = techRequired ? " + Tec" : "";
  const providerDisplay = console.providedBy === "mixed" ? "(Mixto)" : `(${console.providedBy})`;
  return `${position}: ${console.model} ${providerDisplay}${techIndicator}`;
};

const formatConsoleSectionForPdf = (technical: ArtistTablePdfData["artists"][number]["technical"]) => {
  const lines: string[] = [];
  lines.push(formatConsolesWithTech(technical.fohConsole, technical.fohTech, "FOH"));

  if (technical.fohWavesOutboard && technical.fohWavesOutboard.trim().length > 0) {
    lines.push(`FOH W/O: ${technical.fohWavesOutboard.trim()}`);
  }

  if (technical.monitorsFromFoh) {
    lines.push("MON: Desde FOH");
  } else {
    lines.push(formatConsolesWithTech(technical.monConsole, technical.monTech, "MON"));
    if (technical.monWavesOutboard && technical.monWavesOutboard.trim().length > 0) {
      lines.push(`MON W/O: ${technical.monWavesOutboard.trim()}`);
    }
  }

  return lines.join("\n");
};

// Simplified gear mismatch formatting without emoji icons
const formatGearMismatchesForPdf = (mismatches: GearMismatch[] = []) => {
  if (mismatches.length === 0) return "OK";
  
  const errors = mismatches.filter(m => m.severity === 'error');
  const warnings = mismatches.filter(m => m.severity === 'warning');
  
  const parts: string[] = [];
  if (errors.length > 0) {
    parts.push(`${errors.length} Error${errors.length !== 1 ? 'es' : ''}`);
  }
  if (warnings.length > 0) {
    parts.push(`${warnings.length} Aviso${warnings.length !== 1 ? 's' : ''}`);
  }
  
  return parts.join(', ');
};

const formatEquipmentNeedsForPdf = (needs: EquipmentNeeds, doc: jsPDF, startY: number): number => {
  let currentY = startY;
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;

  // Helper function to check if we need a new page
  const checkPageBreak = (requiredSpace: number) => {
    if (currentY + requiredSpace > pageHeight - 20) {
      doc.addPage();
      currentY = 20;
    }
  };

  // Header
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('Equipamiento Adicional Necesario para Cubrir Todos los Riders', 10, currentY);
  currentY += 10;

  let hasAnyNeeds = false;

  // Critical Equipment Section
  doc.setFontSize(12);
  doc.setTextColor(200, 0, 0); // Red for critical
  
  const criticalItems: string[] = [];
  
  // FOH Consoles
  if (needs.consoles.foh.length > 0) {
    needs.consoles.foh.forEach(console => {
      criticalItems.push(`Consola FOH - ${console.model}: ${console.additionalQuantity} unidades adicionales (${console.requiredBy.join(', ')})`);
    });
  }
  
  // Monitor Consoles
  if (needs.consoles.monitor.length > 0) {
    needs.consoles.monitor.forEach(console => {
      criticalItems.push(`Consola Monitor - ${console.model}: ${console.additionalQuantity} unidades adicionales (${console.requiredBy.join(', ')})`);
    });
  }
  
  // Wireless Systems
  if (needs.wireless.length > 0) {
    needs.wireless.forEach(wireless => {
      const parts: string[] = [];
      if (wireless.additionalHH > 0) parts.push(`${wireless.additionalHH} manos`);
      if (wireless.additionalBP > 0) parts.push(`${wireless.additionalBP} petacas`);
      if (parts.length > 0) {
        criticalItems.push(`Wireless - ${wireless.model}: ${parts.join(', ')} unidades (${wireless.requiredBy.join(', ')})`);
      }
    });
  }
  
  // IEM Systems
  if (needs.iem.length > 0) {
    needs.iem.forEach(iem => {
      const parts: string[] = [];
      if (iem.additionalChannels > 0) parts.push(`${iem.additionalChannels} canales`);
      if (iem.additionalBP > 0) parts.push(`${iem.additionalBP} petacas`);
      if (parts.length > 0) {
        criticalItems.push(`IEM - ${iem.model}: ${parts.join(', ')} (${iem.requiredBy.join(', ')})`);
      }
    });
  }

  if (criticalItems.length > 0) {
    hasAnyNeeds = true;
    checkPageBreak(15);
    doc.text('EQUIPAMIENTO CRITICO:', 10, currentY);
    currentY += 8;
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    
    criticalItems.forEach(item => {
      checkPageBreak(6);
      const wrappedText = doc.splitTextToSize(`• ${item}`, pageWidth - 25);
      doc.text(wrappedText, 15, currentY);
      currentY += wrappedText.length * 4 + 2;
    });
    currentY += 5;
  }

  // Infrastructure Section
  const infraItems: string[] = [];
  
  if (needs.infrastructure.cat6.additionalQuantity > 0) {
    infraItems.push(`Tiradas CAT6: ${needs.infrastructure.cat6.additionalQuantity} adicionales (${needs.infrastructure.cat6.requiredBy.join(', ')})`);
  }
  if (needs.infrastructure.hma.additionalQuantity > 0) {
    infraItems.push(`Tiradas HMA: ${needs.infrastructure.hma.additionalQuantity} adicionales (${needs.infrastructure.hma.requiredBy.join(', ')})`);
  }
  if (needs.infrastructure.coax.additionalQuantity > 0) {
    infraItems.push(`Tiradas Coax: ${needs.infrastructure.coax.additionalQuantity} adicionales (${needs.infrastructure.coax.requiredBy.join(', ')})`);
  }
  if (needs.infrastructure.opticalcon_duo.additionalQuantity > 0) {
    infraItems.push(`Tiradas OpticalCON DUO: ${needs.infrastructure.opticalcon_duo.additionalQuantity} adicionales (${needs.infrastructure.opticalcon_duo.requiredBy.join(', ')})`);
  }
  if (needs.infrastructure.analog.additionalQuantity > 0) {
    infraItems.push(`Tiradas Analogicas: ${needs.infrastructure.analog.additionalQuantity} adicionales (${needs.infrastructure.analog.requiredBy.join(', ')})`);
  }

  if (infraItems.length > 0) {
    hasAnyNeeds = true;
    checkPageBreak(15);
    doc.setFontSize(12);
    doc.setTextColor(255, 165, 0); // Orange for infrastructure
    doc.text('INFRAESTRUCTURA:', 10, currentY);
    currentY += 8;
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    
    infraItems.forEach(item => {
      checkPageBreak(6);
      const wrappedText = doc.splitTextToSize(`• ${item}`, pageWidth - 25);
      doc.text(wrappedText, 15, currentY);
      currentY += wrappedText.length * 4 + 2;
    });
    currentY += 5;
  }

  // Microphones Section
  if (needs.microphones.length > 0) {
    hasAnyNeeds = true;
    checkPageBreak(15);
    doc.setFontSize(12);
    doc.setTextColor(0, 100, 200); // Blue for microphones
    doc.text('MICROFONOS:', 10, currentY);
    currentY += 8;
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    
    needs.microphones.forEach(mic => {
      checkPageBreak(6);
      const wrappedText = doc.splitTextToSize(`• ${mic.model}: ${mic.additionalQuantity} unidades adicionales (${mic.requiredBy.join(', ')})`, pageWidth - 25);
      doc.text(wrappedText, 15, currentY);
      currentY += wrappedText.length * 4 + 2;
    });
    currentY += 5;
  }

  // Monitors Section
  if (needs.monitors.additionalQuantity > 0) {
    hasAnyNeeds = true;
    checkPageBreak(10);
    doc.setFontSize(12);
    doc.setTextColor(0, 150, 0); // Green for monitors
    doc.text('MONITORES:', 10, currentY);
    currentY += 8;
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`• Monitores adicionales: ${needs.monitors.additionalQuantity} unidades (${needs.monitors.requiredBy.join(', ')})`, 15, currentY);
    currentY += 10;
  }

  // Extras Section
  const extrasItems: string[] = [];
  
  if (needs.extras.sideFills.additionalStages > 0) {
    extrasItems.push(`Side Fills: ${needs.extras.sideFills.additionalStages} escenarios (${needs.extras.sideFills.requiredBy.join(', ')})`);
  }
  if (needs.extras.drumFills.additionalStages > 0) {
    extrasItems.push(`Drum Fills: ${needs.extras.drumFills.additionalStages} escenarios (${needs.extras.drumFills.requiredBy.join(', ')})`);
  }
  if (needs.extras.djBooths.additionalStages > 0) {
    extrasItems.push(`DJ Booths: ${needs.extras.djBooths.additionalStages} escenarios (${needs.extras.djBooths.requiredBy.join(', ')})`);
  }

  if (extrasItems.length > 0) {
    hasAnyNeeds = true;
    checkPageBreak(15);
    doc.setFontSize(12);
    doc.setTextColor(150, 0, 150); // Purple for extras
    doc.text('EXTRAS:', 10, currentY);
    currentY += 8;
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    
    extrasItems.forEach(item => {
      checkPageBreak(6);
      const wrappedText = doc.splitTextToSize(`• ${item}`, pageWidth - 25);
      doc.text(wrappedText, 15, currentY);
      currentY += wrappedText.length * 4 + 2;
    });
    currentY += 5;
  }

  // If no additional equipment is needed
  if (!hasAnyNeeds) {
    checkPageBreak(10);
    doc.setFontSize(12);
    doc.setTextColor(0, 150, 0); // Green
    doc.text('Todos los requerimientos pueden satisfacerse con el inventario actual.', 10, currentY);
    currentY += 15;
  }

  return currentY;
};

export const exportArtistTablePDF = async (data: ArtistTablePdfData): Promise<Blob> => {
  console.log('exportArtistTablePDF called with data:', data);
  
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF('landscape');
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const createdDate = new Date().toLocaleDateString('es-ES');

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
  const titleText = `${data.jobTitle} - Tabla de Artistas`;
  const stageText = data.stage && data.stage !== 'all' ? ` - ${data.stageNames?.[parseInt(data.stage)] || `Escenario ${data.stage}`}` : '';
  doc.text(`${titleText}${stageText}`, pageWidth / 2, 15, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text(new Date(data.date).toLocaleDateString('es-ES'), pageWidth / 2, 25, { align: 'center' });

  // === ARTIST TABLE ===
  const tableData = data.artists.map(artist => {
    console.log(`Processing artist: ${artist.name}`, {
      infrastructure: artist.infrastructure,
      micKit: artist.micKit,
      wiredMics: artist.wiredMics?.length || 0,
      fohTech: artist.technical.fohTech,
      monTech: artist.technical.monTech,
      gearMismatches: artist.gearMismatches?.length || 0
    });

    // Format microphones column with enhanced mixed provider support
    let microphonesDisplay = '';
    if (artist.micKit === 'mixed') {
      microphonesDisplay = `Kit: Mixto\nFestival: ${formatWiredMicsForPdf(artist.wiredMics, artist.micKit)}`;
    } else if (artist.micKit === 'festival') {
      microphonesDisplay = `Kit: Festival\n${formatWiredMicsForPdf(artist.wiredMics, artist.micKit)}`;
    } else {
      microphonesDisplay = `Kit: Banda\nBanda provee`;
    }

    return [
      artist.name,
      `${artist.showTime.start} - ${artist.showTime.end}`,
      artist.soundcheck ? `${artist.soundcheck.start} - ${artist.soundcheck.end}` : 'No',
      formatConsoleSectionForPdf(artist.technical),
      `Wireless: ${formatWirelessSystemsForPdf(artist.technical.wireless.systems, artist.technical.wireless.providedBy)}\nIEM: ${formatWirelessSystemsForPdf(artist.technical.iem.systems, artist.technical.iem.providedBy, true)}`,
      microphonesDisplay,
      artist.technical.monitors.enabled ? `${artist.technical.monitors.quantity}x` : 'Ninguno',
      formatInfrastructureForPdf(artist.infrastructure),
      [
        artist.extras.sideFill ? 'SF' : '',
        artist.extras.drumFill ? 'DF' : '',
        artist.extras.djBooth ? 'DJ' : ''
      ].filter(Boolean).join(', ') || 'Ninguno',
      artist.notes || 'Sin notas',
      artist.riderMissing ? 'Falta' : 'Completo',
      formatGearMismatchesForPdf(artist.gearMismatches)
    ];
  });

  console.log('Table data prepared:', tableData.length, 'rows');

  autoTable(doc, {
    head: [['Artista', 'Show', 'Check', 'Consolas', 'RF/IEM', 'Microfonos', 'Mons', 'Infra', 'Extras', 'Notas', 'Rider', 'Material']],
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
      1: { cellWidth: 18 }, // Show Time
      2: { cellWidth: 18 }, // Soundcheck
      3: { cellWidth: 35 }, // Consoles
      4: { cellWidth: 35 }, // Wireless/IEM
      5: { cellWidth: 30 }, // Microphones
      6: { cellWidth: 12 }, // Monitors
      7: { cellWidth: 20 }, // Infrastructure
      8: { cellWidth: 12 }, // Extras
      9: { cellWidth: 25 }, // Notes
      10: { cellWidth: 15 }, // Rider Status
      11: { cellWidth: 20 }, // Gear Status (new column)
    },
    didParseCell: (data) => {
      // Make "Missing" text red in the Rider Status column (column 10)
      if (data.column.index === 10 && data.cell.text[0] === 'Falta') {
        data.cell.styles.textColor = [255, 0, 0]; // Red color
      }
      
      // Color code gear status column (column 11) - now looking for text instead of icons
      if (data.column.index === 11) {
        const cellText = data.cell.text[0];
        if (cellText.includes('Error')) {
          data.cell.styles.textColor = [255, 0, 0]; // Red for errors
        } else if (cellText.includes('Warning')) {
          data.cell.styles.textColor = [255, 165, 0]; // Orange for warnings
        } else if (cellText === 'OK') {
          data.cell.styles.textColor = [0, 128, 0]; // Green for OK
        }
      }
    },
    margin: { left: 10, right: 10 },
  });

  // Add gear conflicts summary ONLY if includeGearConflicts is true
  if (data.includeGearConflicts) {
    const artistsWithConflicts = data.artists.filter(a => a.gearMismatches && a.gearMismatches.length > 0);
    if (artistsWithConflicts.length > 0) {
      let currentY = (doc as any).lastAutoTable.finalY + 20;
      
      // Check if we need a new page for the summary
      if (currentY > pageHeight - 60) {
        doc.addPage();
        currentY = 20;
      }
      
      // Add summary header
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('Resumen de Conflictos de Material', 10, currentY);
      currentY += 10;
      
      // Add conflicts details with page break handling
      doc.setFontSize(10);
      artistsWithConflicts.forEach(artist => {
        const errors = artist.gearMismatches?.filter(m => m.severity === 'error') || [];
        const warnings = artist.gearMismatches?.filter(m => m.severity === 'warning') || [];
        
        if (errors.length > 0 || warnings.length > 0) {
          // Check if we need a new page
          if (currentY > pageHeight - 40) {
            doc.addPage();
            currentY = 20;
          }
          
          doc.setTextColor(0, 0, 0);
          doc.text(`${artist.name}:`, 10, currentY);
          currentY += 5;
          
          [...errors, ...warnings].forEach(mismatch => {
            // Check if we need a new page for each mismatch
            if (currentY > pageHeight - 25) {
              doc.addPage();
              currentY = 20;
            }
            
            const color = mismatch.severity === 'error' ? [255, 0, 0] : [255, 165, 0];
            doc.setTextColor(color[0], color[1], color[2]);
            
            // Wrap long messages to prevent truncation
            const wrappedMessage = doc.splitTextToSize(`• ${mismatch.message}`, pageWidth - 25);
            doc.text(wrappedMessage, 15, currentY);
            currentY += wrappedMessage.length * 4;
            
            if (mismatch.details) {
              if (currentY > pageHeight - 20) {
                doc.addPage();
                currentY = 20;
              }
              
              doc.setTextColor(100, 100, 100);
              const wrappedDetails = doc.splitTextToSize(`${mismatch.details}`, pageWidth - 30);
              doc.text(wrappedDetails, 20, currentY);
              currentY += wrappedDetails.length * 4;
            }
            currentY += 3;
          });
          currentY += 3;
        }
      });
      
      // Add Equipment Needs section after conflicts summary
      if (data.equipmentNeeds) {
        currentY += 10;
        currentY = formatEquipmentNeedsForPdf(data.equipmentNeeds, doc, currentY);
      }
    } else if (data.equipmentNeeds) {
      // Add Equipment Needs section even if no conflicts
      let currentY = (doc as any).lastAutoTable.finalY + 20;
      
      // Check if we need a new page for the equipment needs
      if (currentY > pageHeight - 60) {
        doc.addPage();
        currentY = 20;
      }
      
      currentY = formatEquipmentNeedsForPdf(data.equipmentNeeds, doc, currentY);
    }
  }

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
  doc.text(`Generado: ${createdDate}`, 10, pageHeight - 10);
  
  console.log('Artist table PDF generation completed');
  return doc.output('blob');
};
