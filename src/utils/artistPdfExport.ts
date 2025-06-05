
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export interface ArtistPdfData {
  name: string;
  stage: number;
  date: string;
  riderMissing?: boolean;
  schedule: {
    show: {
      start: string;
      end: string;
    };
    soundcheck?: {
      start: string;
      end: string;
    };
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
      model?: string;
      handhelds?: number;
      bodypacks?: number;
      band?: string;
    };
    iem: {
      systems: any[];
      providedBy: string;
      model?: string;
      quantity?: number;
      band?: string;
    };
    monitors: {
      enabled: boolean;
      quantity: number;
    };
  };
  infrastructure: {
    providedBy: string;
    cat6: {
      enabled: boolean;
      quantity: number;
    };
    hma: {
      enabled: boolean;
      quantity: number;
    };
    coax: {
      enabled: boolean;
      quantity: number;
    };
    opticalconDuo: {
      enabled: boolean;
      quantity: number;
    };
    analog: number;
    other: string;
  };
  extras: {
    sideFill: boolean;
    drumFill: boolean;
    djBooth: boolean;
    wired: string;
  };
  notes?: string;
}

export const exportArtistPDF = async (artistData: ArtistPdfData): Promise<Blob> => {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Technical Requirements', 20, 30);

  // Artist info
  doc.setFontSize(16);
  doc.text(`${artistData.name} - Stage ${artistData.stage}`, 20, 45);
  doc.setFontSize(12);
  doc.text(`Date: ${artistData.date}`, 20, 55);

  // Rider Missing Warning
  if (artistData.riderMissing) {
    doc.setTextColor(255, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('⚠️ RIDER MISSING - TECHNICAL REQUIREMENTS MAY BE INCOMPLETE', 20, 70);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
  }

  let yPosition = artistData.riderMissing ? 85 : 70;

  // Schedule section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Schedule', 20, yPosition);
  yPosition += 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Show: ${artistData.schedule.show.start} - ${artistData.schedule.show.end}`, 20, yPosition);
  yPosition += 8;

  if (artistData.schedule.soundcheck) {
    doc.text(`Soundcheck: ${artistData.schedule.soundcheck.start} - ${artistData.schedule.soundcheck.end}`, 20, yPosition);
    yPosition += 8;
  }

  yPosition += 10;

  // Technical Requirements section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Technical Requirements', 20, yPosition);
  yPosition += 15;

  // Create table data
  const tableData = [];

  // Console information
  if (artistData.technical.fohConsole.model) {
    tableData.push(['FOH Console', artistData.technical.fohConsole.model, `Provided by: ${artistData.technical.fohConsole.providedBy}`]);
  }
  if (artistData.technical.monConsole.model) {
    tableData.push(['Monitor Console', artistData.technical.monConsole.model, `Provided by: ${artistData.technical.monConsole.providedBy}`]);
  }

  // Technician requirements
  if (artistData.technical.fohTech) {
    tableData.push(['FOH Technician', 'Required', '']);
  }
  if (artistData.technical.monTech) {
    tableData.push(['Monitor Technician', 'Required', '']);
  }

  // Wireless systems
  if (artistData.technical.wireless.systems.length > 0) {
    artistData.technical.wireless.systems.forEach(system => {
      const details = [];
      if (system.quantity_hh) details.push(`HH: ${system.quantity_hh}`);
      if (system.quantity_bp) details.push(`BP: ${system.quantity_bp}`);
      if (system.band) details.push(`Band: ${system.band}`);
      
      tableData.push([
        'Wireless',
        system.model || 'Not specified',
        details.join(', ') + (system.provided_by ? ` (${system.provided_by})` : '')
      ]);
    });
  }

  // IEM systems
  if (artistData.technical.iem.systems.length > 0) {
    artistData.technical.iem.systems.forEach(system => {
      const details = [];
      if (system.quantity_hh) details.push(`CH: ${system.quantity_hh}`);
      if (system.quantity_bp) details.push(`BP: ${system.quantity_bp}`);
      if (system.band) details.push(`Band: ${system.band}`);
      
      tableData.push([
        'IEM',
        system.model || 'Not specified',
        details.join(', ') + (system.provided_by ? ` (${system.provided_by})` : '')
      ]);
    });
  }

  // Monitors
  if (artistData.technical.monitors.enabled) {
    tableData.push(['Stage Monitors', `${artistData.technical.monitors.quantity} units`, '']);
  }

  // Infrastructure
  if (artistData.infrastructure.cat6.enabled) {
    tableData.push(['CAT6 Lines', `${artistData.infrastructure.cat6.quantity}`, `Provided by: ${artistData.infrastructure.providedBy}`]);
  }
  if (artistData.infrastructure.hma.enabled) {
    tableData.push(['HMA Lines', `${artistData.infrastructure.hma.quantity}`, `Provided by: ${artistData.infrastructure.providedBy}`]);
  }
  if (artistData.infrastructure.coax.enabled) {
    tableData.push(['Coax Lines', `${artistData.infrastructure.coax.quantity}`, `Provided by: ${artistData.infrastructure.providedBy}`]);
  }
  if (artistData.infrastructure.opticalconDuo.enabled) {
    tableData.push(['OpticalCON DUO', `${artistData.infrastructure.opticalconDuo.quantity}`, `Provided by: ${artistData.infrastructure.providedBy}`]);
  }
  if (artistData.infrastructure.analog > 0) {
    tableData.push(['Analog Lines', `${artistData.infrastructure.analog}`, `Provided by: ${artistData.infrastructure.providedBy}`]);
  }

  // Extra requirements
  if (artistData.extras.sideFill) {
    tableData.push(['Side Fill', 'Required', '']);
  }
  if (artistData.extras.drumFill) {
    tableData.push(['Drum Fill', 'Required', '']);
  }
  if (artistData.extras.djBooth) {
    tableData.push(['DJ Booth', 'Required', '']);
  }
  if (artistData.extras.wired) {
    tableData.push(['Additional Wired', artistData.extras.wired, '']);
  }
  if (artistData.infrastructure.other) {
    tableData.push(['Other Infrastructure', artistData.infrastructure.other, '']);
  }

  // Generate table
  if (tableData.length > 0) {
    (doc as any).autoTable({
      head: [['Category', 'Specification', 'Notes']],
      body: tableData,
      startY: yPosition,
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [64, 64, 64],
        textColor: 255,
        fontSize: 11,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      margin: { left: 20, right: 20 },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // Notes section
  if (artistData.notes) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 30;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Additional Notes', 20, yPosition);
    yPosition += 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const splitText = doc.splitTextToSize(artistData.notes, 170);
    doc.text(splitText, 20, yPosition);
  }

  // Add rider missing warning at bottom if applicable
  if (artistData.riderMissing) {
    const pageHeight = doc.internal.pageSize.height;
    doc.setTextColor(255, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('WARNING: This document may be incomplete due to missing rider information.', 20, pageHeight - 20);
    doc.setTextColor(0, 0, 0);
  }

  return doc.output('blob');
};
