
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ShiftWithAssignments } from '@/types/festival-scheduling';

export interface ShiftsTablePdfData {
  jobTitle: string;
  date: string;
  shifts: ShiftWithAssignments[];
}

export const exportShiftsTablePDF = (data: ShiftsTablePdfData): Promise<Blob> => {
  return new Promise((resolve) => {
    // Create PDF in landscape
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const createdDate = format(new Date(), 'dd/MM/yyyy');

    // Header
    doc.setFillColor(125, 1, 1);  // Corporate red
    doc.rect(0, 0, pageWidth, 20, 'F');

    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);  // White
    doc.text(`${data.jobTitle} - Shifts Schedule`, pageWidth / 2, 12, { align: 'center' });
    doc.text(format(new Date(data.date), 'dd/MM/yyyy'), pageWidth / 2, 18, { align: 'center' });

    // Group shifts by department
    const departmentShifts: { [key: string]: ShiftWithAssignments[] } = {};
    
    data.shifts.forEach(shift => {
      const dept = shift.department || 'General';
      if (!departmentShifts[dept]) {
        departmentShifts[dept] = [];
      }
      departmentShifts[dept].push(shift);
    });

    let yPosition = 25;

    // Process each department
    for (const [department, shifts] of Object.entries(departmentShifts)) {
      // Department header
      doc.setFontSize(12);
      doc.setTextColor(125, 1, 1);
      doc.text(`${department} Department`, 14, yPosition);
      yPosition += 8;

      // Sort shifts by start time
      shifts.sort((a, b) => {
        const timeA = a.start_time;
        const timeB = b.start_time;
        return timeA.localeCompare(timeB);
      });

      // Create table rows for shifts
      const tableRows = shifts.map(shift => {
        const assignments = shift.assignments || [];
        const technicians = assignments.map(a => 
          `${a.profiles?.first_name || ''} ${a.profiles?.last_name || ''} (${a.role || 'N/A'})`
        ).join('\n');

        return [
          shift.name,
          shift.stage || 'N/A',
          `${shift.start_time.substring(0, 5)} - ${shift.end_time.substring(0, 5)}`,
          technicians || 'None'
        ];
      });

      // Add table to PDF
      autoTable(doc, {
        startY: yPosition,
        head: [['Shift Name', 'Stage', 'Time', 'Assigned Technicians']],
        body: tableRows,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 3,
          overflow: 'linebreak',
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [125, 1, 1],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'left',
          cellPadding: 4
        },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 30 },
          2: { cellWidth: 30 },
          3: { cellWidth: 'auto' }
        }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 15;

      // Add page break if needed
      if (yPosition > pageHeight - 40 && Object.entries(departmentShifts).indexOf([department, shifts]) < Object.entries(departmentShifts).length - 1) {
        doc.addPage();
        yPosition = 20;
      }
    }

    // Footer with logo and date
    const logo = new Image();
    logo.crossOrigin = 'anonymous';
    logo.src = '/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png';
    logo.onload = () => {
      const logoWidth = 30;
      const logoHeight = logoWidth * (logo.height / logo.width);
      const xPosition = (pageWidth - logoWidth) / 2;
      const yLogo = pageHeight - 15;
      try {
        doc.addImage(logo, 'PNG', xPosition, yLogo - logoHeight, logoWidth, logoHeight);
      } catch (error) {
        console.error('Error adding logo:', error);
      }
      doc.setFontSize(8);
      doc.setTextColor(51, 51, 51);
      doc.text(`Generated: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
      const blob = doc.output('blob');
      resolve(blob);
    };

    logo.onerror = () => {
      console.error('Failed to load logo');
      doc.setFontSize(8);
      doc.setTextColor(51, 51, 51);
      doc.text(`Generated: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
      const blob = doc.output('blob');
      resolve(blob);
    };
  });
};
