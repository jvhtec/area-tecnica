
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
  
  console.log('🔧 COMPLETE REWRITE: Starting PDF generation with data:', {
    totalDates: data.artistsByDateAndStage.size,
    dates: Array.from(data.artistsByDateAndStage.keys()),
    allDateStageEntries: Array.from(data.artistsByDateAndStage.entries()).map(([date, stagesMap]) => ({
      date,
      stages: Array.from(stagesMap.keys()),
      totalArtists: Array.from(stagesMap.values()).reduce((sum, artists) => sum + artists.length, 0)
    }))
  });
  
  // Process each date
  for (const [date, stagesMap] of data.artistsByDateAndStage.entries()) {
    console.log(`🔧 REWRITE: Processing date: ${date} with ${stagesMap.size} stages`);
    
    // Process each stage within the date
    for (const [stage, artists] of stagesMap.entries()) {
      console.log(`🔧 REWRITE: Processing ${date} Stage ${stage} with ${artists.length} artists:`, 
        artists.map(a => ({ 
          name: a.name, 
          wiredMicsRaw: a.wired_mics,
          wiredMicsCount: a.wired_mics?.length || 0,
          showStart: a.show_start,
          showEnd: a.show_end
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
      
      // Job title and date/stage info
      pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.text(data.jobTitle, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 20;
      
      // FIXED: Proper date parsing and formatting - COMPLETELY REWRITTEN
      const dateStr = formatDateForDisplay(date);
      
      pdf.setFillColor(headerGray[0], headerGray[1], headerGray[2]);
      pdf.rect(margin, yPosition - 5, pageWidth - (margin * 2), 20, 'F');
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${dateStr} - Stage ${stage}`, pageWidth / 2, yPosition + 8, { align: 'center' });
      yPosition += 30;
      
      // COMPLETELY REWRITTEN: Generate matrix data with fixed logic
      const matrixData = generateCorrectedMatrixData(artists);
      
      console.log(`🔧 REWRITE: Matrix data for ${date} Stage ${stage}:`, {
        micModels: matrixData.micModels,
        artistCount: matrixData.artistNames.length,
        artistNames: matrixData.artistNames,
        individualMatrixSample: Object.entries(matrixData.individualMatrix).slice(0, 2).map(([model, artists]) => ({
          model,
          artists: Object.entries(artists).slice(0, 3)
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
        
        // Use the corrected peak concurrent quantity
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

// COMPLETELY REWRITTEN: Fixed date formatting function
const formatDateForDisplay = (dateString: string): string => {
  console.log(`🔧 REWRITE: Formatting date string: "${dateString}"`);
  
  try {
    // Handle YYYY-MM-DD format properly
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const parts = dateString.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      
      // Validate the date parts
      if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
        console.error(`🔧 REWRITE: Invalid date parts: year=${year}, month=${month}, day=${day}`);
        return dateString;
      }
      
      // Create date correctly (month is 0-indexed in Date constructor)
      const date = new Date(year, month - 1, day);
      
      // Verify the date was created correctly
      if (date.getFullYear() !== year || date.getMonth() !== (month - 1) || date.getDate() !== day) {
        console.error(`🔧 REWRITE: Date creation failed for ${dateString}`);
        return dateString;
      }
      
      const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
      const monthName = date.toLocaleDateString('en-US', { month: 'long' });
      
      const formatted = `${weekday}, ${monthName} ${day}, ${year}`;
      console.log(`🔧 REWRITE: Successfully formatted "${dateString}" to "${formatted}"`);
      return formatted;
    }
    
    // Fallback for other formats
    console.log(`🔧 REWRITE: Using fallback formatting for non-standard date: ${dateString}`);
    return dateString;
    
  } catch (error) {
    console.error(`🔧 REWRITE: Error formatting date "${dateString}":`, error);
    return dateString;
  }
};

interface CorrectedMatrixData {
  micModels: string[];
  artistNames: string[];
  individualMatrix: Record<string, Record<string, number>>;
  peakConcurrentMatrix: Record<string, number>;
}

// COMPLETELY REWRITTEN: Fixed matrix data generation
const generateCorrectedMatrixData = (artists: any[]): CorrectedMatrixData => {
  console.log('🔧 REWRITE: generateCorrectedMatrixData called with:', {
    artistCount: artists.length,
    artistsWithWiredMics: artists.filter(a => a.wired_mics && a.wired_mics.length > 0).length,
    rawArtistData: artists.map(a => ({
      name: a.name,
      wiredMics: a.wired_mics,
      showStart: a.show_start,
      showEnd: a.show_end
    }))
  });
  
  const micModelsSet = new Set<string>();
  const artistNamesSet = new Set<string>();
  const individualMatrix: Record<string, Record<string, number>> = {};
  
  // STEP 1: Build individual requirements matrix - COMPLETELY FIXED
  artists.forEach((artist, artistIndex) => {
    const artistName = artist.name || `Artist ${artistIndex + 1}`;
    artistNamesSet.add(artistName);
    
    console.log(`🔧 REWRITE: Processing artist #${artistIndex}: ${artistName}`);
    console.log(`🔧 REWRITE: Raw wired_mics data:`, artist.wired_mics);
    
    if (!artist.wired_mics || !Array.isArray(artist.wired_mics)) {
      console.log(`🔧 REWRITE: Artist ${artistName} has no wired mics or invalid format`);
      return;
    }
    
    // CRITICAL FIX: Process each mic entry directly, no aggregation
    artist.wired_mics.forEach((micEntry: any, micIndex: number) => {
      console.log(`🔧 REWRITE: Processing mic entry #${micIndex} for ${artistName}:`, micEntry);
      
      if (!micEntry.model || micEntry.quantity === undefined || micEntry.quantity === null) {
        console.log(`🔧 REWRITE: Skipping invalid mic entry #${micIndex}:`, micEntry);
        return;
      }
      
      const micModel = String(micEntry.model).trim();
      const quantity = parseInt(String(micEntry.quantity)) || 0;
      
      console.log(`🔧 REWRITE: Valid mic entry: model="${micModel}", quantity=${quantity}`);
      
      if (quantity <= 0) {
        console.log(`🔧 REWRITE: Skipping zero/negative quantity: ${quantity} for ${micModel}`);
        return;
      }
      
      micModelsSet.add(micModel);
      
      // Initialize matrix structure
      if (!individualMatrix[micModel]) {
        individualMatrix[micModel] = {};
      }
      
      // CRITICAL FIX: Add quantity to existing value (not replace)
      // This handles cases where an artist has multiple entries for the same mic model
      if (!individualMatrix[micModel][artistName]) {
        individualMatrix[micModel][artistName] = 0;
      }
      individualMatrix[micModel][artistName] += quantity;
      
      console.log(`🔧 REWRITE: Updated individual matrix: ${micModel}[${artistName}] = ${individualMatrix[micModel][artistName]}`);
    });
  });
  
  console.log('🔧 REWRITE: Final individual matrix:');
  Object.entries(individualMatrix).forEach(([micModel, artistData]) => {
    const entries = Object.entries(artistData).map(([artist, qty]) => `${artist}=${qty}`);
    console.log(`🔧 REWRITE: ${micModel}: ${entries.join(', ')}`);
  });
  
  // STEP 2: Calculate peak concurrent usage - SIMPLIFIED APPROACH
  const peakConcurrentMatrix: Record<string, number> = {};
  
  console.log('🔧 REWRITE: Calculating peak concurrent usage...');
  
  // Group artists by time slots for concurrent analysis
  const timeSlots = createTimeSlots(artists);
  console.log('🔧 REWRITE: Time slots created:', timeSlots);
  
  // For each microphone model, find the maximum concurrent usage
  micModelsSet.forEach(micModel => {
    let maxConcurrent = 0;
    let maxConcurrentDetails = '';
    
    timeSlots.forEach((artistsInSlot, slotIndex) => {
      let concurrentUsage = 0;
      const artistsInThisSlot: string[] = [];
      
      artistsInSlot.forEach(artist => {
        const artistName = artist.name || 'Unknown';
        const artistUsage = individualMatrix[micModel]?.[artistName] || 0;
        if (artistUsage > 0) {
          concurrentUsage += artistUsage;
          artistsInThisSlot.push(`${artistName}(${artistUsage})`);
        }
      });
      
      if (concurrentUsage > maxConcurrent) {
        maxConcurrent = concurrentUsage;
        maxConcurrentDetails = `Slot ${slotIndex}: ${artistsInThisSlot.join(', ')}`;
      }
      
      console.log(`🔧 REWRITE: ${micModel} slot ${slotIndex}: ${concurrentUsage} units from [${artistsInThisSlot.join(', ')}]`);
    });
    
    peakConcurrentMatrix[micModel] = maxConcurrent;
    console.log(`🔧 REWRITE: Peak for ${micModel}: ${maxConcurrent} (${maxConcurrentDetails})`);
  });
  
  const result = {
    micModels: Array.from(micModelsSet).sort(),
    artistNames: Array.from(artistNamesSet).sort(),
    individualMatrix,
    peakConcurrentMatrix
  };
  
  console.log('🔧 REWRITE: Final result summary:', {
    micModelCount: result.micModels.length,
    artistCount: result.artistNames.length,
    individualMatrixKeys: Object.keys(result.individualMatrix),
    peakMatrixEntries: Object.entries(result.peakConcurrentMatrix)
  });
  
  return result;
};

// SIMPLIFIED: Create time slots for peak concurrent calculation
const createTimeSlots = (artists: any[]): any[][] => {
  console.log('🔧 REWRITE: Creating time slots for artists:', artists.map(a => ({
    name: a.name,
    start: a.show_start,
    end: a.show_end
  })));
  
  // Simple approach: if artists have overlapping times, they're concurrent
  // For now, we'll create basic slots based on show times
  const slots: any[][] = [];
  
  // Group artists by their show times
  const timeGroups = new Map<string, any[]>();
  
  artists.forEach(artist => {
    if (artist.show_start) {
      const timeKey = artist.show_start;
      if (!timeGroups.has(timeKey)) {
        timeGroups.set(timeKey, []);
      }
      timeGroups.get(timeKey)!.push(artist);
    }
  });
  
  // Convert time groups to slots
  timeGroups.forEach((artistGroup, timeKey) => {
    slots.push(artistGroup);
    console.log(`🔧 REWRITE: Time slot for ${timeKey}:`, artistGroup.map(a => a.name));
  });
  
  // If no time information, treat all artists as potentially concurrent
  if (slots.length === 0) {
    console.log('🔧 REWRITE: No time information found, treating all artists as concurrent');
    slots.push(artists);
  }
  
  return slots;
};

// ENHANCED: Helper function to organize artists by date and stage
export const organizeArtistsByDateAndStage = (artists: any[]): Map<string, Map<number, any[]>> => {
  const organized = new Map<string, Map<number, any[]>>();
  
  console.log('🔧 REWRITE: organizeArtistsByDateAndStage called with:', {
    totalArtists: artists.length,
    artistsWithDates: artists.filter(a => a.date).length,
    uniqueDates: [...new Set(artists.map(a => a.date))].filter(Boolean),
    uniqueStages: [...new Set(artists.map(a => a.stage))].filter(s => s !== undefined && s !== null),
    sampleArtists: artists.slice(0, 3).map(a => ({
      name: a.name,
      date: a.date,
      stage: a.stage,
      wiredMics: a.wired_mics?.length || 0
    }))
  });
  
  artists.forEach((artist, index) => {
    const date = artist.date;
    const stage = artist.stage || 1;
    
    console.log(`🔧 REWRITE: Artist #${index}: ${artist.name}, date=${date}, stage=${stage}`);
    
    if (!date) {
      console.log(`🔧 REWRITE: Skipping artist ${artist.name} - no date`);
      return;
    }
    
    if (!organized.has(date)) {
      organized.set(date, new Map());
      console.log(`🔧 REWRITE: Created new date entry: ${date}`);
    }
    
    if (!organized.get(date)!.has(stage)) {
      organized.get(date)!.set(stage, []);
      console.log(`🔧 REWRITE: Created new stage entry: ${date} -> stage ${stage}`);
    }
    
    organized.get(date)!.get(stage)!.push(artist);
    console.log(`🔧 REWRITE: Added ${artist.name} to ${date} stage ${stage} (now ${organized.get(date)!.get(stage)!.length} artists)`);
  });
  
  console.log('🔧 REWRITE: Final organized structure:'); 
  Array.from(organized.entries()).forEach(([date, stages]) => {
    console.log(`🔧 REWRITE: Date ${date}:`);
    Array.from(stages.entries()).forEach(([stage, stageArtists]) => {
      console.log(`🔧 REWRITE:   Stage ${stage}: ${stageArtists.length} artists (${stageArtists.map(a => a.name).join(', ')})`);
    });
  });
  
  return organized;
};
