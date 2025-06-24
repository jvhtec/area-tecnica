
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
  
  console.log('🔥 FINAL FIX: Starting PDF generation with data:', {
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
    console.log(`🔥 FINAL FIX: Processing date: ${date} with ${stagesMap.size} stages`);
    
    // Process each stage within the date
    for (const [stage, artists] of stagesMap.entries()) {
      console.log(`🔥 FINAL FIX: Processing ${date} Stage ${stage} with ${artists.length} artists:`, 
        artists.map(a => ({ 
          name: a.name, 
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
      
      // FIXED: Proper date parsing and formatting
      const dateStr = formatDateForPDF(date);
      
      pdf.setFillColor(headerGray[0], headerGray[1], headerGray[2]);
      pdf.rect(margin, yPosition - 5, pageWidth - (margin * 2), 20, 'F');
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${dateStr} - Stage ${stage}`, pageWidth / 2, yPosition + 8, { align: 'center' });
      yPosition += 30;
      
      // FIXED: Generate matrix data with completely rewritten logic
      const matrixData = generateFixedMatrixData(artists);
      
      console.log(`🔥 FINAL FIX: Matrix data for ${date} Stage ${stage}:`, {
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
        
        // Use the fixed peak concurrent quantity
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

// FIXED: Proper date formatting function
const formatDateForPDF = (dateString: string): string => {
  try {
    // Parse the date string (expected format: YYYY-MM-DD)
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed in Date constructor
    
    const weekday = date.toLocaleDateString(undefined, { weekday: 'long' });
    const monthName = date.toLocaleDateString(undefined, { month: 'long' });
    
    return `${weekday}, ${monthName} ${day}, ${year}`;
  } catch (error) {
    console.error('🔥 FINAL FIX: Error formatting date:', error, 'Original:', dateString);
    return dateString; // fallback to original string
  }
};

interface FixedMatrixData {
  micModels: string[];
  artistNames: string[];
  individualMatrix: Record<string, Record<string, number>>;
  peakConcurrentMatrix: Record<string, number>;
}

// COMPLETELY REWRITTEN: Fixed matrix data generation
const generateFixedMatrixData = (artists: any[]): FixedMatrixData => {
  const micModelsSet = new Set<string>();
  const artistNamesSet = new Set<string>();
  const individualMatrix: Record<string, Record<string, number>> = {};
  
  console.log('🔥 FINAL FIX: generateFixedMatrixData called with:', {
    artistCount: artists.length,
    artistsWithWiredMics: artists.filter(a => a.wired_mics && a.wired_mics.length > 0).length,
    artistDetails: artists.map(a => ({
      name: a.name,
      wiredMicsCount: a.wired_mics?.length || 0,
      showStart: a.show_start,
      showEnd: a.show_end
    }))
  });
  
  // FIRST PASS: Build individual requirements matrix - COMPLETELY FIXED
  artists.forEach((artist, artistIndex) => {
    if (!artist.wired_mics || !Array.isArray(artist.wired_mics)) {
      console.log(`🔥 FINAL FIX: Artist #${artistIndex} ${artist.name} has no wired mics or invalid format`);
      return;
    }
    
    const artistName = artist.name || 'Unknown Artist';
    artistNamesSet.add(artistName);
    
    console.log(`🔥 FINAL FIX: Processing artist #${artistIndex}: ${artistName} with ${artist.wired_mics.length} wired mic entries`);
    
    // FIXED: Process each microphone entry for this artist with proper aggregation
    const artistMicTotals: Record<string, number> = {};
    
    artist.wired_mics.forEach((mic: any, micIndex: number) => {
      if (!mic.model || mic.quantity === undefined || mic.quantity === null) {
        console.log(`🔥 FINAL FIX: Skipping invalid mic entry #${micIndex} for ${artistName}:`, mic);
        return;
      }
      
      const micModel = mic.model.trim();
      const rawQuantity = parseInt(String(mic.quantity)) || 0;
      
      console.log(`🔥 FINAL FIX: ${artistName} mic #${micIndex}: model="${micModel}", quantity=${rawQuantity}`);
      
      if (rawQuantity <= 0) {
        console.log(`🔥 FINAL FIX: Skipping zero/negative quantity for ${artistName}: ${micModel}`);
        return;
      }
      
      micModelsSet.add(micModel);
      
      // FIXED: Aggregate quantities for same mic model from same artist
      if (!artistMicTotals[micModel]) {
        artistMicTotals[micModel] = 0;
      }
      artistMicTotals[micModel] += rawQuantity;
      
      console.log(`🔥 FINAL FIX: ${artistName} total for ${micModel}: ${artistMicTotals[micModel]}`);
    });
    
    // FIXED: Set final totals for this artist (no more accumulation bugs)
    Object.entries(artistMicTotals).forEach(([micModel, totalQuantity]) => {
      if (!individualMatrix[micModel]) {
        individualMatrix[micModel] = {};
      }
      
      // CRITICAL FIX: Direct assignment, no accumulation
      individualMatrix[micModel][artistName] = totalQuantity;
      console.log(`🔥 FINAL FIX: SET final individual matrix: ${micModel}[${artistName}] = ${totalQuantity}`);
    });
  });
  
  console.log('🔥 FINAL FIX: Individual matrix after processing all artists:');
  Object.entries(individualMatrix).forEach(([micModel, artistData]) => {
    console.log(`🔥 FINAL FIX: ${micModel}:`, Object.entries(artistData).map(([artist, qty]) => `${artist}=${qty}`).join(', '));
  });
  
  // SECOND PASS: Calculate peak concurrent usage - FIXED ALGORITHM
  const peakConcurrentMatrix: Record<string, number> = {};
  
  // Sort artists by show time for timeline analysis
  const sortedArtists = [...artists].sort((a, b) => {
    const timeA = a.show_start || '';
    const timeB = b.show_start || '';
    return timeA.localeCompare(timeB);
  });
  
  console.log('🔥 FINAL FIX: Timeline analysis for peak calculation:', 
    sortedArtists.map(a => ({ 
      name: a.name, 
      start: a.show_start, 
      end: a.show_end 
    })));
  
  // For each microphone model, calculate peak concurrent usage
  for (const micModel of micModelsSet) {
    console.log(`🔥 FINAL FIX: Calculating peak concurrent for ${micModel}`);
    
    // Create timeline events for this mic model
    const events: Array<{ 
      time: string; 
      quantity: number; 
      type: 'start' | 'end'; 
      artist: string 
    }> = [];
    
    sortedArtists.forEach(artist => {
      const artistName = artist.name || 'Unknown Artist';
      const artistQuantity = individualMatrix[micModel]?.[artistName] || 0;
      
      if (artistQuantity > 0 && artist.show_start && artist.show_end) {
        events.push({
          time: artist.show_start,
          quantity: artistQuantity,
          type: 'start',
          artist: artistName
        });
        events.push({
          time: artist.show_end,
          quantity: artistQuantity,
          type: 'end',
          artist: artistName
        });
        
        console.log(`🔥 FINAL FIX: ${micModel} timeline: ${artistName} needs ${artistQuantity} from ${artist.show_start} to ${artist.show_end}`);
      }
    });
    
    // Sort events by time, with 'end' events before 'start' events at the same time
    events.sort((a, b) => {
      const timeCompare = a.time.localeCompare(b.time);
      if (timeCompare !== 0) return timeCompare;
      // At same time: process 'end' before 'start' to handle back-to-back shows
      return a.type === 'end' ? -1 : 1;
    });
    
    console.log(`🔥 FINAL FIX: ${micModel} sorted timeline events:`, events);
    
    // Calculate peak concurrent usage using timeline sweep
    let currentUsage = 0;
    let peakUsage = 0;
    let peakDetails = '';
    
    events.forEach(event => {
      if (event.type === 'start') {
        currentUsage += event.quantity;
        if (currentUsage > peakUsage) {
          peakUsage = currentUsage;
          peakDetails = `at ${event.time} (${event.artist} started)`;
        }
        console.log(`🔥 FINAL FIX: ${event.time}: +${event.quantity} (${event.artist} start) -> current: ${currentUsage}`);
      } else {
        currentUsage -= event.quantity;
        console.log(`🔥 FINAL FIX: ${event.time}: -${event.quantity} (${event.artist} end) -> current: ${currentUsage}`);
      }
    });
    
    peakConcurrentMatrix[micModel] = peakUsage;
    console.log(`🔥 FINAL FIX: Peak for ${micModel}: ${peakUsage} ${peakDetails}`);
  }
  
  const result = {
    micModels: Array.from(micModelsSet).sort(),
    artistNames: Array.from(artistNamesSet).sort(),
    individualMatrix,
    peakConcurrentMatrix
  };
  
  console.log('🔥 FINAL FIX: Final matrix result summary:', {
    micModelCount: result.micModels.length,
    artistCount: result.artistNames.length,
    individualMatrixKeys: Object.keys(result.individualMatrix),
    peakMatrixKeys: Object.keys(result.peakConcurrentMatrix),
    peakValues: Object.entries(result.peakConcurrentMatrix)
  });
  
  return result;
};

// Helper function to organize artists by date and stage - ENHANCED WITH DEBUGGING
export const organizeArtistsByDateAndStage = (artists: any[]): Map<string, Map<number, any[]>> => {
  const organized = new Map<string, Map<number, any[]>>();
  
  console.log('🔥 FINAL FIX: organizeArtistsByDateAndStage called with:', {
    totalArtists: artists.length,
    artistsWithDates: artists.filter(a => a.date).length,
    uniqueDates: [...new Set(artists.map(a => a.date))].filter(Boolean),
    uniqueStages: [...new Set(artists.map(a => a.stage))].filter(s => s !== undefined && s !== null)
  });
  
  artists.forEach((artist, index) => {
    const date = artist.date;
    const stage = artist.stage || 1;
    
    console.log(`🔥 FINAL FIX: Artist #${index}: ${artist.name}, date=${date}, stage=${stage}, showStart=${artist.show_start}, showEnd=${artist.show_end}`);
    
    if (!date) {
      console.log(`🔥 FINAL FIX: Skipping artist ${artist.name} - no date`);
      return;
    }
    
    if (!organized.has(date)) {
      organized.set(date, new Map());
      console.log(`🔥 FINAL FIX: Created new date entry: ${date}`);
    }
    
    if (!organized.get(date)!.has(stage)) {
      organized.get(date)!.set(stage, []);
      console.log(`🔥 FINAL FIX: Created new stage entry: ${date} -> stage ${stage}`);
    }
    
    organized.get(date)!.get(stage)!.push(artist);
    console.log(`🔥 FINAL FIX: Added ${artist.name} to ${date} stage ${stage} (now ${organized.get(date)!.get(stage)!.length} artists)`);
  });
  
  console.log('🔥 FINAL FIX: Final organized structure summary:'); 
  Array.from(organized.entries()).forEach(([date, stages]) => {
    console.log(`🔥 FINAL FIX: Date ${date}:`);
    Array.from(stages.entries()).forEach(([stage, stageArtists]) => {
      console.log(`🔥 FINAL FIX:   Stage ${stage}: ${stageArtists.length} artists (${stageArtists.map(a => a.name).join(', ')})`);
    });
  });
  
  return organized;
};
