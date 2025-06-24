
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
  
  console.log('Processing dates:', Array.from(data.artistsByDateAndStage.keys()));
  
  // Process each date
  for (const [date, stagesMap] of data.artistsByDateAndStage.entries()) {
    console.log(`Processing date: ${date}, stages:`, Array.from(stagesMap.keys()));
    
    // Process each stage within the date
    for (const [stage, artists] of stagesMap.entries()) {
      console.log(`Processing stage ${stage} on ${date}, artists:`, artists.length);
      
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
      
      // Generate matrix data with corrected calculations
      const matrixData = generateCorrectMatrixData(artists);
      
      console.log('Matrix data for stage:', stage, matrixData);
      
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

interface CorrectMatrixData {
  micModels: string[];
  artistNames: string[];
  individualMatrix: Record<string, Record<string, number>>;
  peakConcurrentMatrix: Record<string, number>;
}

const generateCorrectMatrixData = (artists: any[]): CorrectMatrixData => {
  const micModelsSet = new Set<string>();
  const artistNamesSet = new Set<string>();
  const individualMatrix: Record<string, Record<string, number>> = {};
  
  console.log('Processing artists for matrix:', artists.map(a => ({ name: a.name, wiredMics: a.wired_mics })));
  
  // First pass: Build individual requirements matrix (this should be correct)
  artists.forEach(artist => {
    if (!artist.wired_mics || !Array.isArray(artist.wired_mics)) return;
    
    const artistName = artist.name || 'Unknown Artist';
    artistNamesSet.add(artistName);
    
    artist.wired_mics.forEach((mic: any) => {
      if (!mic.model || !mic.quantity) return;
      
      const micModel = mic.model;
      const quantity = parseInt(mic.quantity) || 0;
      
      console.log(`Artist ${artistName} needs ${quantity} ${micModel}`);
      
      micModelsSet.add(micModel);
      
      if (!individualMatrix[micModel]) {
        individualMatrix[micModel] = {};
      }
      
      individualMatrix[micModel][artistName] = (individualMatrix[micModel][artistName] || 0) + quantity;
    });
  });
  
  // Second pass: Calculate peak concurrent usage using timeline approach
  const peakConcurrentMatrix: Record<string, number> = {};
  
  // Sort artists by show time
  const sortedArtists = [...artists].sort((a, b) => {
    return (a.show_start || '').localeCompare(b.show_start || '');
  });
  
  console.log('Sorted artists:', sortedArtists.map(a => ({ name: a.name, start: a.show_start, end: a.show_end })));
  
  // For each microphone model, calculate peak concurrent usage
  for (const micModel of micModelsSet) {
    // Create timeline events for this mic model
    const events: Array<{ time: string; quantity: number; type: 'start' | 'end'; artist: string }> = [];
    
    sortedArtists.forEach(artist => {
      if (!artist.wired_mics || !Array.isArray(artist.wired_mics)) return;
      
      const relevantMics = artist.wired_mics.filter((mic: any) => mic.model === micModel);
      if (relevantMics.length === 0) return;
      
      const totalQuantityForModel = relevantMics.reduce((sum: number, mic: any) => 
        sum + (parseInt(mic.quantity) || 0), 0
      );
      
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
    
    // Calculate peak concurrent usage
    let currentUsage = 0;
    let peakUsage = 0;
    
    events.forEach(event => {
      if (event.type === 'start') {
        currentUsage += event.quantity;
        peakUsage = Math.max(peakUsage, currentUsage);
      } else {
        currentUsage -= event.quantity;
      }
    });
    
    // Handle consecutive shows - check if any shows are back-to-back
    let consecutiveAdjustment = 0;
    for (let i = 0; i < sortedArtists.length - 1; i++) {
      const current = sortedArtists[i];
      const next = sortedArtists[i + 1];
      
      if (current.show_end === next.show_start) {
        // Back-to-back shows - check if both use this mic model
        const currentMics = current.wired_mics?.filter((mic: any) => mic.model === micModel) || [];
        const nextMics = next.wired_mics?.filter((mic: any) => mic.model === micModel) || [];
        
        if (currentMics.length > 0 && nextMics.length > 0) {
          const currentQuantity = currentMics.reduce((sum: number, mic: any) => sum + (parseInt(mic.quantity) || 0), 0);
          const nextQuantity = nextMics.reduce((sum: number, mic: any) => sum + (parseInt(mic.quantity) || 0), 0);
          
          // For consecutive shows, we need separate mic sets
          consecutiveAdjustment = Math.max(consecutiveAdjustment, currentQuantity + nextQuantity);
        }
      }
    }
    
    peakConcurrentMatrix[micModel] = Math.max(peakUsage, consecutiveAdjustment);
    
    console.log(`${micModel}: peak concurrent = ${peakConcurrentMatrix[micModel]} (timeline peak: ${peakUsage}, consecutive adjustment: ${consecutiveAdjustment})`);
  }
  
  const result = {
    micModels: Array.from(micModelsSet).sort(),
    artistNames: Array.from(artistNamesSet).sort(),
    individualMatrix,
    peakConcurrentMatrix
  };
  
  console.log('Final matrix result:', result);
  
  return result;
};

// Helper function to organize artists by date and stage
export const organizeArtistsByDateAndStage = (artists: any[]): Map<string, Map<number, any[]>> => {
  const organized = new Map<string, Map<number, any[]>>();
  
  console.log('Organizing artists by date and stage:', artists.length, 'artists');
  
  artists.forEach(artist => {
    const date = artist.date;
    const stage = artist.stage || 1;
    
    console.log(`Artist ${artist.name}: date=${date}, stage=${stage}`);
    
    if (!organized.has(date)) {
      organized.set(date, new Map());
    }
    
    if (!organized.get(date)!.has(stage)) {
      organized.get(date)!.set(stage, []);
    }
    
    organized.get(date)!.get(stage)!.push(artist);
  });
  
  console.log('Organized structure:', 
    Array.from(organized.entries()).map(([date, stages]) => ({
      date,
      stages: Array.from(stages.entries()).map(([stage, artists]) => ({
        stage,
        artistCount: artists.length
      }))
    }))
  );
  
  return organized;
};
