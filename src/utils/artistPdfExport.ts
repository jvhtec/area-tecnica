import { WirelessSystem, IEMSystem } from '@/types/festival-equipment';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';

export interface ArtistTechnicalInfo {
  fohTech: boolean;
  monTech: boolean;
  fohConsole: { model: string; providedBy: string };
  monConsole: { model: string; providedBy: string };
  monitorsFromFoh?: boolean;
  fohWavesOutboard?: string;
  monWavesOutboard?: string;
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

export interface PdfFestivalGearOptions {
  fohConsoles?: Array<{ model: string; quantity: number }>;
  monConsoles?: Array<{ model: string; quantity: number }>;
  fohWavesOutboard?: string;
  monWavesOutboard?: string;
  wirelessSystems?: Array<{ model: string; quantity_hh: number; quantity_bp: number; band?: string }>;
  iemSystems?: Array<{ model: string; quantity_hh: number; quantity_bp: number; band?: string }>;
  wiredMics?: Array<{ model: string; quantity: number }>;
  monitorsQuantity?: number;
  hasSideFill?: boolean;
  hasDrumFill?: boolean;
  hasDjBooth?: boolean;
  availableCat6Runs?: number;
  availableHmaRuns?: number;
  availableCoaxRuns?: number;
  availableOpticalconDuoRuns?: number;
  availableAnalogRuns?: number;
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
  festivalOptions?: PdfFestivalGearOptions;
  publicFormUrl?: string;
  publicFormQrDataUrl?: string;
  stagePlotUrl?: string;
  stagePlotFileType?: string;
}

export interface ArtistPdfOptions {
  templateMode?: boolean;
  language?: "es" | "en";
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

const imageToJpegDataUrl = (image: HTMLImageElement): string => {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create canvas context for stage plot conversion");
  }
  context.drawImage(image, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.92);
};

export const exportArtistPDF = async (data: ArtistPdfData, options: ArtistPdfOptions = {}): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const templateMode = options.templateMode === true;
  const language = options.language === "en" ? "en" : "es";
  const checklist = "[ ]";
  const showHeadMode = templateMode ? "firstPage" : "everyPage";
  const tx = (es: string, en: string) => (language === "en" ? en : es);
  const yesNo = (value: boolean) => (value ? tx("Sí", "Yes") : tx("No", "No"));
  const providerLabel = (value: string) => {
    if (value === "band") return tx("Banda", "Band");
    if (value === "mixed") return tx("Mixto", "Mixed");
    return tx("Festival", "Festival");
  };
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const createdDate = new Date().toLocaleDateString(language === "en" ? "en-GB" : "es-ES");

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
  doc.text(`${data.name} - ${tx("Escenario", "Stage")} ${data.stage}`, pageWidth / 2, 15, { align: 'center' });
  doc.setFontSize(12);
  const headerDate = data.date
    ? new Date(data.date).toLocaleDateString(language === "en" ? "en-GB" : "es-ES")
    : '';
  doc.text(headerDate, pageWidth / 2, 25, { align: 'center' });

  let yPosition = 40;
  const getLastAutoTableFinalY = (fallback: number) => {
    const docWithTable = doc as unknown as { lastAutoTable?: { finalY?: number } };
    return docWithTable.lastAutoTable?.finalY ?? fallback;
  };

  // === SCHEDULE SECTION ===
  doc.setFontSize(12);
  doc.setTextColor(125, 1, 1);
  doc.text(tx("Horario", "Schedule"), 14, yPosition);
  yPosition += 8;

  doc.setFontSize(9);
  doc.setTextColor(51, 51, 51);
  const showStart = data.schedule.show.start || (templateMode ? "________" : "");
  const showEnd = data.schedule.show.end || (templateMode ? "________" : "");
  doc.text(`${tx("Horario Show", "Show Time")}: ${showStart} - ${showEnd}`, 14, yPosition);
  yPosition += 6;
  if (templateMode || data.schedule.soundcheck) {
    const soundcheckStart = data.schedule.soundcheck?.start || (templateMode ? "________" : "");
    const soundcheckEnd = data.schedule.soundcheck?.end || (templateMode ? "________" : "");
    doc.text(`${tx("Prueba de Sonido", "Soundcheck")}: ${soundcheckStart} - ${soundcheckEnd}`, 14, yPosition);
    yPosition += 6;
  }
  yPosition += 4;

