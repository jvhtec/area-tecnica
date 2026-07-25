import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
import { formatFrequencyBand } from '@/lib/frequencyBands';
import { fitImageWithin } from '@/utils/pdf/soundvisionReportPdf';
import { getLastAutoTableY, pdfToBlob } from '@/utils/pdf/exportHelpers';
import { loadImageWithTimeout } from '@/utils/pdf/shared/pdfExportShared';
import {
  drawFestivalChrome,
  drawFestivalMetaGrid,
  drawFestivalSectionHeading,
  drawFestivalTitleBlock,
  FESTIVAL_ACCENT,
  FESTIVAL_INK,
  FESTIVAL_RULE,
  FESTIVAL_SOFT,
  festivalGeometry,
  festivalTableTheme,
  loadFestivalIssuerMark,
  setFestivalMonoText,
  setFestivalText,
  type FestivalGeometry,
} from '@/utils/pdf/festival-report';
import { drawArtistScheduleSection } from '@/utils/pdf/artistScheduleSection';
import { buildFestivalOptionChecklistRows } from '@/utils/pdf/artistTemplateChecklist';
import type { ArtistPdfData, ArtistPdfOptions } from '@/utils/pdf/artistPdfTypes';

export type {
  ArtistInfrastructure,
  ArtistPdfData,
  ArtistPdfOptions,
  ArtistTechnicalInfo,
  PdfFestivalGearOptions,
} from '@/utils/pdf/artistPdfTypes';

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
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const createdDate = new Date().toLocaleDateString(language === "en" ? "en-GB" : "es-ES");

  await loadFestivalIssuerMark();
  const clientLogo = data.logoUrl
    ? await loadImageWithTimeout(data.logoUrl, 'festival logo')
    : null;

  const headerDate = data.date
    ? new Date(data.date).toLocaleDateString(language === "en" ? "en-GB" : "es-ES")
    : '';
  const stageLabel = `${tx("Escenario", "Stage")} ${data.stage}`;

  const chrome = (): FestivalGeometry =>
    drawFestivalChrome(doc, {
      kind: 'artist',
      kindLabel: tx('Ficha de artista', 'Artist datasheet'),
      eventTitle: data.name,
      contextLabel: [stageLabel, headerDate].filter(Boolean).join('  ·  '),
      issuer: `Sector-Pro  ·  ${data.name}`,
      paginate: false,
    });

  const geo = chrome();

  const tableTheme = festivalTableTheme(geo, { fontSize: 7.8 });
  const tableMargin = {
    left: geo.left,
    right: geo.pageWidth - geo.right,
    top: geo.contentTop,
    bottom: geo.pageHeight - geo.contentBottom,
  };

  let yPosition = drawFestivalTitleBlock(doc, geo, {
    eyebrow: templateMode
      ? tx('Formulario técnico  ·  Rev. A', 'Technical form  ·  Rev. A')
      : tx('Ficha de artista  ·  Rev. A', 'Artist datasheet  ·  Rev. A'),
    title: data.name,
    subtitle: [stageLabel, headerDate].filter(Boolean).join('  ·  '),
    clientLogo,
  });

  yPosition = drawFestivalMetaGrid(doc, geo, [
    { label: tx('Escenario', 'Stage'), value: String(data.stage) },
    { label: tx('Fecha', 'Date'), value: headerDate || tx('Sin fecha', 'No date') },
    {
      label: tx('Show', 'Show'),
      value: data.schedule?.show?.start
        ? `${data.schedule.show.start} – ${data.schedule.show.end || '—'}`
        : '—',
    },
    {
      label: tx('Kit de micros', 'Mic kit'),
      value: data.micKit === 'band'
        ? tx('Banda', 'Band')
        : data.micKit === 'mixed'
          ? tx('Mixto', 'Mixed')
          : tx('Festival', 'Festival'),
    },
  ], yPosition);


  yPosition = drawArtistScheduleSection(doc, geo, data.schedule, yPosition, language, templateMode);

  if (templateMode && data.festivalOptions) {
    const checklistRows = buildFestivalOptionChecklistRows(data.festivalOptions, tx, checklist);

    autoTable(doc, {
      head: [[tx("Categoría", "Category"), tx("Opciones disponibles", "Available options"), tx("Disponibilidad", "Availability")]],
      body: checklistRows,
      startY: yPosition,
      showHead: showHeadMode,
      ...festivalTableTheme(geo, { fontSize: 7.4 }),
      margin: tableMargin,
      didDrawPage: () => {
        chrome();
      },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 90 },
        2: { cellWidth: 58 },
      },
    });

    yPosition = getLastAutoTableY(doc, yPosition) + 8;
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
    showHead: showHeadMode,
    ...tableTheme,
    margin: tableMargin,
    didDrawPage: () => {
      chrome();
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 40 }
    },
  });

  yPosition = getLastAutoTableY(doc, yPosition) + 8;

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
    showHead: showHeadMode,
    ...tableTheme,
    margin: tableMargin,
    didDrawPage: () => {
      chrome();
    },
  });

  yPosition = getLastAutoTableY(doc, yPosition) + 8;

  // === MIC KIT DISCLAIMER ===
  if (!templateMode && data.micKit && (data.micKit === 'band' || data.micKit === 'mixed')) {
    if (yPosition + 18 > geo.contentBottom) {
      doc.addPage();
      chrome();
      yPosition = geo.contentTop;
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bolditalic');
    doc.setTextColor(...FESTIVAL_ACCENT);
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
    const disclaimerLines = doc.splitTextToSize(disclaimerText, geo.contentWidth);
    doc.text(disclaimerLines, geo.left, yPosition);
    yPosition += disclaimerLines.length * 5 + 4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...FESTIVAL_INK);
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
      showHead: showHeadMode,
      ...tableTheme,
      margin: tableMargin,
      didDrawPage: () => {
        chrome();
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 55 }
      }
    });

    yPosition = getLastAutoTableY(doc, yPosition) + 8;
  }

  // === RF & WIRELESS ===
  const wirelessRows: Array<Array<string | number>> = [];
  const resolveRowProvider = (systemProvider: unknown, globalProvider: string) => {
    if (systemProvider === "festival" || systemProvider === "band" || systemProvider === "mixed") {
      return providerLabel(systemProvider);
    }
    if (globalProvider === "mixed") {
      return tx("Mixto (sin detalle)", "Mixed (unspecified)");
    }
    return providerLabel(globalProvider || "festival");
  };
  
  if (templateMode) {
    const wirelessOptions = data.festivalOptions?.wirelessSystems || [];
    const iemOptions = data.festivalOptions?.iemSystems || [];

    if (wirelessOptions.length === 0 && iemOptions.length === 0) {
      wirelessRows.push(
        [tx("Canales RF", "RF Channels"), "____", "", "", ""],
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
          formatFrequencyBand(system.band) || "-",
          `${tx("Canales", "Channels")} ${system.quantity_ch || 0} / ${tx("HH", "HH")} ${system.quantity_hh || 0} / ${tx("BP", "BP")} ${system.quantity_bp || 0}`,
        ]);
      });

      iemOptions.forEach((system, index) => {
        wirelessRows.push([
          index === 0 ? tx("Sistemas IEM", "IEM Systems") : "",
          "____",
          `${checklist} ${system.model}`,
          formatFrequencyBand(system.band) || "-",
          `${tx("Canales", "Channels")} ${system.quantity_hh || 0} / ${tx("Petacas", "Bodypacks")} ${system.quantity_bp || 0}`,
        ]);
      });
    }
  } else {
    // Process wireless systems with individual provider information
    if (data.technical.wireless.systems && data.technical.wireless.systems.length > 0) {
      data.technical.wireless.systems.forEach(system => {
        const rowProvider = resolveRowProvider(system.provided_by, data.technical.wireless.providedBy || "festival");
        const channels = Number(system.quantity_ch || 0);
        const handhelds = Number(system.quantity_hh || 0);
        const bodypacks = Number(system.quantity_bp || 0);
        const hasModel = typeof system.model === "string" && system.model.trim().length > 0;
        const formattedBand = formatFrequencyBand(system.band) || '-';

        if (channels > 0) {
          wirelessRows.push([
            tx('Canales RF', 'RF Channels'),
            channels,
            system.model,
            formattedBand,
            rowProvider
          ]);
        }
        
        if (handhelds > 0) {
          wirelessRows.push([
            tx('Mano', 'Handheld'),
            handhelds,
            system.model,
            formattedBand,
            rowProvider
          ]);
        }
        if (bodypacks > 0) {
          wirelessRows.push([
            tx('Petaca', 'Bodypack'),
            bodypacks,
            system.model,
            formattedBand,
            rowProvider
          ]);
        }

        if (channels <= 0 && handhelds <= 0 && bodypacks <= 0 && hasModel) {
          wirelessRows.push([
            tx('Sistema RF', 'Wireless System'),
            0,
            system.model,
            formattedBand,
            rowProvider
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
          formatFrequencyBand(data.technical.wireless.band) || '-',
          providerLabel(data.technical.wireless.providedBy)
        ]);
      }
      if (data.technical.wireless.bodypacks) {
        wirelessRows.push([
          tx('Petaca', 'Bodypack'),
          data.technical.wireless.bodypacks,
          data.technical.wireless.model || '-',
          formatFrequencyBand(data.technical.wireless.band) || '-',
          providerLabel(data.technical.wireless.providedBy)
        ]);
      }
    }

    // Process IEM systems with individual provider information
    if (data.technical.iem.systems && data.technical.iem.systems.length > 0) {
      data.technical.iem.systems.forEach(system => {
        const rowProvider = resolveRowProvider(system.provided_by, data.technical.iem.providedBy || "festival");
        const channels = Number(system.quantity_hh ?? system.quantity ?? 0);
        const bodypacks = Number(system.quantity_bp || 0);
        const hasModel = typeof system.model === "string" && system.model.trim().length > 0;
        const formattedBand = formatFrequencyBand(system.band) || '-';
        
        if (channels > 0) {
          wirelessRows.push([
            tx('Canales IEM', 'IEM Channels'),
            channels,
            system.model,
            formattedBand,
            rowProvider
          ]);
        }
        if (bodypacks > 0) {
          wirelessRows.push([
            tx('Petacas IEM', 'IEM Bodypacks'),
            bodypacks,
            system.model,
            formattedBand,
            rowProvider
          ]);
        }

        if (channels <= 0 && bodypacks <= 0 && hasModel) {
          wirelessRows.push([
            tx('Sistema IEM', 'IEM System'),
            0,
            system.model,
            formattedBand,
            rowProvider
          ]);
        }
      });
    } else if (data.technical.iem.quantity) {
      // Handle legacy format
      wirelessRows.push([
        tx('Sistema IEM', 'IEM System'),
        data.technical.iem.quantity,
        data.technical.iem.model || '-',
        formatFrequencyBand(data.technical.iem.band) || '-',
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
      showHead: showHeadMode,
      ...tableTheme,
      margin: tableMargin,
      didDrawPage: () => {
        chrome();
      },
    });

    yPosition = getLastAutoTableY(doc, yPosition) + 8;
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
      showHead: showHeadMode,
      ...tableTheme,
      margin: tableMargin,
      didDrawPage: () => {
        chrome();
      },
    });

    yPosition = getLastAutoTableY(doc, yPosition) + 8;
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
      showHead: showHeadMode,
      ...tableTheme,
      margin: tableMargin,
      didDrawPage: () => {
        chrome();
      },
    });

    yPosition = getLastAutoTableY(doc, yPosition) + 8;
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
      showHead: showHeadMode,
      ...tableTheme,
      margin: tableMargin,
      didDrawPage: () => {
        chrome();
      },
    });

    yPosition = getLastAutoTableY(doc, yPosition) + 8;
  }

  // === NOTES ===
  if (templateMode || data.notes) {
    yPosition = drawFestivalSectionHeading(doc, geo, tx("Notas", "Notes"), yPosition, 2);

    if (templateMode) {
      const notesBoxHeight = 35;
      doc.setDrawColor(...FESTIVAL_RULE);
      doc.setLineWidth(0.25);
      doc.rect(geo.left, yPosition - 4, geo.contentWidth, notesBoxHeight);
      yPosition += notesBoxHeight + 6;
    } else {
      doc.setFontSize(9);
      doc.setTextColor(...FESTIVAL_INK);
      const splitNotes = doc.splitTextToSize(data.notes, geo.contentWidth);
      doc.text(splitNotes, geo.left, yPosition);
      yPosition += splitNotes.length * 5 + 10;
    }
  }

  if (templateMode) {
    const blockHeight = 42;
    // Manual overflow pages start at the content top, not at the old 20 mm —
    // the running head is painted over that band on every page.
    if (yPosition + blockHeight > geo.contentBottom) {
      doc.addPage();
      chrome();
      yPosition = geo.contentTop;
    }

    doc.setFontSize(10);
    doc.setTextColor(...FESTIVAL_ACCENT);
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
    doc.setTextColor(...FESTIVAL_INK);
    const electronicSuggestion = tx(
      "Sugerencia: usa el enlace público para evitar errores de transcripción en papel.",
      "Suggestion: use the public link to avoid paper transcription errors.",
    );
    const suggestionLines = doc.splitTextToSize(electronicSuggestion, geo.contentWidth);
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

      const fallbackLines = doc.splitTextToSize(fallbackText, geo.contentWidth);
      doc.text(fallbackLines, 14, yPosition);
      yPosition += fallbackLines.length * 4 + 2;
    }
  }

  // The stage plot gets its own landscape page, fitted inside the running head
  // and the footer rather than under them, and captioned because the vertical
  // rail is dropped on landscape sheets.
  if (!templateMode && data.stagePlotUrl) {
    const stagePlotImage = await loadImageWithTimeout(data.stagePlotUrl, "stage plot");
    if (stagePlotImage && stagePlotImage.width > 0 && stagePlotImage.height > 0) {
      try {
        const stagePlotDataUrl = imageToJpegDataUrl(stagePlotImage);
        doc.addPage("a4", "landscape");

        const plotGeo = festivalGeometry(doc);
        const captionHeight = 6 * plotGeo.mm;
        const boxTop = plotGeo.contentTop + captionHeight;
        const boxHeight = plotGeo.contentBottom - boxTop;
        const fitted = fitImageWithin(
          stagePlotImage.width,
          stagePlotImage.height,
          plotGeo.left,
          boxTop,
          plotGeo.contentWidth,
          boxHeight,
        );

        setFestivalMonoText(doc, FESTIVAL_SOFT, 5.6, "bold");
        doc.text(
          `${tx("PLANO DE ESCENARIO", "STAGE PLOT")}  ·  ${data.name.toUpperCase()}`,
          plotGeo.left,
          plotGeo.contentTop,
          { charSpace: 0.2 * plotGeo.mm },
        );

        doc.addImage(stagePlotDataUrl, "JPEG", fitted.x, fitted.y, fitted.width, fitted.height);
        doc.setDrawColor(...FESTIVAL_RULE);
        doc.setLineWidth(0.25 * plotGeo.mm);
        doc.rect(fitted.x, fitted.y, fitted.width, fitted.height);
      } catch (stagePlotError) {
        console.error("Error adding stage plot page to PDF:", stagePlotError);
      }
    } else {
      console.warn(`No se pudo cargar el plano de escenario de ${data.name}; la ficha se emite sin él.`);
    }
  }


  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawFestivalChrome(doc, {
      kind: 'artist',
      kindLabel: tx('Ficha de artista', 'Artist datasheet'),
      eventTitle: data.name,
      contextLabel: [stageLabel, headerDate].filter(Boolean).join('  ·  '),
      issuer: `Sector-Pro  ·  ${data.name}`,
      pageNumber: page,
      totalPages,
      paginate: options.paginate !== false,
    });
  }

  return pdfToBlob(doc);
};
