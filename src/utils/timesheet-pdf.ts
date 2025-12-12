import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Timesheet } from '@/types/timesheet';
import { Job } from '@/types/job';
import { format, parseISO } from 'date-fns';
import { fetchJobLogo } from '@/utils/pdf/logoUtils';

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

// Helper function to safely load images with timeout
const loadImageSafely = (src: string, description: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    const timeout = setTimeout(() => {
      console.warn(`Timeout loading ${description}`);
      resolve(null);
    }, 5000);

    img.onload = () => {
      clearTimeout(timeout);
      console.log(`Successfully loaded ${description}`);
      resolve(img);
    };

    img.onerror = (error) => {
      clearTimeout(timeout);
      console.error(`Error loading ${description}:`, error);
      resolve(null);
    };

    img.src = src;
  });
};

export const generateTimesheetPDF = async ({ job, timesheets, date }: GenerateTimesheetPDFOptions) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Load logos and signatures in parallel
  const [jobLogoUrl, loadedSignatures] = await Promise.all([
    fetchJobLogo(job.id),
    loadSignatures(timesheets)
  ]);

  // Load images
  const [jobLogo, companyLogo] = await Promise.all([
    jobLogoUrl ? loadImageSafely(jobLogoUrl, 'job logo') : Promise.resolve(null),
    loadImageSafely('/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png', 'company logo')
  ]);

  // Create signature map
  const signatureMap = new Map<string, HTMLImageElement>();
  loadedSignatures.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      signatureMap.set(result.value.timesheetId, result.value.image);
    }
  });

  // Corporate Header
  doc.setFillColor(125, 1, 1); // Corporate red
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Add job logo on left side of header
  if (jobLogo) {
    try {
      doc.addImage(jobLogo, 'PNG', 15, 8, 30, 24);
    } catch (error) {
      console.error('Error adding job logo to PDF:', error);
    }
  }

  // Header text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255); // White text
  doc.text('TIMESHEET', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text(`${job.title}`, pageWidth / 2, 30, { align: 'center' });

  // Reset text color
  doc.setTextColor(0, 0, 0);

  // Job Information
  let yPosition = 55;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  
  // Calculate actual date range from timesheets if showing all dates
  let dateText;
  if (date === "all-dates" && timesheets.length > 0) {
    const dates = timesheets.map(t => parseISO(t.date)).sort((a, b) => a.getTime() - b.getTime());
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    
    if (startDate.getTime() === endDate.getTime()) {
      dateText = format(startDate, 'MMM dd, yyyy');
    } else {
      dateText = `${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd, yyyy')}`;
    }
  } else if (date === "all-dates") {
    dateText = "All Dates";
  } else {
    dateText = format(parseISO(date), 'EEEE, MMMM do, yyyy');
  }
  
  doc.text(`Period: ${dateText}`, 20, yPosition);
  yPosition += 8;
  
  // Display location name and address from job.location
  const locationText = (job as any).location?.name || 'TBD';
  const addressText = (job as any).location?.formatted_address;
  doc.text(`Location: ${locationText}`, 20, yPosition);
  if (addressText) {
    yPosition += 6;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`${addressText}`, 20, yPosition);
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
  }
  yPosition += 20;

  // Group timesheets by date and technician for better organization
  const groupedTimesheets = timesheets.reduce((acc, timesheet) => {
    const key = `${timesheet.date}-${timesheet.technician_id}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(timesheet);
    return acc;
  }, {} as Record<string, Timesheet[]>);

  // Prepare table data with date grouping
  const tableData = Object.values(groupedTimesheets).flat().map((timesheet) => {
    const technicianName = `${timesheet.technician?.first_name || ''} ${timesheet.technician?.last_name || ''}`.trim();
    const startTime = formatTime(timesheet.start_time);
    const endTime = formatTime(timesheet.end_time);
    const breakTime = formatBreakTime(timesheet.break_minutes);
    const overtime = formatOvertime(timesheet.overtime_hours);
    
    // Calculate total hours
    let totalHours = '--';
    if (timesheet.start_time && timesheet.end_time) {
      const start = new Date(`2000-01-01T${timesheet.start_time}`);
      const end = new Date(`2000-01-01T${timesheet.end_time}`);
      let diffMs = end.getTime() - start.getTime();
      if (timesheet.ends_next_day || diffMs < 0) {
        diffMs += 24 * 60 * 60 * 1000;
      }
      const diffHours = diffMs / (1000 * 60 * 60);
      const breakHours = (timesheet.break_minutes || 0) / 60;
      const workHours = Math.max(0, diffHours - breakHours);
      totalHours = workHours.toFixed(2);
    }
    
    // Handle signature display
    let signatureStatus = '--';
    const signatureImg = signatureMap.get(timesheet.id);
    if (signatureImg) {
      signatureStatus = 'Signed';
    } else if (timesheet.signature_data) {
      signatureStatus = 'Failed';
    } else if (timesheet.status === 'approved') {
      signatureStatus = 'Pending';
    } else if (timesheet.status === 'rejected') {
      signatureStatus = 'Rejected';
    }

    const row = [
      format(parseISO(timesheet.date), 'MMM dd'),
      technicianName, 
      startTime, 
      endTime, 
      // breakTime, // Removed from PDF
      totalHours,
      overtime, 
      signatureStatus
    ];
    
    // Add notes if present
    if (timesheet.notes) {
      row.push(`Notes: ${timesheet.notes}`);
    }
    
    return row;
  });

  // Create the table using autoTable with updated headers
  autoTable(doc, {
    startY: yPosition,
    head: [['Date', 'Technician', 'Start Time', 'End Time', 'Total Hours', 'Overtime', 'Signature']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [125, 1, 1], // Corporate red
      textColor: [255, 255, 255], // White text
      fontSize: 10,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    columnStyles: {
      0: { cellWidth: 20 }, // Date (+2)
      1: { cellWidth: 40 }, // Technician (+5)
      2: { cellWidth: 20 }, // Start (+2)
      3: { cellWidth: 20 }, // End (+2)
      // 4: { cellWidth: 15 }, // Break - Removed (15 width redistributed)
      4: { cellWidth: 18 }, // Total (+3)
      5: { cellWidth: 16 }, // Overtime (+1)
      6: { cellWidth: 22 }, // Signature
    },
    didDrawCell: (data: any) => {
      // Add signature images to the signature column
      if (data.column.index === 6 && data.section === 'body') {
        const timesheet = Object.values(groupedTimesheets).flat()[data.row.index];
        const signatureImg = signatureMap.get(timesheet.id);
        if (signatureImg) {
          try {
            doc.addImage(signatureImg, 'PNG', 
              data.cell.x + 2, 
              data.cell.y + 2, 
              18, 
              data.cell.height - 4
            );
          } catch (error) {
            console.error('Error adding signature to table cell:', error);
          }
        }
      }
    }
  });

  // Footer with company logo
  const footerY = pageHeight - 25;
  
  // Add company logo centered
  if (companyLogo) {
    try {
      const logoWidth = 20;
      const logoHeight = 10;
      const logoX = (pageWidth - logoWidth) / 2;
      doc.addImage(companyLogo, 'PNG', logoX, footerY - 5, logoWidth, logoHeight);
    } catch (error) {
      console.error('Error adding company logo to PDF:', error);
    }
  }

  // Footer text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on: ${format(new Date(), 'PPP')}`, pageWidth / 2, footerY + 8, { align: 'center' });

  return doc;
};

// Helper function to load all signatures
const loadSignatures = async (timesheets: Timesheet[]) => {
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

  return Promise.allSettled(signaturePromises);
};

export const downloadTimesheetPDF = async (options: GenerateTimesheetPDFOptions) => {
  const doc = await generateTimesheetPDF(options);
  
  // Update filename to reflect that it contains all dates
  const fileName = options.date === "all-dates" 
    ? `timesheet-${options.job.title.replace(/[^a-zA-Z0-9]/g, '_')}-all-dates.pdf`
    : `timesheet-${options.job.title.replace(/[^a-zA-Z0-9]/g, '_')}-${options.date}.pdf`;
    
  doc.save(fileName);
};
