import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

// Artist data interface for full schedule export
export interface FullScheduleArtist {
  name: string;
  date: string;
  stage: number;
  show_start: string;
  show_end: string;
  soundcheck_start?: string;
  soundcheck_end?: string;
  soundcheck: boolean;
}

export interface FullFestivalSchedulePdfData {
  jobTitle: string;
  artists: FullScheduleArtist[];
  stageNames?: Record<number, string>;
  logoUrl?: string;
}

// Enhanced image loading function
const loadImageSafely = async (src: string, description: string): Promise<HTMLImageElement | null> => {
  console.log(`Loading ${description} from:`, src);
  
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    const timeout = setTimeout(() => {
      console.warn(`Timeout loading ${description} from:`, src);
      resolve(null);
    }, 10000);
    
    img.onload = () => {
      clearTimeout(timeout);
      console.log(`Successfully loaded ${description}`);
      resolve(img);
    };
    
    img.onerror = (error) => {
      clearTimeout(timeout);
      console.error(`Failed to load ${description} from:`, src, error);
      resolve(null);
    };
    
    img.src = src;
  });
};

export const exportFullFestivalSchedulePDF = async (data: FullFestivalSchedulePdfData): Promise<Blob> => {
  console.log('exportFullFestivalSchedulePDF called with data:', data);
  
  const doc = new jsPDF('portrait');
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // === HEADER SECTION ===
  doc.setFillColor(125, 1, 1);
  doc.rect(0, 0, pageWidth, 35, 'F');

  // Load festival logo if provided
  let festivalLogoLoaded = false;
  if (data.logoUrl) {
    console.log("Attempting to load festival logo:", data.logoUrl);
    
    const festivalImg = await loadImageSafely(data.logoUrl, 'festival logo');
    if (festivalImg) {
      try {
        console.log("Festival logo loaded, dimensions:", festivalImg.width, "x", festivalImg.height);
        const maxHeight = 20;
        const ratio = festivalImg.width / festivalImg.height;
        const logoHeight = Math.min(maxHeight, festivalImg.height);
        const logoWidth = logoHeight * ratio;
        
        doc.addImage(festivalImg, 'JPEG', 10, 7, logoWidth, logoHeight);
        festivalLogoLoaded = true;
        console.log("Festival logo added successfully to PDF");
      } catch (error) {
        console.error('Error adding festival logo to PDF:', error);
      }
    }
  }

  // If festival logo failed, try fallback logo
  if (!festivalLogoLoaded) {
    console.log("Trying fallback logo");
    const fallbackImg = await loadImageSafely('/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png', 'fallback logo');
    if (fallbackImg) {
      try {
        const maxHeight = 20;
        const ratio = fallbackImg.width / fallbackImg.height;
        const logoHeight = Math.min(maxHeight, fallbackImg.height);
        const logoWidth = logoHeight * ratio;
        
        doc.addImage(fallbackImg, 'PNG', 10, 7, logoWidth, logoHeight);
        console.log("Fallback logo added successfully");
      } catch (error) {
        console.error('Error adding fallback logo to PDF:', error);
      }
    }
  }

  // Add title
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  const titleText = `${data.jobTitle} - Festival Schedule`;
  doc.text(titleText, pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text('Complete Show Schedule', pageWidth / 2, 30, { align: 'center' });

  // Sort artists by date, then by show time
  const sortedArtists = data.artists
    .filter(artist => artist.show_start) // Only include artists with show times
    .sort((a, b) => {
      // First sort by date
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      
      // Then by show start time
      return a.show_start.localeCompare(b.show_start);
    });

  console.log('Sorted artists for schedule:', sortedArtists.length);

  // === FESTIVAL SCHEDULE TABLE ===
  const tableData = sortedArtists.map(artist => {
    const stageName = data.stageNames?.[artist.stage] || `Stage ${artist.stage}`;
    const showTime = `${artist.show_start} - ${artist.show_end}`;
    const soundcheckTime = artist.soundcheck && artist.soundcheck_start && artist.soundcheck_end 
      ? `${artist.soundcheck_start} - ${artist.soundcheck_end}`
      : '-';
    
    return [
      format(new Date(artist.date), 'dd/MM/yyyy'),
      format(new Date(artist.date), 'EEEE'),
      artist.name,
      stageName,
      showTime,
      soundcheckTime
    ];
  });

  console.log('Schedule table data prepared:', tableData.length, 'rows');

  autoTable(doc, {
    head: [['FECHA', 'DÍA', 'ARTISTA', 'ESCENARIO', 'HORA DE SHOW', 'SOUNDCHECK']],
    body: tableData,
    startY: 45,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 2,
      valign: 'middle',
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [125, 1, 1],
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold',
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' }, // Date
      1: { cellWidth: 22, halign: 'center' }, // Day
      2: { cellWidth: 60, halign: 'left' }, // Artist
      3: { cellWidth: 25, halign: 'center' }, // Stage
      4: { cellWidth: 30, halign: 'center' }, // Show Time
      5: { cellWidth: 25, halign: 'center' }, // Soundcheck
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250],
    },
    margin: { left: 10, right: 10 },
  });

  // Add summary information
  const uniqueDates = [...new Set(sortedArtists.map(a => a.date))];
  const totalArtists = sortedArtists.length;
  const uniqueStages = [...new Set(sortedArtists.map(a => a.stage))];

  let currentY = (doc as any).lastAutoTable.finalY + 20;

  // Check if we need a new page for the summary
  if (currentY > pageHeight - 80) {
    doc.addPage();
    currentY = 20;
  }

  // Add summary section
  doc.setFontSize(14);
  doc.setTextColor(125, 1, 1);
  doc.text('Resumen del Festival', 15, currentY);
  currentY += 15;

  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(`Total de fechas: ${uniqueDates.length}`, 15, currentY);
  currentY += 8;
  doc.text(`Total de artistas: ${totalArtists}`, 15, currentY);
  currentY += 8;
  doc.text(`Escenarios utilizados: ${uniqueStages.length} (${uniqueStages.map(s => data.stageNames?.[s] || `Stage ${s}`).join(', ')})`, 15, currentY);
  currentY += 8;

  if (uniqueDates.length > 0) {
    const firstDate = format(new Date(uniqueDates[0]), 'dd/MM/yyyy');
    const lastDate = format(new Date(uniqueDates[uniqueDates.length - 1]), 'dd/MM/yyyy');
    doc.text(`Período: ${firstDate} - ${lastDate}`, 15, currentY);
  }

  // === COMPANY LOGO (CENTERED AT BOTTOM) ===
  console.log("Attempting to load Sector Pro logo");
  const sectorImg = await loadImageSafely('/sector pro logo.png', 'Sector Pro logo');
  if (sectorImg) {
    try {
      const logoWidth = 30;
      const ratio = sectorImg.width / sectorImg.height;
      const logoHeight = logoWidth / ratio;
      
      doc.addImage(
        sectorImg, 
        'PNG', 
        pageWidth / 2 - logoWidth / 2,
        pageHeight - logoHeight - 10,
        logoWidth,
        logoHeight
      );
      console.log("Sector Pro logo added successfully at bottom center");
    } catch (error) {
      console.error('Error adding Sector Pro logo to PDF:', error);
    }
  } else {
    const altSectorImg = await loadImageSafely('/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png', 'alternative Sector Pro logo');
    if (altSectorImg) {
      try {
        const logoWidth = 30;
        const ratio = altSectorImg.width / altSectorImg.height;
        const logoHeight = logoWidth / ratio;
        
        doc.addImage(
          altSectorImg, 
          'PNG', 
          pageWidth / 2 - logoWidth / 2,
          pageHeight - logoHeight - 10,
          logoWidth,
          logoHeight
        );
        console.log("Alternative Sector Pro logo added successfully");
      } catch (error) {
        console.error('Error adding alternative Sector Pro logo to PDF:', error);
      }
    }
  }

  // Add creation date
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  const creationDate = new Date().toLocaleDateString('es-ES');
  doc.text(`Generado: ${creationDate}`, pageWidth - 15, pageHeight - 5, { align: 'right' });

  console.log('Full festival schedule PDF generation complete');
  return doc.output('blob');
};