
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { WirelessSystem, IEMSystem } from '@/types/festival-equipment';

// Helper functions for wireless and IEM quantity calculations
export const getWirelessSummary = (data: { 
  systems?: WirelessSystem[]; 
}) => {
  if (data.systems && data.systems.length > 0) {
    return {
      hh: data.systems.reduce((sum: number, system: WirelessSystem) => 
        sum + (system.quantity_hh || 0), 0),
      bp: data.systems.reduce((sum: number, system: WirelessSystem) => 
        sum + (system.quantity_bp || 0), 0)
    };
  }
  return { hh: 0, bp: 0 };
};

export const getIEMSummary = (data: {
  systems?: IEMSystem[];
}) => {
  if (data.systems && data.systems.length > 0) {
    return {
      channels: data.systems.reduce((sum: number, system: IEMSystem) => 
        sum + (system.quantity_hh || 0), 0),
      bodypacks: data.systems.reduce((sum: number, system: IEMSystem) => 
        sum + (system.quantity_bp || 0), 0)
    };
  }
  return { channels: 0, bodypacks: 0 };
};

export interface ArtistTablePdfData {
  jobTitle: string;
  date: string;
  stage?: string;
  stageNames?: Record<number, string>; // Add stage names mapping
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
      wireless: { 
        systems: WirelessSystem[];
        providedBy: string;
      };
      iem: {
        systems: IEMSystem[];
        providedBy: string;
      };
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
    wireless: { 
      systems: WirelessSystem[];
      providedBy: string;
    };
    iem: {
      systems: IEMSystem[];
      providedBy: string;
    };
    monitors: { enabled: boolean; quantity: number };
  };
  extras?: {
    sideFill: boolean;
    drumFill: boolean;
    djBooth: boolean;
  };
  notes?: string;
}

// Helper function to sort schedule rows chronologically by their actual event times
const sortScheduleRowsChronologically = (scheduleRows: ScheduleRow[]) => {
  return scheduleRows.sort((a, b) => {
    // First sort by stage
    if (a.stage !== b.stage) {
      return a.stage - b.stage;
    }

    // Then sort by event start time within the same stage
    const aTime = a.time.start || '';
    const bTime = b.time.start || '';

    // Handle events that cross midnight (early morning events)
    const aHour = aTime ? parseInt(aTime.split(':')[0], 10) : 0;
    const bHour = bTime ? parseInt(bTime.split(':')[0], 10) : 0;

    // If event starts between 00:00-06:59, treat it as next day for sorting
    const adjustedATime = aHour >= 0 && aHour < 7 ? `${aHour + 24}${aTime.substring(aTime.indexOf(':'))}` : aTime;
    const adjustedBTime = bHour >= 0 && bHour < 7 ? `${bHour + 24}${bTime.substring(bTime.indexOf(':'))}` : bTime;
    
    if (adjustedATime < adjustedBTime) return -1;
    if (adjustedATime > adjustedBTime) return 1;

    // If times are equal, soundchecks come before shows
    if (adjustedATime === adjustedBTime) {
      if (a.isSoundcheck && !b.isSoundcheck) return -1;
      if (!a.isSoundcheck && b.isSoundcheck) return 1;
    }

    // Fallback to artist name
    return (a.name || '').localeCompare(b.name || '');
  });
};

// Transform PDF artist data to match the sorting function's expected format
const transformArtistsForSorting = (artists: ArtistTablePdfData['artists'], date: string) => {
  return artists.map((artist, index) => ({
    id: `temp-${index}`, // Temporary ID for sorting
    name: artist.name,
    stage: artist.stage,
    date: date,
    show_start: artist.showTime.start,
    show_end: artist.showTime.end
  }));
};

