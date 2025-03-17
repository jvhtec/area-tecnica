
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
  logoUrl?: string; // Add logo URL option
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
  return new Promise((resolve, reject) => {
    try {
      // Create PDF in landscape
      const doc = new jsPDF({ orientation: 'landscape' });
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const createdDate = format(new Date(), 'dd/MM/yyyy');

      // Header
      doc.setFillColor(125, 1, 1);  // Corporate red
      doc.rect(0, 0, pageWidth, 20, 'F');
      
      // Logo loading promise
      const loadLogoPromise = data.logoUrl 
        ? new Promise<void>((resolveLogoLoad) => {
            console.log("Attempting to load logo from URL:", data.logoUrl);
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
              try {
                console.log("Logo loaded successfully, dimensions:", img.width, "x", img.height);
                // Calculate logo dimensions (max height 18px in header)
                const maxHeight = 18;
                const ratio = img.width / img.height;
                const logoHeight = Math.min(maxHeight, img.height);
                const logoWidth = logoHeight * ratio;
                
                // Add logo to top left corner
                doc.addImage(
                  img, 
                  'JPEG', 
                  5, // X position (left margin)
                  1, // Y position (top margin)
                  logoWidth,
                  logoHeight
                );
                resolveLogoLoad();
              } catch (err) {
                console.error('Error adding logo to PDF:', err);
                resolveLogoLoad(); // Resolve anyway to continue PDF generation
              }
            };
            img.onerror = (e) => {
              console.error('Error loading logo image:', e);
              resolveLogoLoad(); // Resolve anyway to continue PDF generation
            };
            img.src = data.logoUrl;
          })
        : Promise.resolve();

      loadLogoPromise.then(() => {
        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);  // White
        doc.text(`${data.jobTitle} - Artist Schedule`, pageWidth / 2, 12, { align: 'center' });
        
        if (data.stage) {
          doc.text(`Stage ${data.stage} - ${format(new Date(data.date), 'dd/MM/yyyy')}`, pageWidth / 2, 18, { align: 'center' });
        } else {
          doc.text(format(new Date(data.date), 'dd/MM/yyyy'), pageWidth / 2, 18, { align: 'center' });
        }

        // Process artists into schedule rows with soundchecks
        const scheduleRows: ScheduleRow[] = [];
        
        data.artists.forEach(artist => {
          if (artist.soundcheck) {
            scheduleRows.push({
              name: artist.name,
              stage: artist.stage,
              time: artist.soundcheck,
              isSoundcheck: true
            });
          }
          
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

        scheduleRows.sort((a, b) => {
          const timeA = new Date(`2000/01/01 ${a.time.start}`).getTime();
          const timeB = new Date(`2000/01/01 ${b.time.start}`).getTime();
          return timeA - timeB;
        });

        const tableBody = scheduleRows.map(row => {
          if (row.isSoundcheck) {
            return [
              `${row.name} (Soundcheck)`,
              `Stage ${row.stage}`,
              `${row.time.start}-${row.time.end}`,
              '', '', '', '', '', ''
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
            fillColor: [125, 1, 1],  // Fixed: Using RGB values directly for corporate red
            textColor: [255, 255, 255],  // Fixed: Using RGB values directly for white
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
            if (data.row.index === -1) return;
            const rowData = scheduleRows[data.row.index];
            if (rowData.isSoundcheck) {
              data.cell.styles.fillColor = [0xFE/255, 0xF7/255, 0xCD/255];  // Light yellow
            }
          }
        });

        // Add footer with date
        doc.setFontSize(8);
        doc.setTextColor(51, 51, 51);
        doc.text(`Generated: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
        
        // Resolve with the PDF blob
        const blob = doc.output('blob');
        resolve(blob);
      }).catch(err => {
        console.error("Error in PDF generation:", err);
        reject(err);
      });
    } catch (error) {
      console.error("Exception in PDF export:", error);
      reject(error);
    }
  });
};
