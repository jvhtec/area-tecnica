
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
  
  console.log('🎯 FINAL FIX: Starting PDF generation');
  console.log('🎯 Input data structure:', {
    totalDates: data.artistsByDateAndStage.size,
    allDates: Array.from(data.artistsByDateAndStage.keys()),
    dateStageStructure: Array.from(data.artistsByDateAndStage.entries()).map(([date, stages]) => ({
      date,
      stages: Array.from(stages.keys()),
      artistCounts: Array.from(stages.entries()).map(([stage, artists]) => ({
        stage,
        count: artists.length,
        names: artists.map(a => a.name)
      }))
    }))
  });
  
  // Process each date
  for (const [date, stagesMap] of data.artistsByDateAndStage.entries()) {
    console.log(`🎯 Processing date: "${date}"`);
    
    // Process each stage within the date
    for (const [stage, artists] of stagesMap.entries()) {
      console.log(`🎯 Processing Stage ${stage} with ${artists.length} artists`);
      console.log(`🎯 Artists in this stage:`, artists.map(a => ({
        name: a.name,
        wiredMicsLength: a.wired_mics?.length || 0,
        wiredMicsContent: a.wired_mics
      })));
      
      if (!isFirstPage) {
        pdf.addPage();
      }
      isFirstPage = false;
      
      let yPosition = 20;
      
      // Add logo if available and on first section
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
          console.error('Error loading logo:', error);
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
      
      // FIXED: Date formatting - completely rewritten
      const formattedDate = formatDateProperly(date);
      console.log(`🎯 Date formatting: "${date}" -> "${formattedDate}"`);
      
      pdf.setFillColor(headerGray[0], headerGray[1], headerGray[2]);
      pdf.rect(margin, yPosition - 5, pageWidth - (margin * 2), 20, 'F');
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${formattedDate} - Stage ${stage}`, pageWidth / 2, yPosition + 8, { align: 'center' });
      yPosition += 30;
      
      // FIXED: Generate matrix data - completely rewritten
      const matrixData = generateFixedMatrixData(artists);
      
      console.log(`🎯 Matrix data generated:`, {
        micModelCount: matrixData.micModels.length,
        artistCount: matrixData.artistNames.length,
        individualMatrixSample: Object.entries(matrixData.individualMatrix).slice(0, 3).map(([model, artistMap]) => ({
          model,
          artistEntries: Object.entries(artistMap).slice(0, 3)
        })),
        peakMatrixSample: Object.entries(matrixData.peakConcurrentMatrix).slice(0, 3)
      });
      
      if (matrixData.micModels.length === 0) {
        pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        pdf.text('No wired microphone requirements for this stage.', margin, yPosition);
        continue;
      }
      
      // Add explanation note
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(100, 100, 100);
      pdf.text('Note: Individual cells show artist requirements. Total column shows peak concurrent usage needed.', margin, yPosition);
      yPosition += 20;
      
      // Create table headers
      const headers = ['Microphone Model', ...matrixData.artistNames, 'Peak Need'];
      
      // Create table body
      const tableBody = matrixData.micModels.map(micModel => {
        const row = [micModel];
        
        matrixData.artistNames.forEach(artistName => {
          const quantity = matrixData.individualMatrix[micModel]?.[artistName] || 0;
          row.push(quantity.toString());
        });
        
        const peakQuantity = matrixData.peakConcurrentMatrix[micModel] || 0;
        row.push(peakQuantity.toString());
        return row;
      });
      
      // Calculate available width and column sizing
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

// COMPLETELY FIXED: Date formatting function
const formatDateProperly = (dateString: string): string => {
  console.log(`🎯 formatDateProperly called with: "${dateString}"`);
  
  try {
    // Handle YYYY-MM-DD format directly without Date constructor
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [yearStr, monthStr, dayStr] = dateString.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const day = parseInt(dayStr, 10);
      
      console.log(`🎯 Parsed date parts: year=${year}, month=${month}, day=${day}`);
      
      // Validate ranges
      if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
        console.error(`🎯 Invalid date parts detected`);
        return dateString;
      }
      
      // Create date using local time (month is 0-indexed)
      const date = new Date(year, month - 1, day, 12, 0, 0, 0);
      
      // Double-check the date was created correctly
      if (date.getFullYear() !== year || date.getMonth() !== (month - 1) || date.getDate() !== day) {
        console.error(`🎯 Date creation verification failed`);
        return dateString;
      }
      
      // Format manually to avoid timezone issues
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
      
      const weekday = weekdays[date.getDay()];
      const monthName = months[date.getMonth()];
      
      const formatted = `${weekday}, ${monthName} ${day}, ${year}`;
      console.log(`🎯 Successfully formatted: "${dateString}" -> "${formatted}"`);
      return formatted;
    }
    
    // Fallback for other formats
    console.log(`🎯 Using fallback formatting for: ${dateString}`);
    return dateString;
    
  } catch (error) {
    console.error(`🎯 Error in formatDateProperly:`, error);
    return dateString;
  }
};

interface FixedMatrixData {
  micModels: string[];
  artistNames: string[];
  individualMatrix: Record<string, Record<string, number>>;
  peakConcurrentMatrix: Record<string, number>;
}

// COMPLETELY FIXED: Matrix data generation
const generateFixedMatrixData = (artists: any[]): FixedMatrixData => {
  console.log('🎯 generateFixedMatrixData starting with:', {
    artistCount: artists.length,
    artistDetails: artists.map(a => ({
      name: a.name,
      wiredMics: a.wired_mics,
      showStart: a.show_start,
      showEnd: a.show_end
    }))
  });
  
  const micModelsSet = new Set<string>();
  const artistNamesSet = new Set<string>();
  const individualMatrix: Record<string, Record<string, number>> = {};
  
  // STEP 1: Build individual requirements - NO ACCUMULATION
  artists.forEach((artist, index) => {
    const artistName = artist.name || `Artist ${index + 1}`;
    artistNamesSet.add(artistName);
    
    console.log(`🎯 Processing artist: ${artistName}`);
    console.log(`🎯 Raw wired_mics:`, artist.wired_mics);
    
    if (!artist.wired_mics || !Array.isArray(artist.wired_mics)) {
      console.log(`🎯 No valid wired_mics array for ${artistName}`);
      return;
    }
    
    // Process each mic entry for this artist
    artist.wired_mics.forEach((micEntry: any, entryIndex: number) => {
      console.log(`🎯 Processing mic entry ${entryIndex} for ${artistName}:`, micEntry);
      
      if (!micEntry.model || micEntry.quantity === undefined || micEntry.quantity === null) {
        console.log(`🎯 Skipping invalid mic entry ${entryIndex}`);
        return;
      }
      
      const micModel = String(micEntry.model).trim();
      const quantity = parseInt(String(micEntry.quantity)) || 0;
      
      console.log(`🎯 Valid mic: ${micModel} = ${quantity} for ${artistName}`);
      
      if (quantity <= 0) {
        console.log(`🎯 Skipping zero quantity for ${micModel}`);
        return;
      }
      
      micModelsSet.add(micModel);
      
      // Initialize matrix structure if needed
      if (!individualMatrix[micModel]) {
        individualMatrix[micModel] = {};
      }
      
      // CRITICAL FIX: Set the exact quantity, don't accumulate
      if (individualMatrix[micModel][artistName]) {
        // If artist already has this mic model, add to existing (for multiple entries of same model)
        individualMatrix[micModel][artistName] += quantity;
      } else {
        individualMatrix[micModel][artistName] = quantity;
      }
      
      console.log(`🎯 Set ${micModel}[${artistName}] = ${individualMatrix[micModel][artistName]}`);
    });
  });
  
  console.log('🎯 Individual matrix final state:');
  Object.entries(individualMatrix).forEach(([micModel, artistMap]) => {
    const entries = Object.entries(artistMap).map(([artist, qty]) => `${artist}=${qty}`);
    console.log(`🎯 ${micModel}: ${entries.join(', ')}`);
  });
  
  // STEP 2: Calculate peak concurrent usage - SIMPLIFIED
  const peakConcurrentMatrix: Record<string, number> = {};
  
  console.log('🎯 Calculating peak concurrent usage...');
  
  // For each microphone model, calculate the maximum concurrent usage
  micModelsSet.forEach(micModel => {
    // Simple approach: sum all individual requirements (assumes all artists could be concurrent)
    // For more complex scheduling, we'd need proper time overlap analysis
    let totalUsage = 0;
    
    artistNamesSet.forEach(artistName => {
      const artistUsage = individualMatrix[micModel]?.[artistName] || 0;
      totalUsage += artistUsage;
    });
    
    peakConcurrentMatrix[micModel] = totalUsage;
    console.log(`🎯 Peak for ${micModel}: ${totalUsage}`);
  });
  
  const result = {
    micModels: Array.from(micModelsSet).sort(),
    artistNames: Array.from(artistNamesSet).sort(),
    individualMatrix,
    peakConcurrentMatrix
  };
  
  console.log('🎯 Final matrix data:', {
    micModelCount: result.micModels.length,
    artistCount: result.artistNames.length,
    sampleIndividualMatrix: Object.entries(result.individualMatrix).slice(0, 2).map(([model, artistMap]) => ({
      model,
      artists: Object.entries(artistMap).slice(0, 3)
    })),
    samplePeakMatrix: Object.entries(result.peakConcurrentMatrix).slice(0, 3)
  });
  
  return result;
};

// Helper function to organize artists by date and stage
export const organizeArtistsByDateAndStage = (artists: any[]): Map<string, Map<number, any[]>> => {
  const organized = new Map<string, Map<number, any[]>>();
  
  console.log('🎯 organizeArtistsByDateAndStage called with:', {
    totalArtists: artists.length,
    sampleArtists: artists.slice(0, 3).map(a => ({
      name: a.name,
      date: a.date,
      stage: a.stage,
      wiredMicsCount: a.wired_mics?.length || 0
    }))
  });
  
  artists.forEach((artist, index) => {
    const date = artist.date;
    const stage = artist.stage || 1;
    
    console.log(`🎯 Processing artist ${index}: ${artist.name}, date=${date}, stage=${stage}`);
    
    if (!date) {
      console.log(`🎯 Skipping artist ${artist.name} - no date`);
      return;
    }
    
    if (!organized.has(date)) {
      organized.set(date, new Map());
    }
    
    if (!organized.get(date)!.has(stage)) {
      organized.get(date)!.set(stage, []);
    }
    
    organized.get(date)!.get(stage)!.push(artist);
  });
  
  console.log('🎯 Organization complete:');
  Array.from(organized.entries()).forEach(([date, stages]) => {
    console.log(`🎯 Date ${date}: ${stages.size} stages`);
    Array.from(stages.entries()).forEach(([stage, stageArtists]) => {
      console.log(`🎯   Stage ${stage}: ${stageArtists.length} artists`);
    });
  });
  
  return organized;
};
