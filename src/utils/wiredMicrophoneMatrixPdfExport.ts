
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
  
  console.log('🎯 COMPLETE REWRITE: Starting PDF generation');
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
      
      // Date formatting
      const formattedDate = formatDateProperly(date);
      console.log(`🎯 Date formatting: "${date}" -> "${formattedDate}"`);
      
      pdf.setFillColor(headerGray[0], headerGray[1], headerGray[2]);
      pdf.rect(margin, yPosition - 5, pageWidth - (margin * 2), 20, 'F');
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${formattedDate} - Stage ${stage}`, pageWidth / 2, yPosition + 8, { align: 'center' });
      yPosition += 30;
      
      // Generate matrix data with completely fixed logic
      const matrixData = generateCompletelyFixedMatrixData(artists);
      
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
      pdf.text('Note: Individual cells show exact database quantities per artist. Peak column shows maximum concurrent usage considering exclusive items.', margin, yPosition);
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

// Date formatting function
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

// COMPLETELY REWRITTEN: Matrix data generation with exact database mapping
const generateCompletelyFixedMatrixData = (artists: any[]): FixedMatrixData => {
  console.log('🎯 ===== COMPLETELY REWRITTEN MATRIX GENERATION =====');
  console.log('🎯 Processing artists:', {
    artistCount: artists.length,
    artistDetails: artists.map(a => ({
      name: a.name,
      wiredMics: a.wired_mics,
      showStart: a.show_start,
      showEnd: a.show_end,
      isAfterMidnight: a.isaftermidnight
    }))
  });
  
  const micModelsSet = new Set<string>();
  const artistNamesSet = new Set<string>();
  const individualMatrix: Record<string, Record<string, number>> = {};
  
  // STEP 1: Build individual requirements - EXACT DATABASE MAPPING ONLY
  artists.forEach((artist, index) => {
    const artistName = artist.name || `Artist ${index + 1}`;
    artistNamesSet.add(artistName);
    
    console.log(`🎯 ===== PROCESSING ARTIST: ${artistName} =====`);
    console.log(`🎯 Raw database wired_mics:`, JSON.stringify(artist.wired_mics, null, 2));
    
    if (!artist.wired_mics || !Array.isArray(artist.wired_mics)) {
      console.log(`🎯 No wired_mics array for ${artistName} - skipping`);
      return;
    }
    
    // Process each mic entry EXACTLY as stored in database
    artist.wired_mics.forEach((micEntry: any, entryIndex: number) => {
      console.log(`🎯 Processing mic entry ${entryIndex}:`, JSON.stringify(micEntry, null, 2));
      
      if (!micEntry || typeof micEntry !== 'object') {
        console.log(`🎯 Invalid mic entry ${entryIndex} - not an object`);
        return;
      }
      
      if (!micEntry.model || micEntry.quantity === undefined || micEntry.quantity === null) {
        console.log(`🎯 Invalid mic entry ${entryIndex} - missing model or quantity`);
        return;
      }
      
      const micModel = String(micEntry.model).trim();
      const quantity = parseInt(String(micEntry.quantity)) || 0;
      
      if (quantity <= 0) {
        console.log(`🎯 Zero quantity for ${micModel} - skipping`);
        return;
      }
      
      console.log(`🎯 DATABASE VALUE: ${artistName} needs ${quantity} of ${micModel}`);
      
      micModelsSet.add(micModel);
      
      // Initialize mic model entry if needed
      if (!individualMatrix[micModel]) {
        individualMatrix[micModel] = {};
      }
      
      // CRITICAL: Store EXACT database value per artist
      if (!individualMatrix[micModel][artistName]) {
        individualMatrix[micModel][artistName] = 0;
      }
      individualMatrix[micModel][artistName] += quantity;
      
      console.log(`🎯 STORED IN MATRIX: ${micModel}[${artistName}] = ${individualMatrix[micModel][artistName]}`);
    });
    
    console.log(`🎯 ===== COMPLETED ARTIST: ${artistName} =====`);
  });
  
  // VERIFICATION: Log the complete individual matrix
  console.log('🎯 ===== INDIVIDUAL MATRIX VERIFICATION =====');
  Object.entries(individualMatrix).forEach(([micModel, artistMap]) => {
    const entries = Object.entries(artistMap).map(([artist, qty]) => `${artist}=${qty}`);
    console.log(`🎯 ${micModel}: ${entries.join(', ')}`);
  });
  console.log('🎯 ===== END INDIVIDUAL MATRIX VERIFICATION =====');
  
  // STEP 2: Calculate peak concurrent usage with exclusive use logic
  const peakConcurrentMatrix: Record<string, number> = {};
  
  console.log('🎯 ===== CALCULATING PEAK CONCURRENT USAGE =====');
  
  // Enhanced time parsing with after-midnight handling
  const parseTimeToMinutes = (timeStr: string, isAfterMidnight: boolean = false): number => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    const totalMinutes = (hours || 0) * 60 + (minutes || 0);
    // Add 24 hours if it's an after-midnight show
    return isAfterMidnight ? totalMinutes + 1440 : totalMinutes;
  };
  
  // Prepare artist timeline data with enhanced parsing
  const artistTimelines = artists.map(artist => ({
    name: artist.name,
    startMinutes: parseTimeToMinutes(artist.show_start, artist.isaftermidnight),
    endMinutes: parseTimeToMinutes(artist.show_end, artist.isaftermidnight),
    isAfterMidnight: artist.isaftermidnight,
    wiredMics: artist.wired_mics || []
  })).filter(artist => artist.startMinutes > 0 && artist.endMinutes > artist.startMinutes);
  
  console.log('🎯 Artist timelines with after-midnight handling:', artistTimelines.map(a => ({
    name: a.name,
    start: a.startMinutes,
    end: a.endMinutes,
    duration: a.endMinutes - a.startMinutes,
    isAfterMidnight: a.isAfterMidnight
  })));
  
  // For each microphone model, find the peak concurrent usage
  micModelsSet.forEach(micModel => {
    console.log(`🎯 ===== CALCULATING PEAK FOR: ${micModel} =====`);
    
    let maxConcurrentUsage = 0;
    
    if (artistTimelines.length === 0) {
      // No timeline data - use simple sum
      console.log(`🎯 No timeline data for ${micModel}, using sum`);
      const artistRequirements = individualMatrix[micModel] || {};
      maxConcurrentUsage = Object.values(artistRequirements).reduce((sum, qty) => sum + qty, 0);
      console.log(`🎯 Sum-based peak for ${micModel}: ${maxConcurrentUsage}`);
    } else {
      // Create timeline events with exclusive use consideration
      const events: Array<{
        time: number, 
        type: 'start' | 'end', 
        artist: string, 
        micQuantity: number,
        isExclusive: boolean
      }> = [];
      
      artistTimelines.forEach(artist => {
        // Get exact quantity from individual matrix
        const artistMicQuantity = individualMatrix[micModel]?.[artist.name] || 0;
        
        if (artistMicQuantity > 0) {
          // Check if this artist has exclusive use for this mic model
          const micEntry = artist.wiredMics.find((mic: any) => 
            String(mic.model).trim() === micModel
          );
          const isExclusive = micEntry?.exclusive_use === true;
          
          console.log(`🎯 ${artist.name} uses ${artistMicQuantity}x ${micModel} (exclusive: ${isExclusive})`);
          
          events.push({
            time: artist.startMinutes,
            type: 'start',
            artist: artist.name,
            micQuantity: artistMicQuantity,
            isExclusive
          });
          events.push({
            time: artist.endMinutes,
            type: 'end',
            artist: artist.name,
            micQuantity: artistMicQuantity,
            isExclusive
          });
        }
      });
      
      // Sort events by time, with 'end' events before 'start' events at the same time
      events.sort((a, b) => {
        if (a.time !== b.time) return a.time - b.time;
        return a.type === 'end' ? -1 : 1;
      });
      
      console.log(`🎯 Timeline events for ${micModel}:`, events);
      
      // Process events considering exclusive use
      let currentUsage = 0;
      let currentExclusiveUsers: string[] = [];
      
      events.forEach(event => {
        if (event.type === 'start') {
          if (event.isExclusive) {
            // Exclusive user takes all - others must wait
            currentUsage = event.micQuantity;
            currentExclusiveUsers = [event.artist];
            console.log(`🎯 ${micModel} - Time ${event.time}: EXCLUSIVE START ${event.artist} (${event.micQuantity}) -> Current: ${currentUsage}`);
          } else if (currentExclusiveUsers.length === 0) {
            // Only add if no exclusive users active
            currentUsage += event.micQuantity;
            console.log(`🎯 ${micModel} - Time ${event.time}: SHARED START ${event.artist} (+${event.micQuantity}) -> Current: ${currentUsage}`);
          } else {
            console.log(`🎯 ${micModel} - Time ${event.time}: BLOCKED START ${event.artist} (exclusive user active)`);
          }
          maxConcurrentUsage = Math.max(maxConcurrentUsage, currentUsage);
        } else {
          // End event
          if (event.isExclusive && currentExclusiveUsers.includes(event.artist)) {
            currentUsage = 0;
            currentExclusiveUsers = [];
            console.log(`🎯 ${micModel} - Time ${event.time}: EXCLUSIVE END ${event.artist} -> Current: ${currentUsage}`);
          } else if (!event.isExclusive && currentExclusiveUsers.length === 0) {
            currentUsage -= event.micQuantity;
            console.log(`🎯 ${micModel} - Time ${event.time}: SHARED END ${event.artist} (-${event.micQuantity}) -> Current: ${currentUsage}`);
          }
        }
      });
      
      // Fallback if timeline calculation gives zero but we have requirements
      if (maxConcurrentUsage === 0 && Object.keys(individualMatrix[micModel] || {}).length > 0) {
        console.log(`🎯 Timeline gave zero for ${micModel}, using individual matrix fallback`);
        const artistRequirements = individualMatrix[micModel] || {};
        maxConcurrentUsage = Object.values(artistRequirements).reduce((sum, qty) => sum + qty, 0);
        console.log(`🎯 Fallback peak for ${micModel}: ${maxConcurrentUsage}`);
      }
    }
    
    peakConcurrentMatrix[micModel] = maxConcurrentUsage;
    console.log(`🎯 ✅ FINAL PEAK for ${micModel}: ${maxConcurrentUsage}`);
    console.log(`🎯 ===== END PEAK FOR: ${micModel} =====`);
  });
  
  const result = {
    micModels: Array.from(micModelsSet).sort(),
    artistNames: Array.from(artistNamesSet).sort(),
    individualMatrix,
    peakConcurrentMatrix
  };
  
  console.log('🎯 ===== FINAL MATRIX RESULT =====');
  console.log('🎯 Mic models:', result.micModels);
  console.log('🎯 Artists:', result.artistNames);
  console.log('🎯 Individual matrix sample:', Object.entries(result.individualMatrix).slice(0, 2));
  console.log('🎯 Peak matrix sample:', Object.entries(result.peakConcurrentMatrix).slice(0, 3));
  console.log('🎯 ===== END FINAL MATRIX RESULT =====');
  
  return result;
};

// Helper function to organize artists by date and stage with better debugging
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
  
  return organized;
};
