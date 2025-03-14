
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export interface ShiftsTablePdfData {
  jobTitle: string;
  date: string;
  shifts: {
    name: string;
    time: {
      start: string;
      end: string;
    };
    stage?: number;
    department: string;
    assignments: {
      name: string;
      role: string;
    }[];
  }[];
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

    // Prepare table data
    const tableBody = data.shifts.map(shift => {
      const technicians = shift.assignments.length > 0
        ? shift.assignments.map(a => `${a.name} (${a.role})`).join('\n')
        : 'No technicians assigned';

      return [
        shift.name,
        `${shift.time.start.slice(0, 5)} - ${shift.time.end.slice(0, 5)}`,
        shift.stage ? `Stage ${shift.stage}` : '-',
        shift.department || '-',
        technicians
      ];
    });

    autoTable(doc, {
      startY: 25,
      head: [['Shift', 'Time', 'Stage', 'Department', 'Technicians']],
      body: tableBody,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        overflow: 'linebreak',
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [125, 1, 1],  // Corporate red
        textColor: [255, 255, 255],  // White
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'left',
        cellPadding: 4
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 30 },
        2: { cellWidth: 25 },
        3: { cellWidth: 35 },
        4: { cellWidth: 'auto' }
      }
    });

    // Add festival logo (if available)
    const festivalLogo = new Image();
    festivalLogo.crossOrigin = 'anonymous';
    festivalLogo.src = '/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png';
    
    festivalLogo.onload = () => {
      try {
        const logoWidth = 20;
        const logoHeight = logoWidth * (festivalLogo.height / festivalLogo.width);
        const xPosition = 10;
        const yPosition = pageHeight - 15;
        doc.addImage(festivalLogo, 'PNG', xPosition, yPosition - logoHeight, logoWidth, logoHeight);
      } catch (error) {
        console.error('Error adding festival logo:', error);
      }

      // Add company logo
      const companyLogo = new Image();
      companyLogo.crossOrigin = 'anonymous';
      companyLogo.src = '/lovable-uploads/2f12a6ef-587b-4049-ad53-d83fb94064e3.png';
      
      companyLogo.onload = () => {
        try {
          const logoWidth = 25;
          const logoHeight = logoWidth * (companyLogo.height / companyLogo.width);
          const xPosition = pageWidth - 35;
          const yPosition = pageHeight - 15;
          doc.addImage(companyLogo, 'PNG', xPosition, yPosition - logoHeight, logoWidth, logoHeight);
        } catch (error) {
          console.error('Error adding company logo:', error);
        }
        
        // Add footer text
        doc.setFontSize(8);
        doc.setTextColor(51, 51, 51);
        doc.text(`Generated: ${createdDate}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        
        const blob = doc.output('blob');
        resolve(blob);
      };
      
      companyLogo.onerror = () => {
        console.error('Failed to load company logo');
        doc.setFontSize(8);
        doc.setTextColor(51, 51, 51);
        doc.text(`Generated: ${createdDate}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        const blob = doc.output('blob');
        resolve(blob);
      };
    };
    
    festivalLogo.onerror = () => {
      console.error('Failed to load festival logo');
      
      const companyLogo = new Image();
      companyLogo.crossOrigin = 'anonymous';
      companyLogo.src = '/lovable-uploads/2f12a6ef-587b-4049-ad53-d83fb94064e3.png';
      
      companyLogo.onload = () => {
        try {
          const logoWidth = 25;
          const logoHeight = logoWidth * (companyLogo.height / companyLogo.width);
          const xPosition = pageWidth - 35;
          const yPosition = pageHeight - 15;
          doc.addImage(companyLogo, 'PNG', xPosition, yPosition - logoHeight, logoWidth, logoHeight);
        } catch (error) {
          console.error('Error adding company logo:', error);
        }
        
        doc.setFontSize(8);
        doc.setTextColor(51, 51, 51);
        doc.text(`Generated: ${createdDate}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        const blob = doc.output('blob');
        resolve(blob);
      };
      
      companyLogo.onerror = () => {
        console.error('Failed to load company logo');
        doc.setFontSize(8);
        doc.setTextColor(51, 51, 51);
        doc.text(`Generated: ${createdDate}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        const blob = doc.output('blob');
        resolve(blob);
      };
    };
  });
};
