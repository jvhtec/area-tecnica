
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export interface ArtistTablePdfData {
  eventName: string;
  eventDate: string;
  artists: Array<{
    name: string;
    stage: number;
    showTime: string;
    soundcheck?: string;
    riderMissing?: boolean;
    technical: {
      fohConsole: string;
      monConsole: string;
      fohTech: boolean;
      monTech: boolean;
    };
    wireless: {
      handhelds: number;
      bodypacks: number;
    };
    iem: {
      channels: number;
      bodypacks: number;
    };
    monitors: number;
    notes?: string;
  }>;
}

export const exportArtistTablePDF = async (data: ArtistTablePdfData): Promise<Blob> => {
  const doc = new jsPDF('landscape');

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`Artist Technical Requirements - ${data.eventName}`, 20, 25);
  doc.setFontSize(12);
  doc.text(`Date: ${data.eventDate}`, 20, 35);

  // Check if any artists have missing riders
  const artistsWithMissingRiders = data.artists.filter(artist => artist.riderMissing);
  if (artistsWithMissingRiders.length > 0) {
    doc.setTextColor(255, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`⚠️ WARNING: ${artistsWithMissingRiders.length} artist(s) have missing riders`, 20, 45);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
  }

  let startY = artistsWithMissingRiders.length > 0 ? 55 : 45;

  // Prepare table data
  const tableData = data.artists.map(artist => [
    artist.riderMissing ? `⚠️ ${artist.name}` : artist.name,
    artist.stage.toString(),
    artist.showTime,
    artist.soundcheck || 'No',
    artist.technical.fohConsole || 'N/A',
    artist.technical.monConsole || 'N/A',
    artist.technical.fohTech ? 'Yes' : 'No',
    artist.technical.monTech ? 'Yes' : 'No',
    `HH:${artist.wireless.handhelds} BP:${artist.wireless.bodypacks}`,
    `CH:${artist.iem.channels} BP:${artist.iem.bodypacks}`,
    artist.monitors.toString(),
    artist.notes ? artist.notes.substring(0, 50) + (artist.notes.length > 50 ? '...' : '') : ''
  ]);

  // Generate table
  (doc as any).autoTable({
    head: [[
      'Artist/Band',
      'Stage',
      'Show Time',
      'Soundcheck',
      'FOH Console',
      'MON Console',
      'FOH Tech',
      'MON Tech',
      'Wireless',
      'IEM',
      'Monitors',
      'Notes'
    ]],
    body: tableData,
    startY: startY,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [64, 64, 64],
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { left: 15, right: 15 },
    columnStyles: {
      0: { cellWidth: 35 }, // Artist name
      1: { cellWidth: 15 }, // Stage
      2: { cellWidth: 25 }, // Show time
      3: { cellWidth: 20 }, // Soundcheck
      4: { cellWidth: 25 }, // FOH Console
      5: { cellWidth: 25 }, // MON Console
      6: { cellWidth: 15 }, // FOH Tech
      7: { cellWidth: 15 }, // MON Tech
      8: { cellWidth: 25 }, // Wireless
      9: { cellWidth: 25 }, // IEM
      10: { cellWidth: 15 }, // Monitors
      11: { cellWidth: 40 }, // Notes
    },
    didParseCell: function(data: any) {
      // Highlight rows with missing riders
      if (data.row.index >= 0) {
        const artist = data.artists?.[data.row.index];
        if (artist?.riderMissing && data.cell.text[0]?.startsWith('⚠️')) {
          data.cell.styles.textColor = [255, 0, 0];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    }
  });

  // Add legend for warnings
  if (artistsWithMissingRiders.length > 0) {
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(10);
    doc.setTextColor(255, 0, 0);
    doc.text('⚠️ = Missing Rider/Technical Requirements', 20, finalY);
    doc.setTextColor(0, 0, 0);
  }

  return doc.output('blob');
};
