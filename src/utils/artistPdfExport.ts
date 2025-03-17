import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ArtistTechnicalInfo {
  fohTech: boolean;
  monTech: boolean;
  fohConsole: { model: string; providedBy: string };
  monConsole: { model: string; providedBy: string };
  wireless: {
    model: string;
    providedBy: string;
    handhelds: number;
    bodypacks: number;
    band: string;
  };
  iem: {
    model: string;
    providedBy: string;
    quantity: number;
    band: string;
  };
  monitors: {
    enabled: boolean;
    quantity: number;
  };
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
}

export const exportArtistPDF = (data: ArtistPdfData): Promise<Blob> => {
  return new Promise((resolve) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const createdDate = new Date().toLocaleDateString('en-GB');

    // === HEADER SECTION ===
    doc.setFillColor(125, 1, 1);
    doc.rect(0, 0, pageWidth, 30, 'F');

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
      head: [['Position', 'Required']],
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

    // === RF & WIRELESS ===
    const wirelessRows = [
      ['Handheld', data.technical.wireless.handhelds, data.technical.wireless.model, data.technical.wireless.band, data.technical.wireless.providedBy],
      ['Bodypack', data.technical.wireless.bodypacks, data.technical.wireless.model, data.technical.wireless.band, data.technical.wireless.providedBy],
      ['IEM', data.technical.iem.quantity, data.technical.iem.model, data.technical.iem.band, data.technical.iem.providedBy]
    ].filter(row => Number(row[1]) > 0);

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

    // === CREATED DATE ===
    doc.setFontSize(8);
    doc.setTextColor(51, 51, 51);
    doc.text(`Generated: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
    
    // Compile the PDF without waiting for logo
    const blob = doc.output('blob');
    resolve(blob);
  });
};
