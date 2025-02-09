
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export interface ArtistTablePdfData {
  jobTitle: string;
  date: string;
  stage?: string;
  artists: {
    name: string;
    stage: number;
    showTime: { start: string; end: string };
    soundcheck?: { start: string; end: string };
    technical: {
      fohTech: boolean;
      monTech: boolean;
      fohConsole: { model: string; providedBy: string };
      monConsole: { model: string; providedBy: string };
      wireless: { hh: number; bp: number; providedBy: string };
      iem: { quantity: number; providedBy: string };
      monitors: { enabled: boolean; quantity: number };
    };
    extras: {
      sideFill: boolean;
      drumFill: boolean;
      djBooth: boolean;
    };
    notes?: string;
  }[];
}

export const exportArtistTablePDF = (data: ArtistTablePdfData): Promise<Blob> => {
  return new Promise((resolve) => {
    // Create PDF in landscape
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const createdDate = format(new Date(), 'dd/MM/yyyy');

    // Header
    doc.setFillColor(125, 1, 1);
    doc.rect(0, 0, pageWidth, 20, 'F');

    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(`${data.jobTitle} - Artist Schedule`, pageWidth / 2, 12, { align: 'center' });
    
    if (data.stage) {
      doc.text(`Stage ${data.stage} - ${format(new Date(data.date), 'dd/MM/yyyy')}`, pageWidth / 2, 18, { align: 'center' });
    } else {
      doc.text(format(new Date(data.date), 'dd/MM/yyyy'), pageWidth / 2, 18, { align: 'center' });
    }

    // Prepare table data
    const tableBody = data.artists.map(artist => [
      artist.name,
      `Stage ${artist.stage}`,
      `${artist.showTime.start}-${artist.showTime.end}${artist.soundcheck ? `\nSC: ${artist.soundcheck.start}-${artist.soundcheck.end}` : ''}`,
      `FOH: ${artist.technical.fohConsole.model} (${artist.technical.fohConsole.providedBy})\nMON: ${artist.technical.monConsole.model} (${artist.technical.monConsole.providedBy})`,
      `FOH Tech: ${artist.technical.fohTech ? '✓' : '-'}\nMON Tech: ${artist.technical.monTech ? '✓' : '-'}`,
      `HH: ${artist.technical.wireless.hh} (${artist.technical.wireless.providedBy})\nBP: ${artist.technical.wireless.bp}\nIEM: ${artist.technical.iem.quantity} (${artist.technical.iem.providedBy})`,
      artist.technical.monitors.enabled ? `Monitors: ${artist.technical.monitors.quantity}` : '-',
      [
        artist.extras.sideFill ? 'SF' : '',
        artist.extras.drumFill ? 'DF' : '',
        artist.extras.djBooth ? 'DJ' : ''
      ].filter(Boolean).join(', ') || '-',
      artist.notes || '-'
    ]);

    // Generate table
    autoTable(doc, {
      startY: 25,
      head: [['Artist', 'Stage', 'Time', 'Consoles', 'Tech', 'RF/IEM', 'Monitors', 'Extras', 'Notes']],
      body: tableBody,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak',
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 15 },
        2: { cellWidth: 25 },
        3: { cellWidth: 40 },
        4: { cellWidth: 20 },
        5: { cellWidth: 35 },
        6: { cellWidth: 20 },
        7: { cellWidth: 20 },
        8: { cellWidth: 'auto' },
      },
    });

    // Add logo and generation info at the bottom
    const logo = new Image();
    logo.crossOrigin = 'anonymous';
    logo.src = '/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png';
    logo.onload = () => {
      const logoWidth = 30;
      const logoHeight = logoWidth * (logo.height / logo.width);
      const xPosition = (pageWidth - logoWidth) / 2;
      const yLogo = pageHeight - 15;
      try {
        doc.addImage(logo, 'PNG', xPosition, yLogo - logoHeight, logoWidth, logoHeight);
      } catch (error) {
        console.error('Error adding logo:', error);
      }
      doc.setFontSize(8);
      doc.setTextColor(51, 51, 51);
      doc.text(`Generated: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
      const blob = doc.output('blob');
      resolve(blob);
    };

    logo.onerror = () => {
      console.error('Failed to load logo');
      doc.setFontSize(8);
      doc.setTextColor(51, 51, 51);
      doc.text(`Generated: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
      const blob = doc.output('blob');
      resolve(blob);
    };
  });
};
