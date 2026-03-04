import { loadPdfLibs } from '@/utils/pdf/lazyPdf';

export interface WiredMicrophoneMatrixData {
  jobTitle: string;  
  logoUrl?: string;
  artistsByDateAndStage: Map<string, Map<number, any[]>>;
}

export const exportWiredMicrophoneMatrixPDF = async (data: WiredMicrophoneMatrixData): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const pdf = new jsPDF('landscape', 'pt', 'a4');
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;
  const margin = 20;
  const footerReserve = 28;
  
  // Festival document styling
  const primaryColor: [number, number, number] = [139, 21, 33]; // Burgundy/red
  const secondaryColor: [number, number, number] = [52, 73, 94]; // Dark gray
  const lightGray: [number, number, number] = [240, 240, 240];
  const headerGray: [number, number, number] = [248, 249, 250];

  type HeaderLogo = {
    dataUrl: string;
    format: 'PNG' | 'JPEG';
    width: number;
    height: number;
  };
  const loadHeaderLogo = async (url?: string): Promise<HeaderLogo | undefined> => {
    if (!url) return undefined;
    try {
      const logoResponse = await fetch(url);
      if (!logoResponse.ok) return undefined;
      const logoBlob = await logoResponse.blob();
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(logoBlob);
      });
      const dimensions = await new Promise<{ width: number; height: number } | undefined>((resolve) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.width, height: image.height });
        image.onerror = () => resolve(undefined);
        image.src = dataUrl;
      });
      if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) return undefined;
      return {
        dataUrl,
        format: logoBlob.type.toLowerCase().includes('png') ? 'PNG' : 'JPEG',
        width: dimensions.width,
        height: dimensions.height,
      };
    } catch {
      return undefined;
    }
  };

  const headerLogo = await loadHeaderLogo(data.logoUrl);
  
  let isFirstPage = true;
  
  console.log('🚀 FRESH START: Starting simplified PDF generation');
  console.log('📊 Input data:', {
    totalDates: data.artistsByDateAndStage.size,
    dateStructure: Array.from(data.artistsByDateAndStage.entries()).map(([date, stages]) => ({
      date,
      stageCount: stages.size,
      totalArtists: Array.from(stages.values()).reduce((sum, artists) => sum + artists.length, 0)
    }))
  });
  
  // Process each date and stage
  const dateEntries = Array.from(data.artistsByDateAndStage.entries());
  for (let i = 0; i < dateEntries.length; i++) {
    const [date, stagesMap] = dateEntries[i];
    const stageEntries = Array.from(stagesMap.entries());
    for (let j = 0; j < stageEntries.length; j++) {
      const [stage, artists] = stageEntries[j];
      console.log(`\n📋 Processing: ${date} - Stage ${stage} (${artists.length} artists)`);

      if (!isFirstPage) {
        pdf.addPage();
      }
      isFirstPage = false;

      const formattedDate = formatDateSimply(date);
      const drawSectionHeader = (): number => {
        let yPosition = 20;

        if (headerLogo) {
          const maxLogoWidth = 50;
          const maxLogoHeight = 25;
          const scale = Math.min(maxLogoWidth / headerLogo.width, maxLogoHeight / headerLogo.height);
          const drawWidth = headerLogo.width * scale;
          const drawHeight = headerLogo.height * scale;
          pdf.addImage(
            headerLogo.dataUrl,
            headerLogo.format,
            margin,
            yPosition,
            drawWidth,
            drawHeight,
          );
          yPosition += 35;
        }

        pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        pdf.rect(0, yPosition, pageWidth, 25, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Matriz de Microfonia Cableada', pageWidth / 2, yPosition + 16, { align: 'center' });
        yPosition += 35;

        pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'normal');
        pdf.text(data.jobTitle, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 20;

        pdf.setFillColor(headerGray[0], headerGray[1], headerGray[2]);
        pdf.rect(margin, yPosition - 5, pageWidth - (margin * 2), 20, 'F');
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${formattedDate} - Escenario ${stage}`, pageWidth / 2, yPosition + 8, { align: 'center' });
        return yPosition + 30;
      };

      let yPosition = drawSectionHeader();
      
      // Generate matrix data with simple approach
      const matrixData = generateSimplifiedMatrixData(artists);
      
      console.log('📊 Matrix generated:', {
        micModels: matrixData.micModels,
        artists: matrixData.artistNames,
        sampleData: matrixData.micModels.slice(0, 2).map(model => ({
          model,
          artistValues: matrixData.artistNames.slice(0, 3).map(artist => 
            `${artist}: ${matrixData.individualMatrix[model]?.[artist] || 0}`
          ),
          peak: matrixData.peakMatrix[model]
        }))
      });
      
      if (matrixData.micModels.length === 0) {
        pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Sin requerimientos de microfonia cableada para este escenario.', margin, yPosition);
        continue;
      }
      
      // Add note
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(100, 100, 100);
      pdf.text('Las celdas individuales muestran cantidades exactas por artista. Pico muestra el uso maximo concurrente.', margin, yPosition);
      yPosition += 20;
      
      // Create table
      const headers = ['Modelo Microfono', ...matrixData.artistNames, 'Pico'];
      const tableBody = matrixData.micModels.map(micModel => {
        const row = [micModel];
        
        // Add individual artist quantities
        matrixData.artistNames.forEach(artistName => {
          const quantity = matrixData.individualMatrix[micModel]?.[artistName] || 0;
          row.push(quantity.toString());
        });
        
        // Add peak quantity
        const peakQuantity = matrixData.peakMatrix[micModel] || 0;
        row.push(peakQuantity.toString());
        return row;
      });
      
      // Table styling
      const availableWidth = pageWidth - (margin * 2);
      const micModelColumnWidth = Math.min(availableWidth * 0.25, 150);
      const peakColumnWidth = 80;
      const artistColumnsWidth = availableWidth - micModelColumnWidth - peakColumnWidth;
      const artistColumnWidth = Math.max(artistColumnsWidth / matrixData.artistNames.length, 60);
      
      // Generate table
      autoTable(pdf, {
        startY: yPosition,
        head: [headers],
        body: tableBody,
        theme: 'grid',
        headStyles: {
          fillColor: primaryColor as [number, number, number],
          textColor: [255, 255, 255] as [number, number, number],
          fontSize: 10,
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle'
        },
        bodyStyles: {
          fontSize: 9,
          textColor: secondaryColor as [number, number, number],
          cellPadding: 3,
          halign: 'center',
          valign: 'middle'
        },
        alternateRowStyles: {
          fillColor: lightGray as [number, number, number]
        },
        styles: {
          cellPadding: 3,
          lineColor: [200, 200, 200] as [number, number, number],
          lineWidth: 0.5,
          overflow: 'linebreak'
        },
        rowPageBreak: 'avoid',
        margin: { left: margin, right: margin, top: yPosition, bottom: footerReserve },
        didDrawPage: () => {
          drawSectionHeader();
        },
        columnStyles: {
          0: {
            cellWidth: micModelColumnWidth,
            fontStyle: 'bold',
            halign: 'left'
          },
          [headers.length - 1]: {
            cellWidth: peakColumnWidth,
            fillColor: [255, 240, 240] as [number, number, number],
            fontStyle: 'bold',
            textColor: primaryColor as [number, number, number]
          }
        },
        didParseCell: function(data: any) {
          // Style artist columns
          if (data.column.index > 0 && data.column.index < headers.length - 1) {
            data.cell.styles.cellWidth = artistColumnWidth;

            // Highlight non-zero quantities
            if (data.section === 'body' && parseInt(data.cell.text[0]) > 0) {
              data.cell.styles.fillColor = [235, 255, 235] as [number, number, number];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });
    }
  }
  
  // Add footer on all pages
  const timestamp = new Date().toLocaleString();
  const pageCount = pdf.getNumberOfPages();
  
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(128, 128, 128);
    
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);
    
    pdf.text(`Generado: ${timestamp}`, margin, pageHeight - 10);
    pdf.text(`${data.jobTitle} - Matriz Microfonia Cableada`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    pdf.text(`Pagina ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }
  
  return new Blob([pdf.output('blob')], { type: 'application/pdf' });
};

// Simple date formatting - no complex timezone handling
const formatDateSimply = (dateString: string): string => {
  console.log(`📅 Formatting date: "${dateString}"`);
  
  // Handle YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    const formatted = `${weekdays[date.getDay()]}, ${parseInt(day)} de ${months[date.getMonth()]} ${year}`;
    console.log(`📅 Formatted: "${dateString}" -> "${formatted}"`);
    return formatted;
  }
  
  return dateString; // Fallback to original
};

interface SimplifiedMatrixData {
  micModels: string[];
  artistNames: string[];
  individualMatrix: Record<string, Record<string, number>>;
  peakMatrix: Record<string, number>;
}

// Completely simplified matrix generation - direct database mapping
const generateSimplifiedMatrixData = (artists: any[]): SimplifiedMatrixData => {
  console.log('\n🔄 SIMPLIFIED MATRIX GENERATION START');
  console.log('🎭 Artists input:', artists.map(a => ({
    name: a.name,
    wiredMicsCount: a.wired_mics?.length || 0,
    wiredMicsPreview: a.wired_mics?.slice(0, 2)
  })));
  
  const micModelsSet = new Set<string>();
  const artistNamesSet = new Set<string>();
  const individualMatrix: Record<string, Record<string, number>> = {};
  
  // Step 1: Direct database mapping - no accumulation bugs
  artists.forEach((artist, artistIndex) => {
    const artistName = artist.name || `Artist ${artistIndex + 1}`;
    artistNamesSet.add(artistName);
    
    console.log(`\n👤 Processing artist: ${artistName}`);
    console.log(`🎤 Raw wired_mics:`, artist.wired_mics);
    
    if (!artist.wired_mics || !Array.isArray(artist.wired_mics)) {
      console.log(`⚠️ No wired_mics array for ${artistName}`);
      return;
    }
    
    // Process each mic entry directly
    artist.wired_mics.forEach((micEntry: any, micIndex: number) => {
      console.log(`🎤 Processing mic ${micIndex}:`, micEntry);
      
      if (!micEntry || typeof micEntry !== 'object') {
        console.log(`❌ Invalid mic entry ${micIndex}`);
        return;
      }
      
      const micModel = String(micEntry.model || '').trim();
      const quantity = parseInt(String(micEntry.quantity || 0));
      
      if (!micModel || quantity <= 0) {
        console.log(`❌ Invalid mic: model="${micModel}", quantity=${quantity}`);
        return;
      }
      
      console.log(`✅ VALID MIC: ${artistName} needs ${quantity}x ${micModel}`);
      
      micModelsSet.add(micModel);
      
      // Initialize if needed
      if (!individualMatrix[micModel]) {
        individualMatrix[micModel] = {};
      }
      
      // CRITICAL FIX: Direct assignment, no accumulation
      individualMatrix[micModel][artistName] = quantity;
      
      console.log(`📝 STORED: ${micModel}[${artistName}] = ${quantity}`);
    });
  });
  
  // Step 2: Simple peak calculation - just sum all requirements
  const peakMatrix: Record<string, number> = {};
  
  console.log('\n⚡ CALCULATING PEAKS');
  micModelsSet.forEach(micModel => {
    const artistRequirements = individualMatrix[micModel] || {};
    const peak = Object.values(artistRequirements).reduce((sum, qty) => sum + (qty || 0), 0);
    peakMatrix[micModel] = peak;
    
    console.log(`📊 Peak for ${micModel}: ${peak} (from ${Object.entries(artistRequirements).map(([artist, qty]) => `${artist}:${qty}`).join(', ')})`);
  });
  
  const result = {
    micModels: Array.from(micModelsSet).sort(),
    artistNames: Array.from(artistNamesSet).sort(),
    individualMatrix,
    peakMatrix
  };
  
  console.log('\n🎯 FINAL SIMPLIFIED RESULT:');
  console.log(`🎤 Mic models (${result.micModels.length}):`, result.micModels);
  console.log(`👥 Artists (${result.artistNames.length}):`, result.artistNames);
  console.log('📊 Individual matrix sample:', Object.entries(result.individualMatrix).slice(0, 2));
  console.log('⚡ Peak matrix sample:', Object.entries(result.peakMatrix).slice(0, 3));
  
  return result;
};

// Helper function to organize artists by date and stage - fixed date handling
export const organizeArtistsByDateAndStage = (artists: any[]): Map<string, Map<number, any[]>> => {
  const organized = new Map<string, Map<number, any[]>>();
  
  console.log('\n🗂️ ORGANIZING ARTISTS BY DATE/STAGE - FIXED VERSION');
  console.log(`📋 Input: ${artists.length} artists`);
  
  // Log all unique dates first
  const allDates = [];
  for (let i = 0; i < artists.length; i++) {
    const date = artists[i].date;
    if (date) {
      allDates.push(date);
    }
  }
  const uniqueDates = Array.from(new Set(allDates));
  console.log('📅 ALL DATES IN INPUT:', uniqueDates);

  for (let i = 0; i < artists.length; i++) {
    const artist = artists[i];
    const date = artist.date;
    const stage = artist.stage || 1;

    console.log(`📌 Artist ${i}: "${artist.name}" -> Date: "${date}", Stage: ${stage}`);

    if (!date) {
      console.warn(`⚠️ Skipping "${artist.name}" - no date field`);
      continue;
    }

    // Initialize structures
    if (!organized.has(date)) {
      organized.set(date, new Map());
    }
    if (!organized.get(date)!.has(stage)) {
      organized.get(date)!.set(stage, []);
    }

    organized.get(date)!.get(stage)!.push(artist);
  }

  console.log('\n📊 ORGANIZATION COMPLETE:');
  const organizedEntries = Array.from(organized.entries());
  for (let i = 0; i < organizedEntries.length; i++) {
    const [date, stages] = organizedEntries[i];
    console.log(`📅 Date "${date}": ${stages.size} stages`);
    const stageEntries = Array.from(stages.entries());
    for (let j = 0; j < stageEntries.length; j++) {
      const [stage, stageArtists] = stageEntries[j];
      console.log(`  🎪 Stage ${stage}: ${stageArtists.length} artists`);
      for (let k = 0; k < stageArtists.length; k++) {
        const artist = stageArtists[k];
        const wiredMicCount = artist.wired_mics?.length || 0;
        console.log(`    👤 ${artist.name}: ${wiredMicCount} wired mics`);
      }
    }
  }
  
  return organized;
};
