
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export interface WiredMicrophoneNeed {
  model: string;
  maxQuantity: number;
  exclusiveQuantity: number;
  sharedQuantity: number;
  stages: Array<{
    stage: number;
    quantity: number;
    isExclusive: boolean;
    artists: string[];
  }>;
}

export interface WiredMicrophoneNeedsPdfData {
  jobTitle: string;
  logoUrl?: string;
  microphoneNeeds: WiredMicrophoneNeed[];
  selectedStages: number[];
}

export const exportWiredMicrophoneNeedsPDF = async (data: WiredMicrophoneNeedsPdfData): Promise<Blob> => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;
  const margin = 20;
  
  // Festival document styling - consistent colors and fonts
  const primaryColor = [41, 128, 185]; // Festival blue
  const secondaryColor = [52, 73, 94]; // Dark gray
  const accentColor = [231, 76, 60]; // Red for exclusive items
  const lightGray = [236, 240, 241];
  
  // Add logo if available - consistent with other festival documents
  let logoHeight = 0;
  if (data.logoUrl) {
    try {
      const logoResponse = await fetch(data.logoUrl);
      const logoBlob = await logoResponse.blob();
      const logoDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(logoBlob);
      });
      
      logoHeight = 25;
      pdf.addImage(logoDataUrl, 'PNG', margin, 15, 50, logoHeight);
    } catch (error) {
      console.error('Error loading logo:', error);
    }
  }
  
  // Header styling - consistent with other festival documents
  const headerY = logoHeight > 0 ? 50 : 25;
  
  // Main title
  pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.rect(0, headerY, pageWidth, 25, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Wired Microphone Requirements', pageWidth / 2, headerY + 16, { align: 'center' });
  
  // Job title
  pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.jobTitle, pageWidth / 2, headerY + 35, { align: 'center' });
  
  // Stage filter info with consistent styling
  const stageText = data.selectedStages.length === 1 
    ? `Stage ${data.selectedStages[0]}`
    : data.selectedStages.length > 1 
      ? `Stages ${data.selectedStages.join(', ')}`
      : 'All Stages';
  
  pdf.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
  pdf.rect(margin, headerY + 45, pageWidth - (margin * 2), 15, 'F');
  
  pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Report Scope: ${stageText}`, pageWidth / 2, headerY + 55, { align: 'center' });
  
  let yPosition = headerY + 75;
  
  if (data.microphoneNeeds.length === 0) {
    pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text('No wired microphone requirements found for the selected stages.', margin, yPosition);
    
    // Footer
    const timestamp = new Date().toLocaleString();
    pdf.setFontSize(8);
    pdf.setTextColor(128, 128, 128);
    pdf.text(`Generated on ${timestamp}`, margin, pageHeight - 10);
    
    return new Blob([pdf.output('blob')], { type: 'application/pdf' });
  }
  
  // Summary section with festival styling
  pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Inventory Requirements Summary', margin, yPosition);
  yPosition += 15;
  
  const summaryData = data.microphoneNeeds.map(need => [
    need.model,
    need.maxQuantity.toString(),
    need.exclusiveQuantity.toString(),
    need.sharedQuantity.toString(),
    need.stages.map(s => `Stage ${s.stage}: ${s.quantity}`).join(', ')
  ]);
  
  (pdf as any).autoTable({
    startY: yPosition,
    head: [['Microphone Model', 'Total Required', 'Exclusive Use', 'Shared Use', 'Stage Distribution']],
    body: summaryData,
    theme: 'grid',
    headStyles: { 
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 11,
      fontStyle: 'bold'
    },
    bodyStyles: { 
      fontSize: 10,
      textColor: secondaryColor
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250]
    },
    styles: { 
      cellPadding: 6,
      lineColor: [200, 200, 200],
      lineWidth: 0.5
    },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold' },
      1: { cellWidth: 25, halign: 'center', fillColor: [233, 245, 255] },
      2: { cellWidth: 25, halign: 'center', fillColor: [255, 235, 235] },
      3: { cellWidth: 25, halign: 'center', fillColor: [235, 255, 235] },
      4: { cellWidth: 55, fontSize: 9 }
    }
  });
  
  yPosition = (pdf as any).lastAutoTable.finalY + 25;
  
  // Detailed breakdown section
  pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Detailed Stage Analysis', margin, yPosition);
  yPosition += 15;
  
  for (const need of data.microphoneNeeds) {
    // Check if we need a new page
    if (yPosition > pageHeight - 80) {
      pdf.addPage();
      yPosition = 30;
    }
    
    // Model header with festival styling
    pdf.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    pdf.rect(margin, yPosition - 5, pageWidth - (margin * 2), 20, 'F');
    
    pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${need.model} - Stage Requirements`, margin + 5, yPosition + 8);
    yPosition += 25;
    
    const detailData = need.stages.map(stage => [
      `Stage ${stage.stage}`,
      stage.quantity.toString(),
      stage.isExclusive ? 'Yes' : 'No',
      stage.artists.join(', ')
    ]);
    
    (pdf as any).autoTable({
      startY: yPosition,
      head: [['Stage', 'Quantity', 'Exclusive', 'Artists Using This Model']],
      body: detailData,
      theme: 'grid',
      headStyles: { 
        fillColor: [100, 100, 100],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: { 
        fontSize: 9,
        textColor: secondaryColor
      },
      alternateRowStyles: {
        fillColor: [252, 252, 252]
      },
      styles: { 
        cellPadding: 4,
        lineColor: [200, 200, 200],
        lineWidth: 0.3
      },
      columnStyles: {
        0: { cellWidth: 25, fontStyle: 'bold' },
        1: { cellWidth: 20, halign: 'center' },
        2: { 
          cellWidth: 20, 
          halign: 'center',
          didParseCell: function(data: any) {
            if (data.cell.text[0] === 'Yes') {
              data.cell.styles.fillColor = [255, 235, 235];
              data.cell.styles.textColor = accentColor;
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
        3: { cellWidth: 105, fontSize: 8 }
      }
    });
    
    yPosition = (pdf as any).lastAutoTable.finalY + 20;
  }
  
  // Footer with consistent festival styling
  const timestamp = new Date().toLocaleString();
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(128, 128, 128);
  
  // Add a line above footer
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);
  
  pdf.text(`Generated on ${timestamp}`, margin, pageHeight - 10);
  pdf.text(`${data.jobTitle} - Wired Microphone Requirements`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  
  return new Blob([pdf.output('blob')], { type: 'application/pdf' });
};

// Function to calculate microphone needs (extracted from calculator component)
export const calculateWiredMicrophoneNeeds = (artists: any[]): WiredMicrophoneNeed[] => {
  const microphoneMap = new Map<string, WiredMicrophoneNeed>();

  // Group artists by stage and date
  const stageGroups = new Map<string, typeof artists>();
  
  artists.forEach(artist => {
    const key = `${artist.stage}-${artist.date}`;
    if (!stageGroups.has(key)) {
      stageGroups.set(key, []);
    }
    stageGroups.get(key)!.push(artist);
  });

  // Process each stage group
  stageGroups.forEach((stageArtists, stageKey) => {
    const [stage, date] = stageKey.split('-');
    
    // Sort artists by show time for consecutive show detection
    const sortedArtists = stageArtists.sort((a, b) => {
      return (a.show_start || '').localeCompare(b.show_start || '');
    });

    // Track microphone usage across the day
    const micUsageByTime = new Map<string, Array<{
      artist: string;
      mics: any[];
      startTime: string;
      endTime: string;
      exclusive: boolean;
      showIndex: number;
    }>>();

    sortedArtists.forEach((artist, index) => {
      if (!artist.wired_mics || !Array.isArray(artist.wired_mics)) return;

      const wiredMics = artist.wired_mics;
      wiredMics.forEach((mic: any) => {
        if (!mic.model || !mic.quantity) return;

        const usage = {
          artist: artist.name,
          mics: [mic],
          startTime: artist.show_start || '',
          endTime: artist.show_end || '',
          exclusive: mic.exclusive_use || false,
          showIndex: index
        };

        if (!micUsageByTime.has(mic.model)) {
          micUsageByTime.set(mic.model, []);
        }
        micUsageByTime.get(mic.model)!.push(usage);
      });
    });

    // Calculate peak requirements for each microphone model
    micUsageByTime.forEach((usages, model) => {
      let maxQuantity = 0;
      let exclusiveQuantity = 0;
      let sharedQuantity = 0;

      // Check for overlapping and consecutive shows
      for (let i = 0; i < usages.length; i++) {
        let currentQuantity = 0;
        let currentExclusive = 0;
        let currentShared = 0;
        const artistsAtTime: string[] = [];

        for (let j = 0; j < usages.length; j++) {
          const usage = usages[j];
          const isOverlapping = i === j || isTimeOverlapping(
            usages[i].startTime, usages[i].endTime,
            usage.startTime, usage.endTime
          );
          
          // Shows are consecutive if their indices are adjacent in the sorted array
          const isConsecutiveShow = Math.abs(usages[i].showIndex - usage.showIndex) === 1;

          if (isOverlapping || isConsecutiveShow) {
            const micQuantity = usage.mics[0]?.quantity || 0;
            currentQuantity += micQuantity;
            artistsAtTime.push(usage.artist);

            if (usage.exclusive) {
              currentExclusive += micQuantity;
            } else {
              // For shared mics, they can't be shared if ANY show in the time window is exclusive
              // or if shows are consecutive (they need separate mic sets)
              const hasExclusiveInWindow = usages.some(u => u.exclusive && (
                isTimeOverlapping(usage.startTime, usage.endTime, u.startTime, u.endTime) ||
                Math.abs(usage.showIndex - u.showIndex) === 1
              ));
              
              // Also can't share if any show is consecutive to this one
              const hasConsecutiveShow = usages.some(u => 
                Math.abs(usage.showIndex - u.showIndex) === 1 &&
                (isTimeOverlapping(usage.startTime, usage.endTime, u.startTime, u.endTime) ||
                 isConsecutiveShow)
              );
              
              if (!hasExclusiveInWindow && !hasConsecutiveShow) {
                currentShared = Math.max(currentShared, micQuantity);
              } else {
                // If can't be shared, treat as exclusive for counting
                currentExclusive += micQuantity;
              }
            }
          }
        }

        maxQuantity = Math.max(maxQuantity, currentExclusive + currentShared);
        exclusiveQuantity = Math.max(exclusiveQuantity, currentExclusive);
        sharedQuantity = Math.max(sharedQuantity, currentShared);
      }

      // Update or create microphone need entry
      if (!microphoneMap.has(model)) {
        microphoneMap.set(model, {
          model,
          maxQuantity: 0,
          exclusiveQuantity: 0,
          sharedQuantity: 0,
          stages: []
        });
      }

      const need = microphoneMap.get(model)!;
      need.maxQuantity = Math.max(need.maxQuantity, maxQuantity);
      need.exclusiveQuantity = Math.max(need.exclusiveQuantity, exclusiveQuantity);
      need.sharedQuantity = Math.max(need.sharedQuantity, sharedQuantity);
      
      need.stages.push({
        stage: parseInt(stage),
        quantity: maxQuantity,
        isExclusive: exclusiveQuantity > 0,
        artists: [...new Set(usages.map(u => u.artist))]
      });
    });
  });

  return Array.from(microphoneMap.values());
};

const isTimeOverlapping = (start1: string, end1: string, start2: string, end2: string): boolean => {
  return start1 < end2 && start2 < end1;
};
