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
      const providerLabel = provider === "festival" ? "Festival" : "Banda";
      const providerToken = provider === "festival" ? FESTIVAL_TEXT_TOKEN : BAND_TEXT_TOKEN;
      
      if (isIEM) {
        const channels = system.quantity_hh || system.quantity || 0;
        const beltpacks = system.quantity_bp || 0;
        return `${providerToken}${providerLabel}: ${system.model}: ${channels} ch${beltpacks > 0 ? `, ${beltpacks} bp` : ''}`;
      } else {
        const channels = system.quantity_ch || 0;
        const hh = system.quantity_hh || 0;
        const bp = system.quantity_bp || 0;
        const total = hh + bp;
        const channelPart = channels > 0 ? `${channels} ch` : '';
        if (hh > 0 && bp > 0) {
          const txPart = `${hh}x HH, ${bp}x BP`;
          return `${providerToken}${providerLabel}: ${system.model}: ${channelPart ? `${channelPart}, ` : ''}${txPart}`;
        } else if (total > 0) {
          return `${providerToken}${providerLabel}: ${system.model}: ${channelPart ? `${channelPart}, ` : ''}${total}x`;
        } else if (channels > 0) {
          return `${providerToken}${providerLabel}: ${system.model}: ${channels} ch`;
        }
        return `${providerToken}${providerLabel}: ${system.model}`;
      }
    }).join("\n");
  } else {
    // Original formatting for single provider
    return systems.map(system => {
      if (isIEM) {
        const channels = system.quantity_hh || system.quantity || 0;
        const beltpacks = system.quantity_bp || 0;
        return `${system.model}: ${channels} ch${beltpacks > 0 ? `, ${beltpacks} bp` : ''}`;
      } else {
        const channels = system.quantity_ch || 0;
        const hh = system.quantity_hh || 0;
        const bp = system.quantity_bp || 0;
        const total = hh + bp;
        const channelPart = channels > 0 ? `${channels} ch` : '';
        if (hh > 0 && bp > 0) {
          const txPart = `${hh}x HH, ${bp}x BP`;
          return `${system.model}: ${channelPart ? `${channelPart}, ` : ''}${txPart}`;
        } else if (total > 0) {
          return `${system.model}: ${channelPart ? `${channelPart}, ` : ''}${total}x`;
        } else if (channels > 0) {
          return `${system.model}: ${channels} ch`;
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

const normalizeProviderToken = (value: string | undefined): 'festival' | 'band' | 'mixed' => {
  const normalized = (value || '').toLowerCase().trim();
  if (normalized === 'festival') return 'festival';
  if (normalized === 'banda' || normalized === 'band') return 'band';
  if (normalized === 'mixto' || normalized === 'mixed') return 'mixed';
  return 'festival';
};

const summarizeProvider = (values: Array<string | undefined>): 'festival' | 'band' | 'mixed' => {
  const unique = new Set(values.map(normalizeProviderToken));
  if (unique.size === 1) {
    return unique.values().next().value || 'festival';
  }
  return 'mixed';
};

const getProviderCellColor = (provider: 'festival' | 'band' | 'mixed'): [number, number, number] => {
  if (provider === 'festival') return [214, 232, 255];
  if (provider === 'band') return [255, 226, 204];
  return [232, 232, 232];
};

const FESTIVAL_TEXT_TOKEN = '__FESTIVAL_ITEM__';
const BAND_TEXT_TOKEN = '__BAND_ITEM__';

const hasProviderTextToken = (value: string): boolean =>
  value.includes(FESTIVAL_TEXT_TOKEN) || value.includes(BAND_TEXT_TOKEN);

const stripProviderTextTokens = (value: string): string =>
  value.replaceAll(FESTIVAL_TEXT_TOKEN, '').replaceAll(BAND_TEXT_TOKEN, '');

const getProviderTokenType = (line: string): 'festival' | 'band' | 'default' => {
  if (line.includes(FESTIVAL_TEXT_TOKEN)) return 'festival';
  if (line.includes(BAND_TEXT_TOKEN)) return 'band';
  return 'default';
};

const getStageCellColor = (stageNumber: number): [number, number, number] => {
  const palette: Array<[number, number, number]> = [
    [238, 244, 252],
    [242, 250, 238],
    [252, 245, 236],
    [245, 240, 252],
    [239, 250, 250],
  ];
  if (!Number.isFinite(stageNumber) || stageNumber <= 0) {
    return [245, 245, 245];
  }
  return palette[(stageNumber - 1) % palette.length];
};

const formatEquipmentNeedsForPdf = (
  needs: EquipmentNeeds,
  doc: jsPDF,
  startY: number,
  onAddPage?: () => void,
): number => {
  let currentY = startY;
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;

  // Helper function to check if we need a new page
  const checkPageBreak = (requiredSpace: number) => {
    if (currentY + requiredSpace > pageHeight - 20) {
      doc.addPage();
      onAddPage?.();
      currentY = 40;
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
      if (wireless.additionalChannels > 0) parts.push(`${wireless.additionalChannels} canales`);
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
  const leftMargin = 10;
  const rightMargin = 10;
  const headerBottomY = 40;
  const footerReserve = 24;

  const stageText = data.stage && data.stage !== 'all'
    ? ` - ${data.stageNames?.[parseInt(data.stage)] || `Escenario ${data.stage}`}`
    : '';
  const titleText = `${data.jobTitle} - Tabla de Artistas${stageText}`;
  const dateText = new Date(data.date).toLocaleDateString('es-ES');

  let headerLogoImage: HTMLImageElement | null = null;
  let headerLogoFormat: 'PNG' | 'JPEG' = 'PNG';
  if (data.logoUrl) {
    console.log("Attempting to load festival logo:", data.logoUrl);
    headerLogoImage = await loadImageSafely(data.logoUrl, 'festival logo');
    if (headerLogoImage) {
      headerLogoFormat = data.logoUrl.toLowerCase().includes('.png') ? 'PNG' : 'JPEG';
    }
  }

  if (!headerLogoImage) {
    console.log("Trying fallback logo");
    headerLogoImage = await loadImageSafely('/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png', 'fallback logo');
    if (headerLogoImage) {
      headerLogoFormat = 'PNG';
    }
  }

  const drawPageHeader = (): void => {
    doc.setFillColor(125, 1, 1);
    doc.rect(0, 0, pageWidth, 30, 'F');

    if (headerLogoImage && headerLogoImage.width > 0 && headerLogoImage.height > 0) {
      const maxLogoWidth = 40;
      const maxLogoHeight = 18;
      const scale = Math.min(maxLogoWidth / headerLogoImage.width, maxLogoHeight / headerLogoImage.height);
      const drawWidth = headerLogoImage.width * scale;
      const drawHeight = headerLogoImage.height * scale;
      doc.addImage(
        headerLogoImage,
        headerLogoFormat,
        pageWidth - drawWidth - rightMargin,
        6,
        drawWidth,
        drawHeight,
      );
    }

    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text(titleText, pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(dateText, pageWidth / 2, 25, { align: 'center' });
  };

  drawPageHeader();

  // === ARTIST TABLE ===
  const rowColorMeta: Array<{
    stage: number;
    consolesProvider: 'festival' | 'band' | 'mixed';
    rfIemProvider: 'festival' | 'band' | 'mixed';
    micProvider: 'festival' | 'band' | 'mixed';
  }> = [];

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
      microphonesDisplay = `Kit: Mixto\n${FESTIVAL_TEXT_TOKEN}Festival: ${formatWiredMicsForPdf(artist.wiredMics, artist.micKit)}`;
    } else if (artist.micKit === 'festival') {
      microphonesDisplay = `Kit: Festival\n${formatWiredMicsForPdf(artist.wiredMics, artist.micKit)}`;
    } else {
      microphonesDisplay = `Kit: Banda\nBanda provee`;
    }

    const rfIemProvider = summarizeProvider([
      artist.technical.wireless.providedBy,
      artist.technical.iem.providedBy,
    ]);
    const consolesProvider = summarizeProvider([
      artist.technical.fohConsole.providedBy,
      artist.technical.monConsole.providedBy,
    ]);
    const micProvider = normalizeProviderToken(artist.micKit);
    rowColorMeta.push({
      stage: artist.stage,
      consolesProvider,
      rfIemProvider,
      micProvider,
    });

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

  const availableTableWidth = pageWidth - leftMargin - rightMargin;
  const baseColumnWidths = [25, 18, 18, 35, 35, 30, 12, 20, 12, 25, 15, 20];
  const totalBaseWidth = baseColumnWidths.reduce((sum, width) => sum + width, 0) || 1;
  const normalizedColumnStyles = baseColumnWidths.reduce((acc, width, index) => {
    acc[index] = { cellWidth: availableTableWidth * (width / totalBaseWidth) };
    return acc;
  }, {} as Record<number, { cellWidth: number }>);
  const tokenizedCellText = new Map<string, string>();

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
    columnStyles: normalizedColumnStyles,
    didParseCell: (cellData) => {
      if (cellData.section === 'body') {
        const rowMeta = rowColorMeta[cellData.row.index];
        if (rowMeta) {
          const stageColor = getStageCellColor(rowMeta.stage);
          const consoleColor = getProviderCellColor(rowMeta.consolesProvider);
          const rfIemColor = getProviderCellColor(rowMeta.rfIemProvider);
          const micColor = getProviderCellColor(rowMeta.micProvider);

          if (cellData.column.index >= 0 && cellData.column.index <= 2) {
            cellData.cell.styles.fillColor = stageColor;
            cellData.cell.styles.textColor = [30, 30, 30];
          }
          if (cellData.column.index === 3) {
            cellData.cell.styles.fillColor = consoleColor;
            cellData.cell.styles.textColor = [35, 35, 35];
          }
          if (cellData.column.index === 4) {
            cellData.cell.styles.fillColor = rfIemColor;
            cellData.cell.styles.textColor = [35, 35, 35];
          }
          if (cellData.column.index === 5) {
            cellData.cell.styles.fillColor = micColor;
            cellData.cell.styles.textColor = [35, 35, 35];
          }
        }
      }

      const mixedDetailColumns = cellData.column.index === 4 || cellData.column.index === 5;
      if (mixedDetailColumns) {
        const cellText = Array.isArray(cellData.cell.text)
          ? cellData.cell.text.join('\n')
          : String(cellData.cell.text || '');
        if (hasProviderTextToken(cellText)) {
          tokenizedCellText.set(`${cellData.row.index}-${cellData.column.index}`, cellText);
          const visibleText = stripProviderTextTokens(cellText);
          cellData.cell.text = visibleText.split('\n');
          const fillColor = cellData.cell.styles.fillColor;
          if (Array.isArray(fillColor)) {
            cellData.cell.styles.textColor = [fillColor[0], fillColor[1], fillColor[2]];
          }
        }
      }

      // Make "Missing" text red in the Rider Status column (column 10)
      if (cellData.column.index === 10 && cellData.cell.text[0] === 'Falta') {
        cellData.cell.styles.textColor = [255, 0, 0]; // Red color
      }
      
      // Color code gear status column (column 11) - now looking for text instead of icons
      if (cellData.column.index === 11) {
        const cellText = cellData.cell.text[0];
        if (cellText.includes('Error')) {
          cellData.cell.styles.textColor = [255, 0, 0]; // Red for errors
        } else if (cellText.includes('Warning') || cellText.includes('Aviso')) {
          cellData.cell.styles.textColor = [255, 165, 0]; // Orange for warnings
        } else if (cellText === 'OK') {
          cellData.cell.styles.textColor = [0, 128, 0]; // Green for OK
        }
      }
    },
    didDrawCell: (cellData) => {
      if (cellData.section !== 'body') return;
      const key = `${cellData.row.index}-${cellData.column.index}`;
      const tokenizedText = tokenizedCellText.get(key);
      if (!tokenizedText) return;

      const docInstance = (cellData as any).doc;
      const cellPadding = typeof cellData.cell.styles.cellPadding === 'number'
        ? cellData.cell.styles.cellPadding
        : 2;
      const textX = cellData.cell.x + cellPadding;
      const maxTextWidth = Math.max(0, cellData.cell.width - (cellPadding * 2));
      const wrappedWithProvider: Array<{ providerType: 'festival' | 'band' | 'default'; text: string }> = [];
      for (const rawLine of tokenizedText.split('\n')) {
        const providerType = getProviderTokenType(rawLine);
        const visibleLine = stripProviderTextTokens(rawLine);
        const wrappedLines: string[] = docInstance.splitTextToSize(visibleLine, maxTextWidth);

        for (const wrappedLine of wrappedLines) {
          wrappedWithProvider.push({ providerType, text: wrappedLine });
        }
      }

      if (wrappedWithProvider.length === 0) return;
      const usableHeight = Math.max(2, cellData.cell.height - (cellPadding * 2));
      const lineStep = usableHeight / wrappedWithProvider.length;
      let textY = cellData.cell.y + cellPadding + (lineStep * 0.8);
      const cellBottomLimit = cellData.cell.y + cellData.cell.height - 1;

      for (const line of wrappedWithProvider) {
        if (textY > cellBottomLimit) break;

        if (line.providerType === 'festival') {
          docInstance.setTextColor(72, 105, 136);
        } else {
          docInstance.setTextColor(35, 35, 35);
        }

        docInstance.text(line.text, textX, textY);
        textY += lineStep;
      }
    },
    margin: { left: leftMargin, right: rightMargin, top: headerBottomY, bottom: footerReserve },
    rowPageBreak: 'avoid',
    didDrawPage: () => {
      drawPageHeader();
    },
  });

  // Add gear conflicts summary ONLY if includeGearConflicts is true
  if (data.includeGearConflicts) {
    const artistsWithConflicts = data.artists.filter(a => a.gearMismatches && a.gearMismatches.length > 0);
    if (artistsWithConflicts.length > 0) {
      let currentY = (doc as any).lastAutoTable.finalY + 20;
      
      // Check if we need a new page for the summary
      if (currentY > pageHeight - 60) {
        doc.addPage();
        drawPageHeader();
        currentY = 40;
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
            drawPageHeader();
            currentY = 40;
          }
          
          doc.setTextColor(0, 0, 0);
          doc.text(`${artist.name}:`, 10, currentY);
          currentY += 5;
          
          [...errors, ...warnings].forEach(mismatch => {
            // Check if we need a new page for each mismatch
            if (currentY > pageHeight - 25) {
              doc.addPage();
              drawPageHeader();
              currentY = 40;
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
                drawPageHeader();
                currentY = 40;
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
        currentY = formatEquipmentNeedsForPdf(data.equipmentNeeds, doc, currentY, drawPageHeader);
      }
    } else if (data.equipmentNeeds) {
      // Add Equipment Needs section even if no conflicts
      let currentY = (doc as any).lastAutoTable.finalY + 20;
      
      // Check if we need a new page for the equipment needs
      if (currentY > pageHeight - 60) {
        doc.addPage();
        drawPageHeader();
        currentY = 40;
      }
      
      currentY = formatEquipmentNeedsForPdf(data.equipmentNeeds, doc, currentY, drawPageHeader);
    }
  }

  const sectorImg =
    (await loadImageSafely('/sector pro logo.png', 'Sector Pro logo')) ||
    (await loadImageSafely('/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png', 'alternative Sector Pro logo'));

  const totalPages = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    doc.setPage(pageNumber);
    drawPageHeader();

    if (sectorImg && sectorImg.width > 0 && sectorImg.height > 0) {
      try {
        const logoWidth = 20;
        const logoHeight = logoWidth * (sectorImg.height / sectorImg.width);
        doc.addImage(
          sectorImg,
          'PNG',
          pageWidth / 2 - logoWidth / 2,
          pageHeight - logoHeight - 5,
          logoWidth,
          logoHeight,
        );
      } catch (error) {
        console.error('Error adding Sector Pro logo to PDF:', error);
      }
    }

    doc.setFontSize(8);
    doc.setTextColor(51, 51, 51);
    doc.text(`Generado: ${createdDate}`, leftMargin, pageHeight - 10);
    doc.text(`Pagina ${pageNumber} de ${totalPages}`, pageWidth - rightMargin, pageHeight - 10, { align: 'right' });
  }
  
  console.log('Artist table PDF generation completed');
  return doc.output('blob');
};
