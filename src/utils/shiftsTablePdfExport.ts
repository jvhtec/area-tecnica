import { format } from 'date-fns';
import { ShiftWithAssignments } from '@/types/festival-scheduling';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';

export interface ShiftsTablePdfData {
  jobTitle: string;
  date: string;
  jobId?: string;
  shifts: ShiftWithAssignments[];
  logoUrl?: string; // Logo URL option
}

export const exportShiftsTablePDF = async (data: ShiftsTablePdfData): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  return new Promise((resolve, reject) => {
    try {
      // Create PDF in landscape
      const doc = new jsPDF({ orientation: 'landscape' });
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const createdDate = format(new Date(), 'dd/MM/yyyy');

      // Header with correct corporate red color (125, 1, 1)
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
        doc.text(`${data.jobTitle} - Turnos de Personal`, pageWidth / 2, 12, { align: 'center' });
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
          doc.text(`Departamento ${department}`, 14, yPosition);
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
            const technicians = assignments.map(a => {
              let technicianName;
              
              // First check for external technician name
              if (a.external_technician_name) {
                technicianName = a.external_technician_name;
              }
              // Then fall back to profile data if available
              else if (a.profiles?.first_name && a.profiles?.last_name) {
                technicianName = `${a.profiles.first_name} ${a.profiles.last_name}`;
              }
              // Last resort fallback
              else {
                technicianName = 'Sin nombre';
                console.warn('Missing technician name data for assignment:', a);
              }
              
              return `${technicianName} (${a.role || 'N/A'})`;
            }).join('\n');

            return [
              shift.name,
              shift.stage ? `Escenario ${shift.stage}` : 'N/A',
              `${shift.start_time.substring(0, 5)} - ${shift.end_time.substring(0, 5)}`,
              technicians || 'Ninguno'
            ];
          });

          // Add table to PDF with consistent corporate red color
          autoTable(doc, {
            startY: yPosition,
            head: [['Turno', 'Escenario', 'Horario', 'Tecnicos Asignados']],
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

        // Add footer with date and try to add sector pro logo
        doc.setFontSize(8);
        doc.setTextColor(51, 51, 51);
        doc.text(`Generado: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
        
        // Try to add Sector Pro logo at the bottom center
        try {
          // Logo at bottom center
          const sectorLogoPath = '/sector pro logo.png';
          console.log("Attempting to add Sector Pro logo from:", sectorLogoPath);
          
          const sectorImg = new Image();
          sectorImg.onload = () => {
            try {
              const logoWidth = 30;
              const ratio = sectorImg.width / sectorImg.height;
              const logoHeight = logoWidth / ratio;
              
              doc.addImage(
                sectorImg, 
                'PNG', 
                pageWidth/2 - logoWidth/2, // Center horizontally 
                pageHeight - logoHeight - 10, // Position at the bottom
                logoWidth,
                logoHeight
              );
              
              // Now resolve with the final PDF
              const blob = doc.output('blob');
              console.log(`Shifts PDF generated successfully, blob size: ${blob.size}`);
              resolve(blob);
            } catch (err) {
              console.error("Error adding Sector Pro logo to PDF:", err);
              // If logo fails, just return the PDF without it
              const blob = doc.output('blob');
              resolve(blob);
            }
          };
          
          sectorImg.onerror = (err) => {
            console.error("Could not load Sector Pro logo:", err);
            // If logo loading fails, just return the PDF without it
            const blob = doc.output('blob');
            resolve(blob);
          };
          
          sectorImg.src = sectorLogoPath;
        } catch (logoErr) {
          console.error("Exception trying to add Sector Pro logo:", logoErr);
          // Return PDF without the logo
          const blob = doc.output('blob');
          resolve(blob);
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
