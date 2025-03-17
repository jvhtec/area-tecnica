
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ShiftWithAssignments } from '@/types/festival-scheduling';
import { supabase } from '@/lib/supabase';

export interface ShiftsTablePdfData {
  jobTitle: string;
  date: string;
  jobId?: string;
  shifts: ShiftWithAssignments[];
  logoUrl?: string; // Add logo URL option
}

export const exportShiftsTablePDF = (data: ShiftsTablePdfData): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      // Create PDF in landscape
      const doc = new jsPDF({ orientation: 'landscape' });
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const createdDate = format(new Date(), 'dd/MM/yyyy');

      // Header
      doc.setFillColor(125, 1, 1);  // Corporate red
      doc.rect(0, 0, pageWidth, 20, 'F');

      // Logo loading promise
      const loadLogoPromise = data.logoUrl 
        ? new Promise<void>((resolveLogoLoad, rejectLogoLoad) => {
            console.log("Attempting to load logo from URL:", data.logoUrl);
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
              try {
                console.log("Logo loaded successfully, dimensions:", img.width, "x", img.height);
                // Calculate logo dimensions (max height 18px in header)
                const maxHeight = 18;
                const ratio = img.width / img.height;
                const logoHeight = Math.min(maxHeight, img.height);
                const logoWidth = logoHeight * ratio;
                
                // Add logo to top left corner
                doc.addImage(
                  img, 
                  'JPEG', 
                  5, // X position (left margin)
                  1, // Y position (top margin)
                  logoWidth,
                  logoHeight
                );
                resolveLogoLoad();
              } catch (err) {
                console.error('Error adding logo to PDF:', err);
                resolveLogoLoad(); // Resolve anyway to continue PDF generation
              }
            };
            img.onerror = (e) => {
              console.error('Error loading logo image:', e);
              resolveLogoLoad(); // Resolve anyway to continue PDF generation
            };
            img.src = data.logoUrl;
          })
        : Promise.resolve();

      loadLogoPromise.then(() => {
        // Continue with PDF generation
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
              shift.stage ? `Stage ${shift.stage}` : 'N/A',
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

        // Add footer with date
        doc.setFontSize(8);
        doc.setTextColor(51, 51, 51);
        doc.text(`Generated: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
        
        // Output the PDF
        try {
          const blob = doc.output('blob');
          console.log(`Shifts PDF generated successfully, blob size: ${blob.size}`);
          resolve(blob);
        } catch (err) {
          console.error("Error creating PDF blob:", err);
          reject(err);
        }
      }).catch(err => {
        console.error("Error in PDF generation:", err);
        reject(err);
      });
    } catch (error) {
      console.error("Exception in PDF export:", error);
      reject(error);
    }
  });
};
