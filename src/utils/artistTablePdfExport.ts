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
  logoUrl?: string;
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
      const doc = new jsPDF({ orientation: 'landscape' });
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const createdDate = format(new Date(), 'dd/MM/yyyy');

      doc.setFillColor(125, 1, 1);
      doc.rect(0, 0, pageWidth, 20, 'F');

      const loadLogoPromise = data.logoUrl 
        ? new Promise<void>((resolveLogoLoad) => {
            console.log("Attempting to load logo from URL:", data.logoUrl);
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
              try {
                console.log("Logo loaded successfully, dimensions:", img.width, "x", img.height);
                const maxHeight = 18;
                const ratio = img.width / img.height;
                const logoHeight = Math.min(maxHeight, img.height);
                const logoWidth = logoHeight * ratio;
                
                doc.addImage(
                  img, 
                  'JPEG', 
                  5, 
                  1,
                  logoWidth,
                  logoHeight
                );
                resolveLogoLoad();
              } catch (err) {
                console.error('Error adding logo to PDF:', err);
                resolveLogoLoad();
              }
            };
            img.onerror = (e) => {
              console.error('Error loading logo image:', e);
              resolveLogoLoad();
            };
            img.src = data.logoUrl;
          })
        : Promise.resolve();

      loadLogoPromise.then(() => {
        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.text(`${data.jobTitle} - Artist Schedule`, pageWidth / 2, 12, { align: 'center' });
        
        if (data.stage) {
          doc.text(`Stage ${data.stage} - ${format(new Date(data.date), 'dd/MM/yyyy')}`, pageWidth / 2, 18, { align: 'center' });
        } else {
          doc.text(format(new Date(data.date), 'dd/MM/yyyy'), pageWidth / 2, 18, { align: 'center' });
        }

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
            `FOH: ${row.technical!.fohConsole.model}\n(${row.technical!.fohConsole.providedBy})\n\nMON: ${row.technical!.monConsole.model}\n(${row.technical!.monConsole.providedBy})`,
            `FOH Tech: ${row.technical!.fohTech ? '✓' : '✗'}\n\nMON Tech: ${row.technical!.monTech ? '✓' : '✗'}`,
            `HH: ${row.technical!.wireless.hh} (${row.technical!.wireless.providedBy})\nBP: ${row.technical!.wireless.bp}\n\nIEM: ${row.technical!.iem.quantity} (${row.technical!.iem.providedBy})`,
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
            cellPadding: 3,
            overflow: 'linebreak',
            lineWidth: 0.1,
            valign: 'middle'
          },
          headStyles: {
            fillColor: [125, 1, 1],
            textColor: [255, 255, 255],
            fontSize: 8,
            fontStyle: 'bold',
            halign: 'left',
            cellPadding: 4
          },
          columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 15 },
            2: { cellWidth: 25 },
            3: { cellWidth: 35, cellPadding: 4 },
            4: { cellWidth: 30, cellPadding: 4 },
            5: { cellWidth: 30, cellPadding: 4 },
            6: { cellWidth: 20 },
            7: { cellWidth: 20 },
            8: { cellWidth: 'auto' }
          },
          didParseCell: function(data) {
            if (data.row.index === -1) return;
            const rowData = scheduleRows[data.row.index];
            if (rowData.isSoundcheck) {
              data.cell.styles.fillColor = [254, 247, 205];
            }
          }
        });

        try {
          const sectorLogoPath = '/sector pro logo.png';
          console.log("Attempting to add Sector Pro logo from:", sectorLogoPath);
          
          const sectorImg = new Image();
          sectorImg.onload = () => {
            try {
              const logoWidth = 30;
              const ratio = sectorImg.width / sectorImg.height;
              const logoHeight = logoWidth / ratio;
              
              doc.addImage(
                sectorImg, 
                'PNG', 
                pageWidth/2 - logoWidth/2,
                pageHeight - logoHeight - 10,
                logoWidth,
                logoHeight
              );
              
              doc.setFontSize(8);
              doc.setTextColor(51, 51, 51);
              doc.text(`Generated: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
              
              const blob = doc.output('blob');
              resolve(blob);
            } catch (err) {
              console.error('Error adding Sector Pro logo to PDF:', err);
              doc.setFontSize(8);
              doc.setTextColor(51, 51, 51);
              doc.text(`Generated: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
              const blob = doc.output('blob');
              resolve(blob);
            }
          };
          
          sectorImg.onerror = () => {
            console.error('Failed to load Sector Pro logo');
            doc.setFontSize(8);
            doc.setTextColor(51, 51, 51);
            doc.text(`Generated: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
            const blob = doc.output('blob');
            resolve(blob);
          };
          
          sectorImg.src = sectorLogoPath;
        } catch (logoErr) {
          console.error('Error trying to add Sector Pro logo:', logoErr);
          doc.setFontSize(8);
          doc.setTextColor(51, 51, 51);
          doc.text(`Generated: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
          const blob = doc.output('blob');
          resolve(blob);
        }
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
