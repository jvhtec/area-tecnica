import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';

export interface ShiftsTablePdfData {
  jobTitle: string;
  date: string;
  jobId: string; // Added jobId to fetch the correct festival logo
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

export const exportShiftsTablePDF = async (data: ShiftsTablePdfData): Promise<Blob> => {
  return new Promise(async (resolve) => {
    // Create PDF in landscape
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const createdDate = format(new Date(), 'dd/MM/yyyy');
    
    // Create header without logo first
    doc.setFillColor(125, 1, 1);  // Corporate red
    doc.rect(0, 0, pageWidth, 20, 'F');

    // Set initial text in header (will be updated if logo is found)
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);  // White
    doc.text(data.jobTitle, pageWidth / 2, 10, { align: 'center' });
    doc.text(`Shifts Schedule - ${format(new Date(data.date), 'dd/MM/yyyy')}`, pageWidth / 2, 18, { align: 'center' });

    // Fetch festival logo from Supabase
    let festivalLogoUrl = null;
    try {
      console.log('Fetching festival logo for job ID:', data.jobId);
      
      // Query the festival_logos table to get the logo path for this job
      const { data: logoData, error: logoError } = await supabase
        .from('festival_logos')
        .select('file_path')
        .eq('job_id', data.jobId)
        .maybeSingle();

      if (logoError) {
        console.error('Error fetching festival logo:', logoError);
      } else if (logoData?.file_path) {
        // Get the public URL for the logo
        const { data: { publicUrl } } = supabase
          .storage
          .from('festival-logos')
          .getPublicUrl(logoData.file_path);
        
        festivalLogoUrl = publicUrl;
        console.log('Festival logo found, URL:', festivalLogoUrl);
      } else {
        console.log('No festival logo found for job ID:', data.jobId);
      }
    } catch (error) {
      console.error('Error processing festival logo:', error);
    }

    // Add festival logo to the header (if available)
    if (festivalLogoUrl) {
      const loadFestivalLogo = () => {
        return new Promise<void>((logoResolve) => {
          const festivalLogo = new Image();
          festivalLogo.crossOrigin = 'anonymous';
          festivalLogo.src = festivalLogoUrl;
          
          festivalLogo.onload = () => {
            try {
              console.log('Festival logo loaded successfully');
              
              // Recalculate header with logo
              doc.setFillColor(125, 1, 1);  // Corporate red
              doc.rect(0, 0, pageWidth, 20, 'F');
              
              // Calculate logo dimensions (keeping aspect ratio)
              const logoHeight = 16; // Max height
              const logoWidth = logoHeight * (festivalLogo.width / festivalLogo.height);
              
              // Position logo on left side of header
              doc.addImage(festivalLogo, 'PNG', 10, 2, logoWidth, logoHeight);
              
              // Adjust text position to accommodate logo
              doc.setFontSize(14);
              doc.setTextColor(255, 255, 255);  // White
              doc.text(data.jobTitle, pageWidth / 2, 10, { align: 'center' });
              doc.text(`Shifts Schedule - ${format(new Date(data.date), 'dd/MM/yyyy')}`, pageWidth / 2, 18, { align: 'center' });
            } catch (error) {
              console.error('Error adding festival logo to header:', error);
              // If error occurs, keep the header without logo
            }
            logoResolve();
          };
          
          festivalLogo.onerror = () => {
            console.error('Failed to load festival logo');
            logoResolve();
          };
        });
      };
      
      await loadFestivalLogo();
    }

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

    // Add company logo to bottom right
    const addCompanyLogo = () => {
      return new Promise<void>((resolve) => {
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
          
          resolve();
        };
        
        companyLogo.onerror = () => {
          console.error('Failed to load company logo');
          // Add footer text even if logo fails
          doc.setFontSize(8);
          doc.setTextColor(51, 51, 51);
          doc.text(`Generated: ${createdDate}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
          
          resolve();
        };
      });
    };

    await addCompanyLogo();
    
    // Output the PDF
    const blob = doc.output('blob');
    resolve(blob);
  });
};