  if (templateMode && data.festivalOptions) {
    const checklistRows: string[][] = [];

    const pushOptionRows = (
      categoryLabel: string,
      optionsList: Array<{ label: string; availability: string }>,
    ) => {
      if (optionsList.length === 0) {
        checklistRows.push([categoryLabel, tx("Sin opciones cargadas", "No options loaded"), "-"]);
        return;
      }

      optionsList.forEach((option, index) => {
        checklistRows.push([
          index === 0 ? categoryLabel : "",
          `${checklist} ${option.label}`,
          option.availability,
        ]);
      });
    };

    pushOptionRows(
      tx("Consolas FOH", "FOH Consoles"),
      (data.festivalOptions.fohConsoles || []).map((consoleItem) => ({
        label: consoleItem.model,
        availability:
          consoleItem.quantity > 0
            ? `${tx("Disponibles", "Available")}: ${consoleItem.quantity}`
            : tx("Sin stock", "Out of stock"),
      })),
    );

    pushOptionRows(
      tx("Consolas MON", "MON Consoles"),
      (data.festivalOptions.monConsoles || []).map((consoleItem) => ({
        label: consoleItem.model,
        availability:
          consoleItem.quantity > 0
            ? `${tx("Disponibles", "Available")}: ${consoleItem.quantity}`
            : tx("Sin stock", "Out of stock"),
      })),
    );

    pushOptionRows(
      tx("Sistemas RF", "Wireless Systems"),
      (data.festivalOptions.wirelessSystems || []).map((system) => ({
        label: system.model,
        availability: `${tx("HH", "HH")} ${system.quantity_hh || 0} / ${tx("BP", "BP")} ${system.quantity_bp || 0}${system.band ? ` | ${system.band}` : ""}`,
      })),
    );

    pushOptionRows(
      tx("Sistemas IEM", "IEM Systems"),
      (data.festivalOptions.iemSystems || []).map((system) => ({
        label: system.model,
        availability: `${tx("Canales", "Channels")} ${system.quantity_hh || 0} / ${tx("Petacas", "Bodypacks")} ${system.quantity_bp || 0}${system.band ? ` | ${system.band}` : ""}`,
      })),
    );

    autoTable(doc, {
      head: [[tx("Categoría", "Category"), tx("Opciones disponibles", "Available options"), tx("Disponibilidad", "Availability")]],
      body: checklistRows,
      startY: yPosition,
      theme: "grid",
      showHead: showHeadMode,
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
      },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
      },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 90 },
        2: { cellWidth: 58 },
      },
    });

    yPosition = getLastAutoTableFinalY(yPosition) + 8;
  }

  // === TECHNICAL STAFF ===
  const technicalStaffRows = templateMode
    ? [
        [tx("Técnico FOH", "FOH Engineer"), ''],
        [tx("Técnico MON", "MON Engineer"), ''],
      ]
    : [
        [tx("Técnico FOH", "FOH Engineer"), yesNo(data.technical.fohTech)],
        [tx("Técnico MON", "MON Engineer"), yesNo(data.technical.monTech)],
      ];

  autoTable(doc, {
    head: [[tx("Puesto", "Position"), tx("Requiere Técnico", "Tech Required")]],
    body: technicalStaffRows,
    startY: yPosition,
    theme: 'grid',
    showHead: showHeadMode,
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

  yPosition = getLastAutoTableFinalY(yPosition) + 8;

  // === CONSOLE REQUIREMENTS ===
  const consoleRows = templateMode
    ? (() => {
        const rows: string[][] = [];
        const fohOptions = data.festivalOptions?.fohConsoles || [];
        const monOptions = data.festivalOptions?.monConsoles || [];

        if (fohOptions.length > 0) {
          fohOptions.forEach((consoleItem, index) => {
            rows.push([
              index === 0 ? tx("Consola FOH", "FOH Console") : "",
              `${checklist} ${consoleItem.model}`,
              `${tx("Disponibles", "Available")}: ${consoleItem.quantity || 0}`,
            ]);
          });
        } else {
          rows.push([tx("Consola FOH", "FOH Console"), "", ""]);
        }

        if (monOptions.length > 0) {
          monOptions.forEach((consoleItem, index) => {
            rows.push([
              index === 0 ? tx("Consola MON", "MON Console") : "",
              `${checklist} ${consoleItem.model}`,
              `${tx("Disponibles", "Available")}: ${consoleItem.quantity || 0}`,
            ]);
          });
        } else {
          rows.push([tx("Consola MON", "MON Console"), "", ""]);
        }

        rows.push([tx("Waves/Outboard FOH", "FOH Waves/Outboard"), data.festivalOptions?.fohWavesOutboard || "", ""]);
        rows.push([tx("Monitores desde FOH", "Monitors from FOH"), "", ""]);
        rows.push([tx("Waves/Outboard MON", "MON Waves/Outboard"), data.festivalOptions?.monWavesOutboard || "", ""]);

        return rows;
      })()
    : (() => {
        const rows: string[][] = [
          [tx("Consola FOH", "FOH Console"), data.technical.fohConsole.model, providerLabel(data.technical.fohConsole.providedBy)],
        ];

        if (data.technical.fohWavesOutboard && data.technical.fohWavesOutboard.trim().length > 0) {
          rows.push([tx("Waves/Outboard FOH", "FOH Waves/Outboard"), data.technical.fohWavesOutboard, "-"]);
        }

        if (data.technical.monitorsFromFoh) {
          rows.push([tx("Monitores desde FOH", "Monitors from FOH"), yesNo(true), "-"]);
        } else {
          rows.push([tx("Consola MON", "MON Console"), data.technical.monConsole.model, providerLabel(data.technical.monConsole.providedBy)]);
          if (data.technical.monWavesOutboard && data.technical.monWavesOutboard.trim().length > 0) {
            rows.push([tx("Waves/Outboard MON", "MON Waves/Outboard"), data.technical.monWavesOutboard, "-"]);
          }
        }

        return rows;
      })();

  autoTable(doc, {
    head: [[
      tx("Puesto", "Position"),
      tx("Modelo", "Model"),
      templateMode ? tx("Dotación festival", "Festival inventory") : tx("Proporcionado por", "Provided by"),
    ]],
    body: consoleRows,
    startY: yPosition,
    theme: 'grid',
    showHead: showHeadMode,
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [125, 1, 1],
      textColor: [255, 255, 255],
    },
  });

  yPosition = getLastAutoTableFinalY(yPosition) + 8;

  // === MIC KIT DISCLAIMER ===
  if (!templateMode && data.micKit && (data.micKit === 'band' || data.micKit === 'mixed')) {
    const checkPageSpace = (needed: number) => {
      if (yPosition + needed > pageHeight - 25) {
        doc.addPage();
        yPosition = 20;
      }
    };
    checkPageSpace(18);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bolditalic');
    doc.setTextColor(125, 1, 1);
    let disclaimerText = '';
    if (data.micKit === 'band') {
      disclaimerText = tx(
        'Nota: Kit de microfonia cableada proporcionado integramente por la banda.',
        'Note: Wired microphone kit provided entirely by the band.'
      );
    } else if (data.micKit === 'mixed') {
      disclaimerText = tx(
        'Nota: Setup mixto de microfonia cableada - parte proporcionada por la banda y parte por el festival.',
        'Note: Mixed wired microphone setup - some provided by the band and some by the festival.'
      );
    }
    const disclaimerLines = doc.splitTextToSize(disclaimerText, pageWidth - 28);
    doc.text(disclaimerLines, 14, yPosition);
    yPosition += disclaimerLines.length * 5 + 4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 51, 51);
  }

  // === WIRED MICROPHONES ===
  if (templateMode || (data.wiredMics && data.wiredMics.length > 0)) {
    const wiredMicRows = templateMode
      ? (() => {
          const optionsList = data.festivalOptions?.wiredMics || [];
          if (optionsList.length === 0) return Array.from({ length: 5 }, () => ["", "", "", ""]);
          return optionsList.map((mic) => [
            `${checklist} ${mic.model}`,
            "____",
            "",
            `${tx("Disponibles", "Available")}: ${mic.quantity || 0}`,
          ]);
        })()
      : (data.wiredMics || []).map(mic => [
          mic.model,
          mic.quantity.toString(),
          yesNo(Boolean(mic.exclusive_use)),
          mic.notes || '-'
        ]);

    autoTable(doc, {
      head: [[
        tx("Modelo Micrófono", "Microphone Model"),
        tx("Cantidad", "Quantity"),
        tx("Uso Exclusivo", "Exclusive Use"),
        tx("Notas", "Notes")
      ]],
      body: wiredMicRows,
      startY: yPosition,
      theme: 'grid',
      showHead: showHeadMode,
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

    yPosition = getLastAutoTableFinalY(yPosition) + 8;
  }

  // === RF & WIRELESS ===
  const wirelessRows: Array<Array<string | number>> = [];
  
  if (templateMode) {
    const wirelessOptions = data.festivalOptions?.wirelessSystems || [];
    const iemOptions = data.festivalOptions?.iemSystems || [];

    if (wirelessOptions.length === 0 && iemOptions.length === 0) {
      wirelessRows.push(
        [tx("Mano", "Handheld"), "____", "", "", ""],
        [tx("Petaca", "Bodypack"), "____", "", "", ""],
        [tx("Canales IEM", "IEM Channels"), "____", "", "", ""],
        [tx("Petacas IEM", "IEM Bodypacks"), "____", "", "", ""],
      );
    } else {
      wirelessOptions.forEach((system, index) => {
        wirelessRows.push([
          index === 0 ? tx("Sistemas RF", "Wireless Systems") : "",
          "____",
          `${checklist} ${system.model}`,
          system.band || "-",
          `${tx("HH", "HH")} ${system.quantity_hh || 0} / ${tx("BP", "BP")} ${system.quantity_bp || 0}`,
        ]);
      });

      iemOptions.forEach((system, index) => {
        wirelessRows.push([
          index === 0 ? tx("Sistemas IEM", "IEM Systems") : "",
          "____",
          `${checklist} ${system.model}`,
          system.band || "-",
          `${tx("Canales", "Channels")} ${system.quantity_hh || 0} / ${tx("Petacas", "Bodypacks")} ${system.quantity_bp || 0}`,
        ]);
      });
    }
  } else {
    // Process wireless systems with individual provider information
    if (data.technical.wireless.systems && data.technical.wireless.systems.length > 0) {
      data.technical.wireless.systems.forEach(system => {
        const systemProvider = system.provided_by || data.technical.wireless.providedBy;
        
        if (system.quantity_hh && system.quantity_hh > 0) {
          wirelessRows.push([
            tx('Mano', 'Handheld'),
            system.quantity_hh,
            system.model,
            system.band || '-',
            providerLabel(systemProvider || 'festival')
          ]);
        }
        if (system.quantity_bp && system.quantity_bp > 0) {
          wirelessRows.push([
            tx('Petaca', 'Bodypack'),
            system.quantity_bp,
            system.model,
            system.band || '-',
            providerLabel(systemProvider || 'festival')
          ]);
        }
      });
    } else if (data.technical.wireless.handhelds || data.technical.wireless.bodypacks) {
      // Handle legacy format
      if (data.technical.wireless.handhelds) {
        wirelessRows.push([
          tx('Mano', 'Handheld'),
          data.technical.wireless.handhelds,
          data.technical.wireless.model || '-',
          data.technical.wireless.band || '-',
          providerLabel(data.technical.wireless.providedBy)
        ]);
      }
      if (data.technical.wireless.bodypacks) {
        wirelessRows.push([
          tx('Petaca', 'Bodypack'),
          data.technical.wireless.bodypacks,
          data.technical.wireless.model || '-',
          data.technical.wireless.band || '-',
          providerLabel(data.technical.wireless.providedBy)
        ]);
      }
    }

    // Process IEM systems with individual provider information
    if (data.technical.iem.systems && data.technical.iem.systems.length > 0) {
      data.technical.iem.systems.forEach(system => {
        const systemProvider = system.provided_by || data.technical.iem.providedBy;
        
        if (system.quantity_hh && system.quantity_hh > 0) {
          wirelessRows.push([
            tx('Canales IEM', 'IEM Channels'),
            system.quantity_hh,
            system.model,
            system.band || '-',
            providerLabel(systemProvider || 'festival')
          ]);
        }
        if (system.quantity_bp && system.quantity_bp > 0) {
          wirelessRows.push([
            tx('Petacas IEM', 'IEM Bodypacks'),
            system.quantity_bp,
            system.model,
            system.band || '-',
            providerLabel(systemProvider || 'festival')
          ]);
        }
      });
    } else if (data.technical.iem.quantity) {
      // Handle legacy format
      wirelessRows.push([
        tx('Sistema IEM', 'IEM System'),
        data.technical.iem.quantity,
        data.technical.iem.model || '-',
        data.technical.iem.band || '-',
        providerLabel(data.technical.iem.providedBy)
      ]);
    }
  }

  if (templateMode || wirelessRows.length > 0) {
    autoTable(doc, {
      head: [[
        tx('Tipo', 'Type'),
        tx('Cant.', 'Qty'),
        tx('Modelo', 'Model'),
        tx('Banda', 'Band'),
        templateMode ? tx("Dotación festival", "Festival inventory") : tx('Proporcionado por', 'Provided by')
      ]],
      body: wirelessRows,
      startY: yPosition,
      theme: 'grid',
      showHead: showHeadMode,
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
      },
    });

    yPosition = getLastAutoTableFinalY(yPosition) + 8;
  }

  // === MONITORS ===
  if (templateMode || data.technical.monitors.enabled) {
    const monitorRows = templateMode
      ? [[
          tx("Monitores", "Monitors"),
          data.festivalOptions?.monitorsQuantity
            ? `${tx("Disponibles", "Available")}: ${data.festivalOptions.monitorsQuantity}`
            : "",
        ]]
      : [[tx('Monitores', 'Monitors'), data.technical.monitors.quantity]];

    autoTable(doc, {
      head: [[tx('Tipo', 'Type'), tx('Cantidad', 'Quantity')]],
      body: monitorRows,
      startY: yPosition,
      theme: 'grid',
      showHead: showHeadMode,
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
      },
    });

    yPosition = getLastAutoTableFinalY(yPosition) + 8;
  }

  // === INFRASTRUCTURE ===
  const infrastructureRows = templateMode
    ? [
        ['CAT6', data.festivalOptions?.availableCat6Runs ? `${tx("Disponibles", "Available")}: ${data.festivalOptions.availableCat6Runs}` : ''],
        ['HMA', data.festivalOptions?.availableHmaRuns ? `${tx("Disponibles", "Available")}: ${data.festivalOptions.availableHmaRuns}` : ''],
        ['Coax', data.festivalOptions?.availableCoaxRuns ? `${tx("Disponibles", "Available")}: ${data.festivalOptions.availableCoaxRuns}` : ''],
        ['OpticalCon Duo', data.festivalOptions?.availableOpticalconDuoRuns ? `${tx("Disponibles", "Available")}: ${data.festivalOptions.availableOpticalconDuoRuns}` : ''],
        [tx('Líneas Analógicas', 'Analog Lines'), data.festivalOptions?.availableAnalogRuns ? `${tx("Disponibles", "Available")}: ${data.festivalOptions.availableAnalogRuns}` : ''],
        [tx('Otros', 'Other'), ''],
      ]
    : [
        data.infrastructure.cat6.enabled && ['CAT6', data.infrastructure.cat6.quantity],
        data.infrastructure.hma.enabled && ['HMA', data.infrastructure.hma.quantity],
        data.infrastructure.coax.enabled && ['Coax', data.infrastructure.coax.quantity],
        data.infrastructure.opticalconDuo.enabled && ['OpticalCon Duo', data.infrastructure.opticalconDuo.quantity],
        data.infrastructure.analog > 0 && [tx('Líneas Analógicas', 'Analog Lines'), data.infrastructure.analog],
      ].filter(Boolean);

  if (templateMode || infrastructureRows.length > 0) {
    autoTable(doc, {
      head: [[tx('Tipo', 'Type'), tx('Cantidad', 'Quantity')]],
      body: infrastructureRows,
      startY: yPosition,
      theme: 'grid',
      showHead: showHeadMode,
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
      },
    });

    yPosition = getLastAutoTableFinalY(yPosition) + 8;
  }

  // === EXTRAS ===
  const extraRows = templateMode
    ? [
        ['Side Fill', yesNo(Boolean(data.festivalOptions?.hasSideFill)), ''],
        ['Drum Fill', yesNo(Boolean(data.festivalOptions?.hasDrumFill)), ''],
        ['DJ Booth', yesNo(Boolean(data.festivalOptions?.hasDjBooth)), ''],
        [tx('Cableado Adicional', 'Additional Wired'), '', ''],
      ]
    : [
        data.extras.sideFill && ['Side Fill', yesNo(true)],
        data.extras.drumFill && ['Drum Fill', yesNo(true)],
        data.extras.djBooth && ['DJ Booth', yesNo(true)],
        data.extras.wired && [tx('Cableado Adicional', 'Additional Wired'), data.extras.wired]
      ].filter(Boolean);

  if (templateMode || extraRows.length > 0) {
    autoTable(doc, {
      head: templateMode
        ? [[
            tx('Requerimientos Adicionales', 'Extra Requirements'),
            tx('Disponible', 'Available'),
            tx('Requerido', 'Required'),
          ]]
        : [[tx('Requerimientos Adicionales', 'Extra Requirements'), tx('Detalle', 'Details')]],
      body: extraRows,
      startY: yPosition,
      theme: 'grid',
      showHead: showHeadMode,
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
      },
    });

    yPosition = getLastAutoTableFinalY(yPosition) + 8;
  }

  // === NOTES ===
  if (templateMode || data.notes) {
    doc.setFontSize(12);
    doc.setTextColor(125, 1, 1);
    doc.text(tx("Notas", "Notes"), 14, yPosition);
    yPosition += 8;

    if (templateMode) {
      const notesBoxHeight = 35;
      doc.setDrawColor(180, 180, 180);
      doc.rect(14, yPosition - 4, pageWidth - 28, notesBoxHeight);
      yPosition += notesBoxHeight + 6;
    } else {
      doc.setFontSize(9);
      doc.setTextColor(51, 51, 51);
      const splitNotes = doc.splitTextToSize(data.notes, pageWidth - 28);
      doc.text(splitNotes, 14, yPosition);
      yPosition += splitNotes.length * 5 + 10;
    }
  }

  if (templateMode) {
    const blockHeight = 42;
    if (yPosition + blockHeight > pageHeight - 20) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(10);
    doc.setTextColor(125, 1, 1);
    doc.text(
      tx(
        "Recomendado: completar este formulario de forma electrónica",
        "Recommended: complete this form electronically",
      ),
      14,
      yPosition,
    );
    yPosition += 5;

    doc.setFontSize(8);
    doc.setTextColor(51, 51, 51);
    const electronicSuggestion = tx(
      "Sugerencia: usa el enlace público para evitar errores de transcripción en papel.",
      "Suggestion: use the public link to avoid paper transcription errors.",
    );
    const suggestionLines = doc.splitTextToSize(electronicSuggestion, pageWidth - 28);
    doc.text(suggestionLines, 14, yPosition);
    yPosition += suggestionLines.length * 4 + 2;

    if (data.publicFormQrDataUrl) {
      try {
        const qrSize = 28;
        const qrX = 14;
        const qrY = yPosition;
        doc.addImage(data.publicFormQrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
        if (data.publicFormUrl && data.publicFormUrl.trim().length > 0) {
          doc.link(qrX, qrY, qrSize, qrSize, { url: data.publicFormUrl });
        }

        doc.setFontSize(9);
        doc.text(
          tx("Escanea para completar online", "Scan to complete online"),
          14 + qrSize + 4,
          yPosition + 8,
        );
        doc.setFontSize(8);
        doc.text(
          tx("Solo un envío permitido por enlace", "Only one submission is allowed per link"),
          14 + qrSize + 4,
          yPosition + 14,
        );
      } catch (qrError) {
        console.error("Error adding artist form QR to PDF:", qrError);
      }
      yPosition += 32;
    } else {
      const fallbackText = data.publicFormUrl && data.publicFormUrl.trim().length > 0
        ? tx("No se pudo incrustar el QR. Usa el enlace en panel de gestión.", "Could not embed QR. Use the link from management panel.")
        : tx("QR no disponible: genera/copía el enlace desde panel de gestión.", "QR unavailable: generate/copy link from management panel.");

      const fallbackLines = doc.splitTextToSize(fallbackText, pageWidth - 28);
      doc.text(fallbackLines, 14, yPosition);
      yPosition += fallbackLines.length * 4 + 2;
    }
  }

  // === COMPANY LOGO + FOOTER ===
  console.log("Attempting to load Sector Pro logo");
  let footerLogoImage = await loadImageSafely('/sector pro logo.png', 'Sector Pro logo');
  if (!footerLogoImage) {
    footerLogoImage = await loadImageSafely('/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png', 'alternative Sector Pro logo');
  }

  const drawPageFooter = (targetPageWidth: number, targetPageHeight: number, includeArtistInfo = false) => {
    if (footerLogoImage) {
      try {
        const logoWidth = 20;
        const ratio = footerLogoImage.width / footerLogoImage.height;
        const logoHeight = logoWidth / ratio;
        doc.addImage(
          footerLogoImage,
          'PNG',
          targetPageWidth / 2 - logoWidth / 2,
          targetPageHeight - logoHeight - 6,
          logoWidth,
          logoHeight
        );
      } catch (error) {
        console.error('Error adding footer logo to PDF:', error);
      }
    }

    doc.setFontSize(8);
    doc.setTextColor(51, 51, 51);
    doc.text(`${tx("Generado", "Generated")}: ${createdDate}`, 10, targetPageHeight - 10);
    if (includeArtistInfo) {
      doc.text(`${tx("Artista", "Artist")}: ${data.name}`, targetPageWidth - 10, targetPageHeight - 10, { align: 'right' });
    }
  };

  drawPageFooter(pageWidth, pageHeight);

  if (!templateMode && data.stagePlotUrl) {
    const stagePlotImage = await loadImageSafely(data.stagePlotUrl, "stage plot");
    if (stagePlotImage) {
      try {
        const stagePlotDataUrl = imageToJpegDataUrl(stagePlotImage);
        doc.addPage("a4", "landscape");

        const stagePlotPageWidth = doc.internal.pageSize.getWidth();
        const stagePlotPageHeight = doc.internal.pageSize.getHeight();
        const margin = 8;
        const footerReserve = 14;
        const availableWidth = stagePlotPageWidth - margin * 2;
        const availableHeight = stagePlotPageHeight - margin * 2 - footerReserve;
        const imageRatio = stagePlotImage.width / stagePlotImage.height;
        const pageRatio = availableWidth / availableHeight;

        let renderWidth = availableWidth;
        let renderHeight = availableHeight;
        if (imageRatio > pageRatio) {
          renderHeight = renderWidth / imageRatio;
        } else {
          renderWidth = renderHeight * imageRatio;
        }

        const x = (stagePlotPageWidth - renderWidth) / 2;
        const y = Math.max(margin, (stagePlotPageHeight - footerReserve - renderHeight) / 2);

        doc.addImage(stagePlotDataUrl, "JPEG", x, y, renderWidth, renderHeight);
        drawPageFooter(stagePlotPageWidth, stagePlotPageHeight, true);
      } catch (stagePlotError) {
        console.error("Error adding stage plot page to PDF:", stagePlotError);
      }
    }
  }
  
  console.log('Individual artist PDF generation completed');
  return doc.output('blob');
};