export const exportArtistTablePDF = (data: ArtistTablePdfData): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const createdDate = format(new Date(), 'dd/MM/yyyy');

      // Helper function to get stage display name
      const getStageDisplayName = (stageNumber: number) => {
        return data.stageNames?.[stageNumber] || `Stage ${stageNumber}`;
      };

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
          const stageDisplayName = data.stageNames?.[parseInt(data.stage)] || `Stage ${data.stage}`;
          doc.text(`${stageDisplayName} - ${format(new Date(data.date), 'dd/MM/yyyy')}`, pageWidth / 2, 18, { align: 'center' });
        } else {
          doc.text(format(new Date(data.date), 'dd/MM/yyyy'), pageWidth / 2, 18, { align: 'center' });
        }

        // Create all schedule events (soundchecks and shows) first
        const scheduleRows: ScheduleRow[] = [];
        
        data.artists.forEach(artist => {
          // Add soundcheck if exists
          if (artist.soundcheck) {
            scheduleRows.push({
              name: artist.name,
              stage: artist.stage,
              time: artist.soundcheck,
              isSoundcheck: true
            });
          }
          
          // Add show
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

        // Sort all events chronologically by their actual event times
        const sortedScheduleRows = sortScheduleRowsChronologically(scheduleRows);

        const tableBody = sortedScheduleRows.map(row => {
          if (row.isSoundcheck) {
            return [
              `${row.name} (Soundcheck)`,
              getStageDisplayName(row.stage),
              `${row.time.start}-${row.time.end}`,
              '', '', '', '', '', ''
            ];
          }
          
          if (!row.technical) return ['', '', '', '', '', '', '', '', ''];
          
          const wirelessSummary = getWirelessSummary(row.technical.wireless);
          const iemSummary = getIEMSummary(row.technical.iem);
          
          // Get provider information from each system if available
          let wirelessProviderInfo = '';
          if (row.technical.wireless.systems && row.technical.wireless.systems.length > 0) {
            const providers = new Set<string>();
            row.technical.wireless.systems.forEach(system => {
              if (system.provided_by) {
                providers.add(system.provided_by);
              } else if (row.technical.wireless.providedBy) {
                providers.add(row.technical.wireless.providedBy);
              }
            });
            wirelessProviderInfo = Array.from(providers).join('/') || row.technical.wireless.providedBy || 'festival';
          } else {
            wirelessProviderInfo = row.technical.wireless.providedBy || 'festival';
          }
          
          let iemProviderInfo = '';
          if (row.technical.iem.systems && row.technical.iem.systems.length > 0) {
            const providers = new Set<string>();
            row.technical.iem.systems.forEach(system => {
              if (system.provided_by) {
                providers.add(system.provided_by);
              } else if (row.technical.iem.providedBy) {
                providers.add(row.technical.iem.providedBy);
              }
            });
            iemProviderInfo = Array.from(providers).join('/') || row.technical.iem.providedBy || 'festival';
          } else {
            iemProviderInfo = row.technical.iem.providedBy || 'festival';
          }
          
          return [
            row.name,
            getStageDisplayName(row.stage),
            `${row.time.start}-${row.time.end}`,
            `FOH: ${row.technical.fohConsole.model}\n(${row.technical.fohConsole.providedBy})\n\nMON: ${row.technical.monConsole.model}\n(${row.technical.monConsole.providedBy})`,
            `FOH: ${row.technical.fohTech ? 'Y' : 'N'}\nMON: ${row.technical.monTech ? 'Y' : 'N'}`,
            `Wireless:\nHH: ${wirelessSummary.hh} (${wirelessProviderInfo})\nBP: ${wirelessSummary.bp}\n\nIEM:\nCH: ${iemSummary.channels}\nBP: ${iemSummary.bodypacks} (${iemProviderInfo})`,
            row.technical.monitors.enabled ? `Monitors: ${row.technical.monitors.quantity}` : '-',
            [
              row.extras.sideFill ? 'SF' : '',
              row.extras.drumFill ? 'DF' : '',
              row.extras.djBooth ? 'DJ' : ''
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
            textColor: [0, 0, 0],
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
            4: { cellWidth: 20, cellPadding: 4 },
            5: { cellWidth: 35, cellPadding: 4 },
            6: { cellWidth: 20 },
            7: { cellWidth: 20 },
            8: { cellWidth: 'auto' }
          },
          didParseCell: function(data) {
            if (data.row.index === -1) return;
            const rowData = sortedScheduleRows[data.row.index];
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
