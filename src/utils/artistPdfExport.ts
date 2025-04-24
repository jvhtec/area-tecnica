import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { WirelessSystem, IEMSystem } from '@/types/festival-equipment';

export interface ArtistTechnicalInfo {
  fohTech: boolean;
  monTech: boolean;
  fohConsole: { model: string; providedBy: string };
  monConsole: { model: string; providedBy: string };
  wireless: {
    systems?: WirelessSystem[];
    model?: string;
    providedBy: string;
    handhelds?: number;
    bodypacks?: number;
    band?: string;
    hh?: number;
    bp?: number;
  };
  iem: {
    systems?: IEMSystem[];
    model?: string;
    providedBy: string;
    quantity?: number;
    band?: string;
  };
  monitors: {
    enabled: boolean;
    quantity: number;
  };
}

// Local interfaces for internal PDF generation use
interface WirelessSystemDetail {
  quantity_hh?: number;
  quantity_bp?: number;
  model: string;
  band?: string;
}

interface IEMSystemDetail {
  quantity: number;
  model: string;
  band?: string;
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
  logoUrl?: string;
}

// Helper functions to process wireless and IEM data
const getWirelessSummary = (systems: WirelessSystem[] = []) => {
  const totalHH = systems.reduce((sum, system) => sum + (system.quantity_hh || 0), 0);
  const totalBP = systems.reduce((sum, system) => sum + (system.quantity_bp || 0), 0);
  return { hh: totalHH, bp: totalBP };
};

const getIEMSummary = (systems: IEMSystem[] = []) => {
  const totalChannels = systems.reduce((sum, system) => sum + (system.quantity_hh || 0), 0);
  const totalBodpacks = systems.reduce((sum, system) => sum + (system.quantity_bp || 0), 0);
  return { 
    channels: totalChannels, 
    bodypacks: totalBodpacks,
    total: totalChannels // For backward compatibility
  };
};

export const exportArtistPDF = (data: ArtistPdfData): Promise<Blob> => {
  return new Promise((resolve) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const createdDate = new Date().toLocaleDateString('en-GB');

    // === HEADER SECTION ===
    doc.setFillColor(125, 1, 1);
    doc.rect(0, 0, pageWidth, 30, 'F');

    // Load logo if provided
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
                5, // Y position (top margin)
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
        head: [['Position', 'Artist Provided']],
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
      let wirelessSummary = { hh: 0, bp: 0 };
      let iemSummary = { channels: 0, bodypacks: 0, total: 0 };
      
      // Handle both formats for wireless data
      if (data.technical.wireless.systems) {
        wirelessSummary = getWirelessSummary(data.technical.wireless.systems);
      } else if (data.technical.wireless.handhelds !== undefined || data.technical.wireless.bodypacks !== undefined) {
        wirelessSummary = {
          hh: data.technical.wireless.handhelds || 0,
          bp: data.technical.wireless.bodypacks || 0
        };
      } else if (data.technical.wireless.hh !== undefined || data.technical.wireless.bp !== undefined) {
        wirelessSummary = {
          hh: data.technical.wireless.hh || 0,
          bp: data.technical.wireless.bp || 0
        };
      }
      
      // Handle both formats for IEM data
      if (data.technical.iem.systems) {
        iemSummary = getIEMSummary(data.technical.iem.systems);
      } else if (data.technical.iem.quantity !== undefined) {
        iemSummary = { 
          channels: data.technical.iem.quantity,
          bodypacks: data.technical.iem.quantity, 
          total: data.technical.iem.quantity 
        };
      }
      
      const wirelessModel = data.technical.wireless.systems?.[0]?.model || data.technical.wireless.model || '-';
      const wirelessBand = data.technical.wireless.systems?.[0]?.band || data.technical.wireless.band || '-';
      const iemModel = data.technical.iem.systems?.[0]?.model || data.technical.iem.model || '-';
      const iemBand = data.technical.iem.systems?.[0]?.band || data.technical.iem.band || '-';
      
      const wirelessRows = [
        ...(wirelessSummary.hh > 0 ? [['Handheld', wirelessSummary.hh, 
          wirelessModel, 
          wirelessBand,
          data.technical.wireless.providedBy]] : []),
        ...(wirelessSummary.bp > 0 ? [['Bodypack', wirelessSummary.bp,
          wirelessModel,
          wirelessBand,
          data.technical.wireless.providedBy]] : []),
        ...(iemSummary.channels > 0 ? [['IEM Channels', iemSummary.channels,
          iemModel,
          iemBand,
          data.technical.iem.providedBy]] : []),
        ...(iemSummary.bodypacks > 0 ? [['IEM Bodypacks', iemSummary.bodypacks,
          iemModel,
          iemBand,
          data.technical.iem.providedBy]] : [])
      ];

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

      // === COMPANY LOGO ===
      try {
        // Add a small company logo at the bottom right
        const companyLogoUrl = 'public/sector pro logo.png';
        const companyImg = new Image();
        companyImg.onload = () => {
          try {
            // Logo at bottom right
            const logoWidth = 20;
            const ratio = companyImg.width / companyImg.height;
            const logoHeight = logoWidth / ratio;
            
            doc.addImage(
              companyImg, 
              'PNG', 
              pageWidth - logoWidth - 10, // X position (right aligned)
              pageHeight - logoHeight - 10, // Y position (bottom aligned)
              logoWidth,
              logoHeight
            );
            
            // Footer with date
            doc.setFontSize(8);
            doc.setTextColor(51, 51, 51);
            doc.text(`Generated: ${createdDate}`, pageWidth - 35, pageHeight - 10, { align: 'right' });
            
            // Resolve with the PDF blob
            const blob = doc.output('blob');
            resolve(blob);
          } catch (err) {
            console.error('Error adding company logo to PDF:', err);
            // Continue without company logo
            doc.setFontSize(8);
            doc.setTextColor(51, 51, 51);
            doc.text(`Generated: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
            const blob = doc.output('blob');
            resolve(blob);
          }
        };
        companyImg.onerror = () => {
          // If company logo fails to load, just add the footer text
          doc.setFontSize(8);
          doc.setTextColor(51, 51, 51);
          doc.text(`Generated: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
          const blob = doc.output('blob');
          resolve(blob);
        };
        companyImg.src = companyLogoUrl;
      } catch (logoErr) {
        // If any error occurs, just add the footer text
        doc.setFontSize(8);
        doc.setTextColor(51, 51, 51);
        doc.text(`Generated: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
        const blob = doc.output('blob');
        resolve(blob);
      }
    });
  });
};
