
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
  
  console.log('🎯 FIXED: Starting PDF generation');
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
        wiredMicsContent: a.wired_mics,
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
      
      // Job title
      pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.text(data.jobTitle, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 20;
      
      // FIXED: Date formatting
      const formattedDate = formatDateProperly(date);
      console.log(`🎯 Date formatting: "${date}" -> "${formattedDate}"`);
      
      pdf.setFillColor(headerGray[0], headerGray[1], headerGray[2]);
      pdf.rect(margin, yPosition - 5, pageWidth - (margin * 2), 20, 'F');
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${formattedDate} - Stage ${stage}`, pageWidth / 2, yPosition + 8, { align: 'center' });
      yPosition += 30;
      
      // FIXED: Generate matrix data with correct individual values and peak calculation
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
      pdf.text('Note: Individual cells show artist requirements. Peak column shows maximum concurrent usage based on show schedules.', margin, yPosition);
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

// FIXED: Date formatting function
const formatDateProperly = (dateString: string): string => {
  console.log(`🎯 formatDateProperly called with: "${dateString}"`);
  
  try {
    // Handle YYYY-MM-DD format directly without Date constructor timezone issues
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
      
      // Create date using UTC to avoid timezone issues
      const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
      
      // Format manually to avoid timezone issues
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
      
      const weekday = weekdays[date.getUTCDay()];
      const monthName = months[date.getUTCMonth()];
      
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

// COMPLETELY FIXED: Matrix data generation with correct individual values and timeline-based peak calculation
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
  
  // STEP 1: Build individual requirements - ULTRA FIXED: Complete isolation per artist
  artists.forEach((artist, index) => {
    const artistName = artist.name || `Artist ${index + 1}`;
    artistNamesSet.add(artistName);
    
    console.log(`🎯 ===== Processing artist: ${artistName} =====`);
    console.log(`🎯 Raw wired_mics:`, JSON.stringify(artist.wired_mics, null, 2));
    
    if (!artist.wired_mics || !Array.isArray(artist.wired_mics)) {
      console.log(`🎯 No valid wired_mics array for ${artistName}`);
      return;
    }
    
    // ULTRA FIXED: Completely isolated processing per artist
    const artistMicRequirements: Record<string, number> = {};
    
    // Process each mic entry for this artist
    artist.wired_mics.forEach((micEntry: any, entryIndex: number) => {
      console.log(`🎯 Processing mic entry ${entryIndex} for ${artistName}:`, JSON.stringify(micEntry, null, 2));
      
      if (!micEntry || typeof micEntry !== 'object') {
        console.log(`🎯 Skipping invalid mic entry ${entryIndex} - not an object`);
        return;
      }
      
      if (!micEntry.model || micEntry.quantity === undefined || micEntry.quantity === null) {
        console.log(`🎯 Skipping invalid mic entry ${entryIndex} - missing model or quantity`);
        return;
      }
      
      const micModel = String(micEntry.model).trim();
      const quantity = parseInt(String(micEntry.quantity)) || 0;
      
      console.log(`🎯 Parsed: ${micModel} = ${quantity} for ${artistName}`);
      
      if (quantity <= 0) {
        console.log(`🎯 Skipping zero/negative quantity for ${micModel}`);
        return;
      }
      
      micModelsSet.add(micModel);
      
      // ULTRA SAFE: Accumulate within this artist's requirements only
      if (!artistMicRequirements[micModel]) {
        artistMicRequirements[micModel] = 0;
      }
      artistMicRequirements[micModel] += quantity;
      console.log(`🎯 Artist ${artistName} temp total for ${micModel}: ${artistMicRequirements[micModel]}`);
    });
    
    // ULTRA SAFE: Set final requirements for this artist with complete isolation
    Object.entries(artistMicRequirements).forEach(([micModel, totalQuantity]) => {
      console.log(`🎯 Setting final requirement: ${micModel}[${artistName}] = ${totalQuantity}`);
      
      // Initialize mic model if not exists
      if (!individualMatrix[micModel]) {
        individualMatrix[micModel] = {};
        console.log(`🎯 Created new mic model entry: ${micModel}`);
      }
      
      // ULTRA CRITICAL: Absolutely no accumulation - direct assignment only
      individualMatrix[micModel][artistName] = totalQuantity;
      console.log(`🎯 ✅ CONFIRMED: ${micModel}[${artistName}] = ${individualMatrix[micModel][artistName]}`);
    });
    
    console.log(`🎯 ===== Completed artist: ${artistName} =====`);
  });
  
  console.log('🎯 ===== INDIVIDUAL MATRIX FINAL STATE =====');
  Object.entries(individualMatrix).forEach(([micModel, artistMap]) => {
    const entries = Object.entries(artistMap).map(([artist, qty]) => `${artist}=${qty}`);
    const total = Object.values(artistMap).reduce((sum, qty) => sum + qty, 0);
    console.log(`🎯 ${micModel}: ${entries.join(', ')} [SUM: ${total}]`);
  });
  console.log('🎯 ===== END INDIVIDUAL MATRIX =====');
  
  // STEP 2: Calculate peak concurrent usage - ULTRA FIXED: Timeline-based analysis with debugging
  const peakConcurrentMatrix: Record<string, number> = {};
  
  console.log('🎯 ===== CALCULATING PEAK CONCURRENT USAGE =====');
  
  // Convert show times to minutes for easier calculation
  const parseTimeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  };
  
  // Prepare artist timeline data
  const artistTimelines = artists.map(artist => ({
    name: artist.name,
    startMinutes: parseTimeToMinutes(artist.show_start),
    endMinutes: parseTimeToMinutes(artist.show_end),
    micRequirements: artist.wired_mics || []
  })).filter(artist => artist.startMinutes > 0 && artist.endMinutes > artist.startMinutes);
  
  console.log('🎯 Artist timelines:', artistTimelines.map(a => ({
    name: a.name,
    start: a.startMinutes,
    end: a.endMinutes,
    duration: a.endMinutes - a.startMinutes
  })));
  
  // For each microphone model, find the peak concurrent usage
  micModelsSet.forEach(micModel => {
    console.log(`🎯 ===== PROCESSING PEAK FOR: ${micModel} =====`);
    
    let maxConcurrentUsage = 0;
    
    // ULTRA SAFE: Use individual matrix values directly for simple case
    if (artistTimelines.length === 0) {
      console.log(`🎯 No timeline data, using individual matrix sum for ${micModel}`);
      const artistRequirements = individualMatrix[micModel] || {};
      maxConcurrentUsage = Object.values(artistRequirements).reduce((sum, qty) => sum + qty, 0);
      console.log(`🎯 Simple sum for ${micModel}: ${maxConcurrentUsage}`);
    } else {
      // Create timeline events (start/end of each artist's performance)
      const events: Array<{time: number, type: 'start' | 'end', artist: string, micQuantity: number}> = [];
      
      artistTimelines.forEach(artist => {
        // Get this artist's requirement from the individual matrix (NOT from raw data)
        const artistMicQuantity = individualMatrix[micModel]?.[artist.name] || 0;
        
        console.log(`🎯 Artist ${artist.name} requires ${artistMicQuantity} units of ${micModel}`);
        
        if (artistMicQuantity > 0) {
          events.push({
            time: artist.startMinutes,
            type: 'start',
            artist: artist.name,
            micQuantity: artistMicQuantity
          });
          events.push({
            time: artist.endMinutes,
            type: 'end',
            artist: artist.name,
            micQuantity: artistMicQuantity
          });
        }
      });
      
      // Sort events by time, with 'end' events before 'start' events at the same time
      events.sort((a, b) => {
        if (a.time !== b.time) return a.time - b.time;
        return a.type === 'end' ? -1 : 1; // End events first at same time
      });
      
      console.log(`🎯 Timeline events for ${micModel}:`, events);
      
      // Process events to find peak usage
      let currentUsage = 0;
      events.forEach(event => {
        if (event.type === 'start') {
          currentUsage += event.micQuantity;
          maxConcurrentUsage = Math.max(maxConcurrentUsage, currentUsage);
          console.log(`🎯 ${micModel} - Time ${event.time}: START ${event.artist} (+${event.micQuantity}) -> Current: ${currentUsage}, Max: ${maxConcurrentUsage}`);
        } else {
          currentUsage -= event.micQuantity;
          console.log(`🎯 ${micModel} - Time ${event.time}: END ${event.artist} (-${event.micQuantity}) -> Current: ${currentUsage}`);
        }
      });
      
      // ULTRA SAFE: Fallback to individual matrix sum if timeline gives zero
      if (maxConcurrentUsage === 0 && Object.keys(individualMatrix[micModel] || {}).length > 0) {
        console.log(`🎯 Timeline gave zero for ${micModel}, using individual matrix fallback`);
        const artistRequirements = individualMatrix[micModel] || {};
        maxConcurrentUsage = Object.values(artistRequirements).reduce((sum, qty) => sum + qty, 0);
        console.log(`🎯 Fallback sum for ${micModel}: ${maxConcurrentUsage}`);
      }
    }
    
    peakConcurrentMatrix[micModel] = maxConcurrentUsage;
    console.log(`🎯 ✅ FINAL Peak for ${micModel}: ${maxConcurrentUsage}`);
    console.log(`🎯 ===== END PEAK FOR: ${micModel} =====`);
  });
  
  const result = {
    micModels: Array.from(micModelsSet).sort(),
    artistNames: Array.from(artistNamesSet).sort(),
    individualMatrix,
    peakConcurrentMatrix
  };
  
  console.log('🎯 Final matrix data (COMPLETELY FIXED):', {
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

// ENHANCED: Helper function to organize artists by date and stage with better debugging
export const organizeArtistsByDateAndStage = (artists: any[]): Map<string, Map<number, any[]>> => {
  const organized = new Map<string, Map<number, any[]>>();
  
  console.log('🎯 organizeArtistsByDateAndStage called with:', {
    totalArtists: artists.length,
    sampleArtists: artists.slice(0, 5).map(a => ({
      name: a.name,
      date: a.date,
      stage: a.stage,
      wiredMicsCount: a.wired_mics?.length || 0,
      showStart: a.show_start,
      showEnd: a.show_end
    }))
  });
  
  // First pass: collect all unique dates and stages
  const allDates = new Set<string>();
  const allStages = new Set<number>();
  
  artists.forEach(artist => {
    if (artist.date) allDates.add(artist.date);
    if (artist.stage) allStages.add(artist.stage);
  });
  
  console.log('🎯 Detected dates:', Array.from(allDates).sort());
  console.log('🎯 Detected stages:', Array.from(allStages).sort());
  
  // Second pass: organize artists
  artists.forEach((artist, index) => {
    const date = artist.date;
    const stage = artist.stage || 1;
    
    console.log(`🎯 Processing artist ${index}: ${artist.name}, date="${date}", stage=${stage}`);
    
    if (!date) {
      console.warn(`🎯 WARNING: Skipping artist ${artist.name} - missing date`);
      return;
    }
    
    if (!organized.has(date)) {
      console.log(`🎯 Creating new date entry: ${date}`);
      organized.set(date, new Map());
    }
    
    if (!organized.get(date)!.has(stage)) {
      console.log(`🎯 Creating new stage entry: ${date} - Stage ${stage}`);
      organized.get(date)!.set(stage, []);
    }
    
    organized.get(date)!.get(stage)!.push(artist);
    console.log(`🎯 Added ${artist.name} to ${date} - Stage ${stage}`);
  });
  
  console.log('🎯 Organization complete - Final structure:');
  Array.from(organized.entries()).forEach(([date, stages]) => {
    console.log(`🎯 📅 Date ${date}: ${stages.size} stages`);
    Array.from(stages.entries()).forEach(([stage, stageArtists]) => {
      console.log(`🎯   🎪 Stage ${stage}: ${stageArtists.length} artists - ${stageArtists.map(a => a.name).join(', ')}`);
    });
  });
  
  // Validation: Ensure we're generating the expected number of pages
  const totalPages = Array.from(organized.values()).reduce((total, stages) => total + stages.size, 0);
  console.log(`🎯 Expected PDF pages: ${totalPages}`);
  
  return organized;
};
