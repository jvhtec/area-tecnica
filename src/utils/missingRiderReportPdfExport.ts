import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
import { generateQRCode } from '@/utils/qrcode';

export interface MissingRiderArtist {
  id: string;
  name: string;
  stage: number;
  stageName?: string;
  date: string;
  showTime: {
    start: string;
    end: string;
  };
  formUrl?: string;
}

export interface MissingRiderReportData {
  jobTitle: string;
  logoUrl?: string;
  artists: MissingRiderArtist[];
}

export const exportMissingRiderReportPDF = async (data: MissingRiderReportData): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 20;
  const marginRight = 20;
  const footerReserve = 24;
  const topMarginForContinuedPages = 30;
  const contentBottomY = pageHeight - footerReserve;
  const getLastAutoTableFinalY = (fallback: number) => {
    const docWithTable = doc as unknown as { lastAutoTable?: { finalY?: number } };
    return docWithTable.lastAutoTable?.finalY ?? fallback;
  };
  interface LoadedImage {
    dataUrl: string;
    width: number;
    height: number;
  }
  const imageTypeFromDataUrl = (dataUrl: string) => (dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG');
  const addDataUrlImage = (dataUrl: string, x: number, y: number, w: number, h: number) => {
    doc.addImage(dataUrl, imageTypeFromDataUrl(dataUrl), x, y, w, h);
  };
  const toLoadedImage = async (url?: string): Promise<LoadedImage | undefined> => {
    if (!url || typeof Image === 'undefined') return undefined;
    try {
      const response = await fetch(url);
      if (!response.ok) return undefined;
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.width || 1, height: image.height || 1 });
        image.onerror = () => resolve({ width: 1, height: 1 });
        image.src = dataUrl;
      });

      return {
        dataUrl,
        width: dimensions.width,
        height: dimensions.height,
      };
    } catch {
      return undefined;
    }
  };
  const fitDimensions = (
    image: LoadedImage,
    maxWidth: number,
    maxHeight: number,
  ): { width: number; height: number } => {
    const ratio = image.width / image.height || 1;
    let width = maxWidth;
    let height = width / ratio;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * ratio;
    }
    return { width, height };
  };

  const festivalLogo = await toLoadedImage(data.logoUrl);
  const sectorLogo =
    (await toLoadedImage('/sector pro logo.png')) ||
    (await toLoadedImage('/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png'));

  const drawRunningHeader = (pageNumber: number) => {
    doc.setFillColor(125, 1, 1);
    doc.rect(0, 0, pageWidth, 24, 'F');

    if (festivalLogo) {
      try {
        const dims = fitDimensions(festivalLogo, 24, 16);
        addDataUrlImage(
          festivalLogo.dataUrl,
          8,
          4 + (16 - dims.height) / 2,
          dims.width,
          dims.height,
        );
      } catch (error) {
        console.warn('Could not render festival logo in missing rider header:', error);
      }
    }

    doc.setTextColor('#ffffff');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Reporte de Riders Faltantes', pageWidth / 2, 10, { align: 'center' });
    doc.setFontSize(9);
    doc.text(data.jobTitle, pageWidth / 2, 17, { align: 'center' });

    if (pageNumber > 1) {
      doc.setFontSize(8);
      doc.text(`Página ${pageNumber}`, pageWidth - marginRight, 10, { align: 'right' });
    }
  };
  
  // Set up fonts and colors
  const primaryColor = '#7d0101';
  const textColor = '#1f2937';
  const warningColor = '#dc2626';
  
  let yPosition = 34;
  
  // Header
  doc.setFontSize(18);
  doc.setTextColor(primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Reporte de Riders Faltantes', marginLeft, yPosition);
  
  yPosition += 15;
  
  // Job title
  doc.setFontSize(16);
  doc.setTextColor(textColor);
  doc.setFont('helvetica', 'normal');
  doc.text(data.jobTitle, 20, yPosition);
  
  yPosition += 10;
  
  // Generated date
  doc.setFontSize(10);
  doc.setTextColor('#6b7280');
  doc.text(`Generado el: ${format(new Date(), 'PPP', { locale: es })}`, 20, yPosition);
  
  yPosition += 20;
  
  // Warning message
  doc.setFontSize(12);
  doc.setTextColor(warningColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Aún no hemos recibido los riders de los siguientes artistas:', 20, yPosition);
  
  yPosition += 15;
  
  if (data.artists.length === 0) {
    doc.setFontSize(12);
    doc.setTextColor('#059669');
    doc.setFont('helvetica', 'normal');
    doc.text('Todos los artistas tienen su rider técnico completo.', 20, yPosition);
  } else {
    const qrByRowIndex = await Promise.all(
      data.artists.map(async (artist) => {
        if (!artist.formUrl) return null;
        try {
          return await generateQRCode(artist.formUrl);
        } catch (error) {
          console.warn(`Could not generate QR for artist ${artist.name}:`, error);
          return null;
        }
      }),
    );

    // Create table data
    const tableData = data.artists.map((artist, index) => {
      // Safely format date
      let dateText = 'TBA';
      try {
        if (artist.date) {
          const d = new Date(artist.date);
          if (!isNaN(d.getTime())) {
            dateText = format(d, 'EEE, d MMM', { locale: es });
          }
        }
      } catch {
        dateText = 'TBA';
      }

      const start = artist.showTime?.start || '-';
      const end = artist.showTime?.end || '-';

      return [
        artist.name,
        artist.stageName || `Escenario ${artist.stage}`,
        dateText,
        qrByRowIndex[index] ? '' : 'N/A'
      ];
    });
    
    // Add table
    autoTable(doc, {
      startY: yPosition,
      head: [['Artista', 'Escenario', 'Fecha', 'QR Formulario Público']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [125, 1, 1], // Red color for missing riders
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 11
      },
      bodyStyles: {
        textColor: [31, 41, 55],
        fontSize: 10,
        minCellHeight: 24
      },
      alternateRowStyles: {
        fillColor: [254, 242, 242] // Light red background
      },
      margin: { left: marginLeft, right: marginRight, top: topMarginForContinuedPages, bottom: footerReserve },
      rowPageBreak: 'avoid',
      columnStyles: {
        0: { cellWidth: 50 }, // Artist
        1: { cellWidth: 42, overflow: 'ellipsize' }, // Escenario (no wrap)
        2: { cellWidth: 28 }, // Fecha
        3: { cellWidth: 40 }  // QR
      },
      didDrawPage: () => {
        const pageNumber = doc.getCurrentPageInfo().pageNumber;
        drawRunningHeader(pageNumber);
      },
      didDrawCell: (hookData: {
        section: string;
        column: { index: number };
        row: { index: number };
        cell: { x: number; y: number; width: number; height: number };
      }) => {
        if (hookData.section !== 'body' || hookData.column.index !== 3) return;

        const qrDataUrl = qrByRowIndex[hookData.row.index];
        const formUrl = data.artists[hookData.row.index]?.formUrl;
        if (!qrDataUrl) return;

        const maxSize = Math.min(hookData.cell.width - 4, hookData.cell.height - 4, 18);
        const x = hookData.cell.x + (hookData.cell.width - maxSize) / 2;
        const y = hookData.cell.y + (hookData.cell.height - maxSize) / 2;
        doc.addImage(qrDataUrl, 'PNG', x, y, maxSize, maxSize);
        if (formUrl) {
          doc.link(x, y, maxSize, maxSize, { url: formUrl });
        }
      },
    });
    
    // Add footer with action items
    let currentY = getLastAutoTableFinalY(yPosition) + 12;

    if (currentY + 8 > contentBottomY) {
      doc.addPage();
      currentY = topMarginForContinuedPages;
      drawRunningHeader(doc.getCurrentPageInfo().pageNumber);
    }
    
    doc.setFontSize(11);
    doc.setTextColor(textColor);
    doc.setFont('helvetica', 'bold');
    doc.text('Acción Requerida:', marginLeft, currentY);
    currentY += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    const actionItems = [
      '• Contacta con los artistas listados para solicitar su rider técnico',
      '• Escanea cada QR para abrir el formulario técnico público del artista',
      '• Haz seguimiento con management o booking del artista',
      '• Asegura que todos los riders se reciban antes de la planificación de producción',
      '• Actualiza el sistema cuando se reciba cada rider'
    ];
    
    actionItems.forEach((item) => {
      const wrappedItem = doc.splitTextToSize(item, pageWidth - marginLeft - marginRight - 5);
      const itemHeight = wrappedItem.length * 5 + 2;

      if (currentY + itemHeight > contentBottomY) {
        doc.addPage();
        currentY = topMarginForContinuedPages;
        drawRunningHeader(doc.getCurrentPageInfo().pageNumber);
      }

      doc.text(wrappedItem, marginLeft + 5, currentY);
      currentY += itemHeight;
    });
  }
  
  // Add consistent footer on every page with final page count
  const totalPages = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    doc.setPage(pageNumber);
    drawRunningHeader(pageNumber);
    doc.setFontSize(8);
    doc.setTextColor('#9ca3af');

    if (sectorLogo) {
      try {
        const dims = fitDimensions(sectorLogo, 22, 8);
        addDataUrlImage(
          sectorLogo.dataUrl,
          pageWidth / 2 - dims.width / 2,
          pageHeight - 16 + (8 - dims.height) / 2,
          dims.width,
          dims.height,
        );
      } catch (error) {
        console.warn('Could not render Sector Pro logo in missing rider footer:', error);
      }
    }

    doc.text(
      `Página ${pageNumber} de ${totalPages} - Generado por Festival Management System`,
      marginLeft,
      pageHeight - 8,
    );
  }
  
  return new Promise((resolve) => {
    resolve(doc.output('blob'));
  });
};
