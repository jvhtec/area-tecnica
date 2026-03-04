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
      const leftMargin = 10;
      const rightMargin = 10;
      const tableTopMargin = 25;
      const footerReserve = 24;

      let headerLogoImg: HTMLImageElement | null = null;
      let headerLogoFormat: 'PNG' | 'JPEG' = 'JPEG';

      // Logo loading promise
      const loadLogoPromise = data.logoUrl 
        ? new Promise<void>((resolveLogoLoad, rejectLogoLoad) => {
            console.log("Attempting to load logo from URL:", data.logoUrl);
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
              try {
                console.log("Logo loaded successfully, dimensions:", img.width, "x", img.height);
                headerLogoImg = img;
                headerLogoFormat = (data.logoUrl || '').toLowerCase().includes('.png') ? 'PNG' : 'JPEG';
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
        const drawRunningHeader = () => {
          doc.setFillColor(125, 1, 1);  // Corporate red
          doc.rect(0, 0, pageWidth, 20, 'F');

          if (headerLogoImg && headerLogoImg.width > 0 && headerLogoImg.height > 0) {
            const maxLogoWidth = 40;
            const maxLogoHeight = 18;
            const scale = Math.min(maxLogoWidth / headerLogoImg.width, maxLogoHeight / headerLogoImg.height);
            const drawWidth = headerLogoImg.width * scale;
            const drawHeight = headerLogoImg.height * scale;
            doc.addImage(
              headerLogoImg,
              headerLogoFormat,
              pageWidth - drawWidth - rightMargin,
              1,
              drawWidth,
              drawHeight,
            );
          }

          doc.setFontSize(14);
          doc.setTextColor(255, 255, 255);  // White
          doc.text(`${data.jobTitle} - Turnos de Personal`, pageWidth / 2, 12, { align: 'center' });
          doc.text(format(new Date(data.date), 'dd/MM/yyyy'), pageWidth / 2, 18, { align: 'center' });
        };

        // Continue with PDF generation
        drawRunningHeader();

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
            margin: { left: leftMargin, right: rightMargin, top: tableTopMargin, bottom: footerReserve },
            rowPageBreak: 'avoid',
            didDrawPage: () => {
              drawRunningHeader();
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

        const applyFooterAndResolve = (sectorImg?: HTMLImageElement) => {
          const totalPages = doc.getNumberOfPages();
          for (let i = 1; i <= totalPages; i += 1) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(51, 51, 51);
            doc.text(`Generado: ${createdDate}`, leftMargin, pageHeight - 10);
            doc.text(`Pagina ${i} de ${totalPages}`, pageWidth - rightMargin, pageHeight - 10, { align: 'right' });

            if (sectorImg && sectorImg.width > 0 && sectorImg.height > 0) {
              try {
                const logoWidth = 30;
                const logoHeight = logoWidth * (sectorImg.height / sectorImg.width);
                doc.addImage(
                  sectorImg,
                  'PNG',
                  pageWidth / 2 - logoWidth / 2,
                  pageHeight - logoHeight - 10,
                  logoWidth,
                  logoHeight,
                );
              } catch (err) {
                console.error('Error adding Sector Pro logo to shifts footer:', err);
              }
            }
          }

          const blob = doc.output('blob');
          console.log(`Shifts PDF generated successfully, blob size: ${blob.size}`);
          resolve(blob);
        };

        const sectorImg = new Image();
        sectorImg.onload = () => applyFooterAndResolve(sectorImg);
        sectorImg.onerror = () => applyFooterAndResolve();
        sectorImg.src = '/sector pro logo.png';
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
