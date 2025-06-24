import jsPDF from 'jspdf';
import 'jspdf-autotable';

export interface WiredMicrophoneMatrixData {
  jobTitle: string;  
  logoUrl?: string;
  artistsByDateAndStage: Map<string, Map<number, any[]>>;
}

export const exportWiredMicrophoneMatrixPDF = async (data: WiredMicrophoneMatrixData): Promise<Blob> => {
  const pdf = new jsPDF('landscape', 'pt', 'a4');
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;
  const margin = 20;
  
  // Festival document styling
  const primaryColor = [139, 21, 33]; // Burgundy/red
  const secondaryColor = [52, 73, 94]; // Dark gray
  const lightGray = [240, 240, 240];
  const headerGray = [248, 249, 250];
  
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
  for (const [date, stagesMap] of data.artistsByDateAndStage.entries()) {
    for (const [stage, artists] of stagesMap.entries()) {
      console.log(`\n📋 Processing: ${date} - Stage ${stage} (${artists.length} artists)`);
      
      if (!isFirstPage) {
        pdf.addPage();
      }
      isFirstPage = false;
      
      let yPosition = 20;
      
      // Add logo if available
      if (data.logoUrl && yPosition === 20) {
        try {
          const logoResponse = await fetch(data.logoUrl);
          const logoBlob = await logoResponse.blob();
          const logoDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(logoBlob);
          });
          
          pdf.addImage(logoDataUrl, 'PNG', margin, yPosition, 50, 25);
          yPosition += 35;
        } catch (error) {
          console.error('❌ Logo loading error:', error);
        }
      }
      
      // Header with burgundy background
      pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.rect(0, yPosition, pageWidth, 25, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Wired Microphone Requirements Matrix', pageWidth / 2, yPosition + 16, { align: 'center' });
      yPosition += 35;
      
      // Job title
      pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.text(data.jobTitle, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 20;
      
      // Date and stage header
      const formattedDate = formatDateSimply(date);
      pdf.setFillColor(headerGray[0], headerGray[1], headerGray[2]);
      pdf.rect(margin, yPosition - 5, pageWidth - (margin * 2), 20, 'F');
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${formattedDate} - Stage ${stage}`, pageWidth / 2, yPosition + 8, { align: 'center' });
      yPosition += 30;
      
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
        pdf.text('No wired microphone requirements for this stage.', margin, yPosition);
        continue;
      }
      
      // Add note
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(100, 100, 100);
      pdf.text('Individual cells show exact quantities per artist. Peak shows maximum concurrent usage.', margin, yPosition);
      yPosition += 20;
      
      // Create table
      const headers = ['Microphone Model', ...matrixData.artistNames, 'Peak Need'];
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
      (pdf as any).autoTable({
        startY: yPosition,
        head: [headers],
        body: tableBody,
        theme: 'grid',
        headStyles: { 
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle'
        },
        bodyStyles: { 
          fontSize: 9,
          textColor: secondaryColor,
          cellPadding: 3,
          halign: 'center',
          valign: 'middle'
        },
        alternateRowStyles: {
          fillColor: lightGray
        },
        styles: { 
          cellPadding: 3,
          lineColor: [200, 200, 200],
          lineWidth: 0.5,
          overflow: 'linebreak'
        },
        columnStyles: {
          0: { 
            cellWidth: micModelColumnWidth,
            fontStyle: 'bold',
            halign: 'left'
          },
          [headers.length - 1]: {
            cellWidth: peakColumnWidth,
            fillColor: [255, 240, 240],
            fontStyle: 'bold',
            textColor: [139, 21, 33]
          }
        },
        didParseCell: function(data: any) {
          // Style artist columns
          if (data.column.index > 0 && data.column.index < headers.length - 1) {
            data.cell.styles.cellWidth = artistColumnWidth;
            
            // Highlight non-zero quantities
            if (data.section === 'body' && parseInt(data.cell.text[0]) > 0) {
              data.cell.styles.fillColor = [235, 255, 235];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
        margin: { left: margin, right: margin }
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
    
    pdf.text(`Generated on ${timestamp}`, margin, pageHeight - 10);
    pdf.text(`${data.jobTitle} - Wired Microphone Matrix`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    pdf.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
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
    
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];
    
    const formatted = `${weekdays[date.getDay()]}, ${months[date.getMonth()]} ${parseInt(day)}, ${year}`;
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
  const allDates = artists.map(a => a.date).filter(Boolean);
  const uniqueDates = [...new Set(allDates)];
  console.log('📅 ALL DATES IN INPUT:', uniqueDates);
  
  artists.forEach((artist, index) => {
    const date = artist.date;
    const stage = artist.stage || 1;
    
    console.log(`📌 Artist ${index}: "${artist.name}" -> Date: "${date}", Stage: ${stage}`);
    
    if (!date) {
      console.warn(`⚠️ Skipping "${artist.name}" - no date field`);
      return;
    }
    
    // Initialize structures
    if (!organized.has(date)) {
      organized.set(date, new Map());
    }
    if (!organized.get(date)!.has(stage)) {
      organized.get(date)!.set(stage, []);
    }
    
    organized.get(date)!.get(stage)!.push(artist);
  });
  
  console.log('\n📊 ORGANIZATION COMPLETE:');
  Array.from(organized.entries()).forEach(([date, stages]) => {
    console.log(`📅 Date "${date}": ${stages.size} stages`);
    Array.from(stages.entries()).forEach(([stage, stageArtists]) => {
      console.log(`  🎪 Stage ${stage}: ${stageArtists.length} artists`);
      stageArtists.forEach(artist => {
        const wiredMicCount = artist.wired_mics?.length || 0;
        console.log(`    👤 ${artist.name}: ${wiredMicCount} wired mics`);
      });
    });
  });
  
  return organized;
};
