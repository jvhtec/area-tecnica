
import jsPDF from 'jspdf';
import { Timesheet } from '@/types/timesheet';
import { Job } from '@/types/job';
import { format, parseISO } from 'date-fns';

interface GenerateTimesheetPDFOptions {
  job: Job;
  timesheets: Timesheet[];
  date: string;
}

// Helper function to load signature images as promises
const loadSignatureImage = (signatureData: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (error) => {
      console.error('Error loading signature image:', error);
      reject(error);
    };
    img.src = signatureData;
  });
};

// Helper function to format time display
const formatTime = (time: string | null | undefined): string => {
  if (!time) return '--';
  // Handle both "HH:MM:SS" and "HH:MM" formats
  return time.substring(0, 5); // "09:00:00" -> "09:00"
};

// Helper function to format break time
const formatBreakTime = (breakMinutes: number | null | undefined): string => {
  if (!breakMinutes) return '--';
  return `${breakMinutes}min`;
};

// Helper function to format overtime
const formatOvertime = (overtimeHours: number | null | undefined): string => {
  if (!overtimeHours) return '--';
  return `${overtimeHours}h`;
};

export const generateTimesheetPDF = async ({ job, timesheets, date }: GenerateTimesheetPDFOptions) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  let yPosition = 20;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('TIMESHEET', pageWidth / 2, yPosition, { align: 'center' });
  
  yPosition += 15;
  
  // Job Information
  doc.setFontSize(12);
  doc.text(`Job: ${job.title}`, 20, yPosition);
  yPosition += 8;
  
  doc.text(`Date: ${format(parseISO(date), 'EEEE, MMMM do, yyyy')}`, 20, yPosition);
  yPosition += 8;
  
  doc.text(`Location: ${job.location_id || 'TBD'}`, 20, yPosition);
  yPosition += 15;

  // Load all signatures first
  const signaturePromises: Promise<{ timesheetId: string; image: HTMLImageElement }>[] = [];
  
  for (const timesheet of timesheets) {
    if (timesheet.signature_data) {
      signaturePromises.push(
        loadSignatureImage(timesheet.signature_data)
          .then(image => ({ timesheetId: timesheet.id, image }))
          .catch(error => {
            console.error(`Failed to load signature for timesheet ${timesheet.id}:`, error);
            return null;
          })
      );
    }
  }

  // Wait for all signatures to load
  const loadedSignatures = await Promise.allSettled(signaturePromises);
  const signatureMap = new Map<string, HTMLImageElement>();
  
  loadedSignatures.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      signatureMap.set(result.value.timesheetId, result.value.image);
    }
  });

  // Table header
  const tableStartY = yPosition;
  const colWidths = [60, 25, 25, 20, 20, 40];
  const colPositions = [20, 80, 105, 130, 150, 170];
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  
  // Header background
  doc.setFillColor(240, 240, 240);
  doc.rect(20, yPosition - 5, pageWidth - 40, 12, 'F');
  
  doc.text('Technician', colPositions[0] + 2, yPosition + 3);
  doc.text('Start', colPositions[1] + 2, yPosition + 3);
  doc.text('End', colPositions[2] + 2, yPosition + 3);
  doc.text('Break', colPositions[3] + 2, yPosition + 3);
  doc.text('OT', colPositions[4] + 2, yPosition + 3);
  doc.text('Signature', colPositions[5] + 2, yPosition + 3);
  
  yPosition += 12;

  // Table data
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  for (const timesheet of timesheets) {
    if (yPosition > pageHeight - 50) {
      doc.addPage();
      yPosition = 20;
    }

    const technicianName = `${timesheet.technician?.first_name || ''} ${timesheet.technician?.last_name || ''}`.trim();
    const startTime = formatTime(timesheet.start_time);
    const endTime = formatTime(timesheet.end_time);
    const breakTime = formatBreakTime(timesheet.break_minutes);
    const overtime = formatOvertime(timesheet.overtime_hours);

    // Row background (alternating)
    if (timesheets.indexOf(timesheet) % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(20, yPosition - 3, pageWidth - 40, 20, 'F');
    }

    doc.text(technicianName, colPositions[0] + 2, yPosition + 5);
    doc.text(startTime, colPositions[1] + 2, yPosition + 5);
    doc.text(endTime, colPositions[2] + 2, yPosition + 5);
    doc.text(breakTime, colPositions[3] + 2, yPosition + 5);
    doc.text(overtime, colPositions[4] + 2, yPosition + 5);

    // Add signature if available
    const signatureImg = signatureMap.get(timesheet.id);
    if (signatureImg) {
      try {
        // Add the signature image to the PDF
        doc.addImage(signatureImg, 'PNG', colPositions[5] + 2, yPosition - 2, 35, 15);
      } catch (error) {
        console.error('Error adding signature to PDF:', error);
        doc.text('Error', colPositions[5] + 2, yPosition + 5);
      }
    } else if (timesheet.signature_data) {
      // Signature data exists but failed to load
      doc.text('Failed', colPositions[5] + 2, yPosition + 5);
    } else if (timesheet.status === 'approved') {
      doc.text('Pending', colPositions[5] + 2, yPosition + 5);
    } else {
      doc.text('--', colPositions[5] + 2, yPosition + 5);
    }

    // Notes (if any)
    if (timesheet.notes) {
      yPosition += 12;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      const noteText = `Notes: ${timesheet.notes}`;
      const splitNotes = doc.splitTextToSize(noteText, pageWidth - 50);
      doc.text(splitNotes, 25, yPosition);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      yPosition += splitNotes.length * 4;
    }

    yPosition += 20;

    // Draw row border
    doc.setDrawColor(200, 200, 200);
    doc.line(20, yPosition - 18, pageWidth - 20, yPosition - 18);
  }

  // Table border
  doc.setDrawColor(0, 0, 0);
  doc.rect(20, tableStartY - 5, pageWidth - 40, yPosition - tableStartY + 3);

  // Vertical lines for columns
  for (let i = 1; i < colPositions.length; i++) {
    doc.line(colPositions[i], tableStartY - 5, colPositions[i], yPosition - 15);
  }

  // Footer
  yPosition = pageHeight - 30;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('This timesheet was digitally generated and signed.', pageWidth / 2, yPosition, { align: 'center' });
  doc.text(`Generated on: ${format(new Date(), 'PPP')}`, pageWidth / 2, yPosition + 5, { align: 'center' });

  return doc;
};

export const downloadTimesheetPDF = async (options: GenerateTimesheetPDFOptions) => {
  const doc = await generateTimesheetPDF(options);
  const fileName = `timesheet-${options.job.title.replace(/[^a-zA-Z0-9]/g, '_')}-${options.date}.pdf`;
  doc.save(fileName);
};
