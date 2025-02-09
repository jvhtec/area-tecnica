
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

interface ScheduleRow {
  name: string;
  stage: number;
  time: { start: string; end: string };
  isSoundcheck: boolean;
  technical?: {
    fohTech: boolean;
    monTech: boolean;
    fohConsole: { model: string; providedBy: string };
    monConsole: { model: string; providedBy: string };
    wireless: { hh: number; bp: number; providedBy: string };
    iem: { quantity: number; providedBy: string };
    monitors: { enabled: boolean; quantity: number };
  };
  extras?: {
    sideFill: boolean;
    drumFill: boolean;
    djBooth: boolean;
  };
  notes?: string;
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

    // Process artists into schedule rows with soundchecks
    const scheduleRows: ScheduleRow[] = [];
    
    data.artists.forEach(artist => {
      // Add soundcheck row if it exists (comes first chronologically)
      if (artist.soundcheck) {
        scheduleRows.push({
          name: artist.name,
          stage: artist.stage,
          time: artist.soundcheck,
          isSoundcheck: true
        });
      }
      
      // Add show row
      scheduleRows.push({
        name: artist.name,
        stage: artist.stage,
        time: artist.showTime,
        isSoundcheck: false,
        technical: artist.technical,
        extras: artist.extras,
        notes: artist.notes
      });
    });

    // Sort all rows chronologically by start time
    scheduleRows.sort((a, b) => {
      const timeA = new Date(`2000/01/01 ${a.time.start}`).getTime();
      const timeB = new Date(`2000/01/01 ${b.time.start}`).getTime();
      return timeA - timeB;
    });

    // Prepare table data
    const tableBody = scheduleRows.map(row => {
      if (row.isSoundcheck) {
        return [
          `${row.name} (Soundcheck)`,
          `Stage ${row.stage}`,
          `${row.time.start}-${row.time.end}`,
          '', '', '', '', '', ''  // Empty cells for other columns
        ];
      }
      
      return [
        row.name,
        `Stage ${row.stage}`,
        `${row.time.start}-${row.time.end}`,
        `FOH: ${row.technical!.fohConsole.model} (${row.technical!.fohConsole.providedBy})\nMON: ${row.technical!.monConsole.model} (${row.technical!.monConsole.providedBy})`,
        `FOH Tech: ${row.technical!.fohTech ? '✓' : '-'}\nMON Tech: ${row.technical!.monTech ? '✓' : '-'}`,
        `HH: ${row.technical!.wireless.hh} (${row.technical!.wireless.providedBy})\nBP: ${row.technical!.wireless.bp}\nIEM: ${row.technical!.iem.quantity} (${row.technical!.iem.providedBy})`,
        row.technical!.monitors.enabled ? `Monitors: ${row.technical!.monitors.quantity}` : '-',
        [
          row.extras!.sideFill ? 'SF' : '',
          row.extras!.drumFill ? 'DF' : '',
          row.extras!.djBooth ? 'DJ' : ''
        ].filter(Boolean).join(', ') || '-',
        row.notes || '-'
      ];
    });

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
        fillColor: [125/255, 1/255, 1/255],  // Corporate red normalized to 0-1 range
        textColor: [1, 1, 1],  // White in normalized RGB
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'left',
        cellPadding: 4
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 15 },
        2: { cellWidth: 25 },
        3: { cellWidth: 40 },
        4: { cellWidth: 20 },
        5: { cellWidth: 35 },
        6: { cellWidth: 20 },
        7: { cellWidth: 20 },
        8: { cellWidth: 'auto' },
      },
      didParseCell: function(data) {
        if (data.row.index === -1) return; // Skip header row
        const rowData = scheduleRows[data.row.index];
        if (rowData.isSoundcheck) {
          data.cell.styles.fillColor = [254/255, 247/255, 205/255]; // Normalized yellow for soundcheck rows
        }
      }
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

