import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { compareChronologically } from './timeUtils';

export interface ArtistTablePdfData {
  jobTitle: string;
  date: string;
  dateType?: string;
  stage: string;
  artists: Array<{
    name: string;
    stage: number;
    showTime: { start: string; end: string };
    soundcheck?: { start: string; end: string };
    technical: {
      fohTech: boolean;
      monTech: boolean;
      fohConsole: { model: string; providedBy: string };
      monConsole: { model: string; providedBy: string };
      wireless: {
        systems: Array<{
          model: string;
          quantity_hh: number;
          quantity_bp: number;
          band: string;
        }>;
        providedBy: string;
      };
      iem: {
        systems: Array<{
          model: string;
          quantity_hh: number;
          quantity_bp: number;
          quantity: number;
          band: string;
        }>;
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
    notes: string;
  }>;
  logoUrl?: string;
}

const pageWidth = 297; // A4 landscape
const pageHeight = 210;

const addTableHeader = (doc: jsPDF, currentY: number): number => {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setFillColor(220, 220, 220);
  doc.setTextColor(0);

  const headers = [
    { header: 'Time', width: 20 },
    { header: 'Type', width: 20 },
    { header: 'Artist', width: 40 },
    { header: 'FOH Console', width: 40 },
    { header: 'MON Console', width: 40 },
    { header: 'Wireless', width: 30 },
    { header: 'IEM', width: 30 },
    { header: 'Monitors', width: 20 },
    { header: 'Extras', width: 30 },
  ];

  let startX = 10;
  headers.forEach(header => {
    doc.rect(startX, currentY, header.width, 10, 'F');
    doc.text(header.header, startX + header.width / 2, currentY + 7, { align: 'center' });
    startX += header.width;
  });

  return currentY + 10;
};

export const exportArtistTablePDF = async (data: ArtistTablePdfData): Promise<Blob> => {
  const doc = new jsPDF('landscape');
  let currentY = 10;

  // Add logo if available
  if (data.logoUrl) {
    try {
      const img = new Image();
      img.src = data.logoUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      const logoWidth = 30;
      const logoHeight = (img.height / img.width) * logoWidth;
      doc.addImage(img.src, 'PNG', 10, currentY, logoWidth, logoHeight);
      currentY += logoHeight + 5;
    } catch (error) {
      console.error('Error adding logo:', error);
    }
  }

  // Enhanced title with date type
  const dateTypeText = data.dateType ? ` (${data.dateType.charAt(0).toUpperCase() + data.dateType.slice(1)} Day)` : '';
  const mainTitle = `Artist Schedule - ${data.stage} - ${format(new Date(data.date), 'EEEE, MMMM d, yyyy')}${dateTypeText}`;
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(mainTitle, pageWidth / 2, currentY, { align: 'center' });
  currentY += 15;
  
  // Create schedule rows for both soundcheck and show times, then sort chronologically
  const scheduleRows: any[] = [];
  
  data.artists.forEach(artist => {
    // Add soundcheck row if exists
    if (artist.soundcheck && artist.soundcheck.start) {
      scheduleRows.push({
        time: artist.soundcheck.start,
        timeEnd: artist.soundcheck.end,
        type: 'Soundcheck',
        artist: artist.name,
        fohConsole: `${artist.technical.fohConsole.model} (${artist.technical.fohConsole.providedBy})`,
        monConsole: `${artist.technical.monConsole.model} (${artist.technical.monConsole.providedBy})`,
        wireless: artist.technical.wireless.systems.map(s => `${s.model} (${s.quantity_hh + s.quantity_bp})`).join(', '),
        iem: artist.technical.iem.systems.map(s => `${s.model} (${s.quantity})`).join(', '),
        monitors: artist.technical.monitors.enabled ? artist.technical.monitors.quantity : 'No',
        extras: [
          artist.extras.sideFill ? 'SF' : null,
          artist.extras.drumFill ? 'DF' : null,
          artist.extras.djBooth ? 'DJ' : null
        ].filter(Boolean).join(', ')
      });
    }
    
    // Add show row
    scheduleRows.push({
      time: artist.showTime.start,
      timeEnd: artist.showTime.end,
      type: 'Show',
      artist: artist.name,
      fohConsole: `${artist.technical.fohConsole.model} (${artist.technical.fohConsole.providedBy})`,
      monConsole: `${artist.technical.monConsole.model} (${artist.technical.monConsole.providedBy})`,
      wireless: artist.technical.wireless.systems.map(s => `${s.model} (${s.quantity_hh + s.quantity_bp})`).join(', '),
      iem: artist.technical.iem.systems.map(s => `${s.model} (${s.quantity})`).join(', '),
      monitors: artist.technical.monitors.enabled ? artist.technical.monitors.quantity : 'No',
      extras: [
        artist.extras.sideFill ? 'SF' : null,
        artist.extras.drumFill ? 'DF' : null,
        artist.extras.djBooth ? 'DJ' : null
      ].filter(Boolean).join(', ')
    });
  });
  
  // Sort chronologically using the shared utility
  scheduleRows.sort((a, b) => compareChronologically(
    { date: data.date, time: a.time },
    { date: data.date, time: b.time }
  ));
  
  // Add table headers
  currentY = addTableHeader(doc, currentY);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);

  scheduleRows.forEach(row => {
    let startX = 10;
    const rowHeight = 10;

    doc.text(row.time, startX + 10, currentY + 7, { align: 'center' });
    startX += 20;
    doc.text(row.type, startX + 10, currentY + 7, { align: 'center' });
    startX += 20;
    doc.text(row.artist, startX + 20, currentY + 7, { align: 'center' });
    startX += 40;
    doc.text(row.fohConsole, startX + 20, currentY + 7, { align: 'center' });
    startX += 40;
    doc.text(row.monConsole, startX + 20, currentY + 7, { align: 'center' });
    startX += 40;
    doc.text(row.wireless, startX + 15, currentY + 7, { align: 'center' });
    startX += 30;
    doc.text(row.iem, startX + 15, currentY + 7, { align: 'center' });
    startX += 30;
    doc.text(String(row.monitors), startX + 10, currentY + 7, { align: 'center' });
    startX += 20;
    doc.text(row.extras, startX + 15, currentY + 7, { align: 'center' });

    currentY += rowHeight;

    if (currentY > pageHeight - 20) {
      doc.addPage('landscape');
      currentY = 10;
      if (data.logoUrl) {
        try {
          const img = new Image();
          img.src = data.logoUrl;
          img.onload = () => {
            const logoWidth = 30;
            const logoHeight = (img.height / img.width) * logoWidth;
            doc.addImage(img.src, 'PNG', 10, 10, logoWidth, logoHeight);
          };
          img.onerror = (error) => {
            console.error('Error adding logo:', error);
          };
        } catch (error) {
          console.error('Error adding logo:', error);
        }
      }
      currentY = addTableHeader(doc, currentY);
    }
  });
  
  return new Blob([doc.output('blob')], { type: 'application/pdf' });
};
