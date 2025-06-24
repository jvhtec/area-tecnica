
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
  
  console.log('🔍 DEBUGGING: Processing dates:', Array.from(data.artistsByDateAndStage.keys()));
  console.log('🔍 DEBUGGING: Total dates found:', data.artistsByDateAndStage.size);
  
  // Process each date
  for (const [date, stagesMap] of data.artistsByDateAndStage.entries()) {
    console.log(`🔍 DEBUGGING: Processing date: ${date}`);
    console.log(`🔍 DEBUGGING: Stages for ${date}:`, Array.from(stagesMap.keys()));
    console.log(`🔍 DEBUGGING: Total stages for ${date}:`, stagesMap.size);
    
    // Process each stage within the date
    for (const [stage, artists] of stagesMap.entries()) {
      console.log(`🔍 DEBUGGING: Processing stage ${stage} on ${date}`);
      console.log(`🔍 DEBUGGING: Artists count for stage ${stage}:`, artists.length);
      console.log(`🔍 DEBUGGING: Artist names:`, artists.map(a => a.name));
      
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
      
      const dateStr = new Date(date).toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      pdf.setFillColor(headerGray[0], headerGray[1], headerGray[2]);
      pdf.rect(margin, yPosition - 5, pageWidth - (margin * 2), 20, 'F');
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${dateStr} - Stage ${stage}`, pageWidth / 2, yPosition + 8, { align: 'center' });
      yPosition += 30;
      
      // Generate matrix data with FIXED calculations
      const matrixData = generateFixedMatrixData(artists);
      
      console.log(`🔍 DEBUGGING: Matrix data for ${date} stage ${stage}:`, {
        micModels: matrixData.micModels,
        artistNames: matrixData.artistNames,
        individualMatrixSample: Object.keys(matrixData.individualMatrix).slice(0, 2).reduce((acc, key) => {
          acc[key] = matrixData.individualMatrix[key];
          return acc;
        }, {} as any),
        peakConcurrentSample: Object.keys(matrixData.peakConcurrentMatrix).slice(0, 2).reduce((acc, key) => {
          acc[key] = matrixData.peakConcurrentMatrix[key];
          return acc;
        }, {} as any)
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

interface FixedMatrixData {
  micModels: string[];
  artistNames: string[];
  individualMatrix: Record<string, Record<string, number>>;
  peakConcurrentMatrix: Record<string, number>;
}

const generateFixedMatrixData = (artists: any[]): FixedMatrixData => {
  const micModelsSet = new Set<string>();
  const artistNamesSet = new Set<string>();
  const individualMatrix: Record<string, Record<string, number>> = {};
  
  console.log('🔍 DEBUGGING: generateFixedMatrixData called with artists:', artists.length);
  console.log('🔍 DEBUGGING: Artists data:', artists.map(a => ({ 
    name: a.name, 
    wiredMicsLength: a.wired_mics?.length || 0,
    wiredMicsRaw: a.wired_mics,
    showStart: a.show_start,
    showEnd: a.show_end
  })));
  
  // FIRST PASS: Build individual requirements matrix using RAW DATABASE VALUES
  artists.forEach(artist => {
    if (!artist.wired_mics || !Array.isArray(artist.wired_mics)) {
      console.log(`🔍 DEBUGGING: Artist ${artist.name} has no wired_mics or invalid format`);
      return;
    }
    
    const artistName = artist.name || 'Unknown Artist';
    artistNamesSet.add(artistName);
    
    console.log(`🔍 DEBUGGING: Processing ${artistName} with ${artist.wired_mics.length} mic entries`);
    
    // Process each microphone entry for this artist
    artist.wired_mics.forEach((mic: any, micIndex: number) => {
      if (!mic.model || mic.quantity === undefined || mic.quantity === null) {
        console.log(`🔍 DEBUGGING: Skipping invalid mic #${micIndex} for ${artistName}:`, mic);
        return;
      }
      
      const micModel = mic.model.trim();
      const rawQuantity = parseInt(String(mic.quantity)) || 0;
      
      console.log(`🔍 DEBUGGING: ${artistName} - mic #${micIndex}: model="${micModel}", rawQuantity=${rawQuantity}`);
      
      if (rawQuantity <= 0) {
        console.log(`🔍 DEBUGGING: Skipping zero quantity mic for ${artistName}: ${micModel}`);
        return;
      }
      
      micModelsSet.add(micModel);
      
      // Initialize nested structure if needed
      if (!individualMatrix[micModel]) {
        individualMatrix[micModel] = {};
      }
      
      // CRITICAL FIX: Use raw quantity directly from database - NO CALCULATIONS!
      if (!individualMatrix[micModel][artistName]) {
        individualMatrix[micModel][artistName] = 0;
      }
      individualMatrix[micModel][artistName] += rawQuantity;
      
      console.log(`🔍 DEBUGGING: Set individual matrix: ${micModel}[${artistName}] = ${individualMatrix[micModel][artistName]}`);
    });
  });
  
  console.log('🔍 DEBUGGING: Individual matrix after first pass:');
  Object.keys(individualMatrix).forEach(micModel => {
    console.log(`🔍 DEBUGGING: ${micModel}:`, individualMatrix[micModel]);
  });
  
  // SECOND PASS: Calculate peak concurrent usage using timeline approach
  const peakConcurrentMatrix: Record<string, number> = {};
  
  // Sort artists by show time for timeline analysis
  const sortedArtists = [...artists].sort((a, b) => {
    const timeA = a.show_start || '';
    const timeB = b.show_start || '';
    return timeA.localeCompare(timeB);
  });
  
  console.log('🔍 DEBUGGING: Sorted artists for timeline:', sortedArtists.map(a => ({ 
    name: a.name, 
    start: a.show_start, 
    end: a.show_end 
  })));
  
  // For each microphone model, calculate peak concurrent usage
  for (const micModel of micModelsSet) {
    console.log(`🔍 DEBUGGING: Calculating peak concurrent for ${micModel}:`);
    
    // Create timeline events for this mic model
    const events: Array<{ 
      time: string; 
      quantity: number; 
      type: 'start' | 'end'; 
      artist: string 
    }> = [];
    
    sortedArtists.forEach(artist => {
      if (!artist.wired_mics || !Array.isArray(artist.wired_mics)) return;
      
      // Find all mics of this model for this artist and sum their quantities
      let totalQuantityForModel = 0;
      artist.wired_mics.forEach((mic: any) => {
        if (mic.model && mic.model.trim() === micModel) {
          totalQuantityForModel += parseInt(String(mic.quantity)) || 0;
        }
      });
      
      console.log(`🔍 DEBUGGING: ${artist.name}: ${totalQuantityForModel} x ${micModel} from ${artist.show_start} to ${artist.show_end}`);
      
      if (totalQuantityForModel > 0 && artist.show_start && artist.show_end) {
        events.push({
          time: artist.show_start,
          quantity: totalQuantityForModel,
          type: 'start',
          artist: artist.name
        });
        events.push({
          time: artist.show_end,
          quantity: totalQuantityForModel,
          type: 'end',
          artist: artist.name
        });
      }
    });
    
    // Sort events by time
    events.sort((a, b) => a.time.localeCompare(b.time));
    console.log(`🔍 DEBUGGING: Timeline events for ${micModel}:`, events);
    
    // Calculate peak concurrent usage using timeline sweep
    let currentUsage = 0;
    let peakUsage = 0;
    let peakTime = '';
    
    events.forEach(event => {
      if (event.type === 'start') {
        currentUsage += event.quantity;
        if (currentUsage > peakUsage) {
          peakUsage = currentUsage;
          peakTime = event.time;
        }
        console.log(`🔍 DEBUGGING: ${event.time}: +${event.quantity} (${event.artist}) -> ${currentUsage} total`);
      } else {
        currentUsage -= event.quantity;
        console.log(`🔍 DEBUGGING: ${event.time}: -${event.quantity} (${event.artist}) -> ${currentUsage} total`);
      }
    });
    
    // Handle consecutive shows (back-to-back performances)
    let consecutiveAdjustment = 0;
    for (let i = 0; i < sortedArtists.length - 1; i++) {
      const current = sortedArtists[i];
      const next = sortedArtists[i + 1];
      
      // Check if shows are consecutive (current end = next start)
      if (current.show_end === next.show_start) {
        let currentQuantity = 0;
        let nextQuantity = 0;
        
        // Sum quantities for current artist
        if (current.wired_mics && Array.isArray(current.wired_mics)) {
          current.wired_mics.forEach((mic: any) => {
            if (mic.model && mic.model.trim() === micModel) {
              currentQuantity += parseInt(String(mic.quantity)) || 0;
            }
          });
        }
        
        // Sum quantities for next artist
        if (next.wired_mics && Array.isArray(next.wired_mics)) {
          next.wired_mics.forEach((mic: any) => {
            if (mic.model && mic.model.trim() === micModel) {
              nextQuantity += parseInt(String(mic.quantity)) || 0;
            }
          });
        }
        
        if (currentQuantity > 0 && nextQuantity > 0) {
          // For consecutive shows, we need separate mic sets (no sharing possible)
          const consecutiveNeed = currentQuantity + nextQuantity;
          consecutiveAdjustment = Math.max(consecutiveAdjustment, consecutiveNeed);
          
          console.log(`🔍 DEBUGGING: Consecutive shows ${current.name} -> ${next.name}: need ${consecutiveNeed} mics`);
        }
      }
    }
    
    // Final peak is the maximum of timeline peak and consecutive adjustment
    const finalPeak = Math.max(peakUsage, consecutiveAdjustment);
    peakConcurrentMatrix[micModel] = finalPeak;
    
    console.log(`🔍 DEBUGGING: Final peak for ${micModel}: ${finalPeak} (timeline: ${peakUsage}, consecutive: ${consecutiveAdjustment}) at ${peakTime}`);
  }
  
  const result = {
    micModels: Array.from(micModelsSet).sort(),
    artistNames: Array.from(artistNamesSet).sort(),
    individualMatrix,
    peakConcurrentMatrix
  };
  
  console.log('🔍 DEBUGGING: Final matrix result:', {
    micModels: result.micModels,
    artistNames: result.artistNames,
    individualMatrixSample: Object.keys(result.individualMatrix).slice(0, 2).reduce((acc, key) => {
      acc[key] = result.individualMatrix[key];
      return acc;
    }, {} as any),
    peakConcurrentSample: Object.keys(result.peakConcurrentMatrix).slice(0, 2).reduce((acc, key) => {
      acc[key] = result.peakConcurrentMatrix[key];
      return acc;
    }, {} as any)
  });
  
  return result;
};

// Helper function to organize artists by date and stage
export const organizeArtistsByDateAndStage = (artists: any[]): Map<string, Map<number, any[]>> => {
  const organized = new Map<string, Map<number, any[]>>();
  
  console.log('🔍 DEBUGGING: organizeArtistsByDateAndStage called with:', artists.length, 'artists');
  
  artists.forEach((artist, index) => {
    const date = artist.date;
    const stage = artist.stage || 1;
    
    console.log(`🔍 DEBUGGING: Artist #${index}: ${artist.name}, date=${date}, stage=${stage}`);
    
    if (!date) {
      console.log(`🔍 DEBUGGING: Skipping artist ${artist.name} - no date`);
      return;
    }
    
    if (!organized.has(date)) {
      organized.set(date, new Map());
      console.log(`🔍 DEBUGGING: Created new date entry: ${date}`);
    }
    
    if (!organized.get(date)!.has(stage)) {
      organized.get(date)!.set(stage, []);
      console.log(`🔍 DEBUGGING: Created new stage entry: ${date} -> stage ${stage}`);
    }
    
    organized.get(date)!.get(stage)!.push(artist);
    console.log(`🔍 DEBUGGING: Added ${artist.name} to ${date} stage ${stage}`);
  });
  
  console.log('🔍 DEBUGGING: Final organized structure:'); 
  Array.from(organized.entries()).forEach(([date, stages]) => {
    console.log(`🔍 DEBUGGING: Date ${date}:`);
    Array.from(stages.entries()).forEach(([stage, artists]) => {
      console.log(`🔍 DEBUGGING:   Stage ${stage}: ${artists.length} artists (${artists.map(a => a.name).join(', ')})`);
    });
  });
  
  return organized;
};
