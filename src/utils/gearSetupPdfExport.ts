
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';

export interface GearSetupPdfData {
  jobTitle: string;
  stageNumber: number;
  stageName?: string;
  date: string;
  gearSetup: any;
  logoUrl?: string;
}

export const exportGearSetupPDF = async (data: GearSetupPdfData): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      console.log('Generating gear setup PDF for stage:', data.stageNumber);
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Add logo if available
      if (data.logoUrl) {
        try {
          const logo = new Image();
          logo.crossOrigin = 'anonymous';
          logo.src = data.logoUrl;
          
          logo.onload = () => {
            const logoWidth = 40;
            const logoHeight = logoWidth * (logo.height / logo.width);
            doc.addImage(logo, 'PNG', (pageWidth - logoWidth) / 2, 10, logoWidth, logoHeight);
            continueWithDocument(doc, data, pageWidth, pageHeight, logoHeight + 15);
          };
          
          logo.onerror = () => {
            console.error('Failed to load logo for gear setup PDF');
            continueWithDocument(doc, data, pageWidth, pageHeight, 10);
          };
        } catch (logoError) {
          console.error('Error with logo in gear setup PDF:', logoError);
          continueWithDocument(doc, data, pageWidth, pageHeight, 10);
        }
      } else {
        continueWithDocument(doc, data, pageWidth, pageHeight, 10);
      }
      
      function continueWithDocument(doc: jsPDF, data: GearSetupPdfData, pageWidth: number, pageHeight: number, startY: number) {
        // Title
        doc.setFontSize(18);
        doc.setTextColor(0, 0, 0);
        doc.text(data.jobTitle, pageWidth / 2, startY + 10, { align: 'center' });
        
        // Stage and date info
        doc.setFontSize(14);
        const stageName = data.stageName || `Stage ${data.stageNumber}`;
        doc.text(stageName, pageWidth / 2, startY + 20, { align: 'center' });
        
        doc.setFontSize(12);
        doc.text(`Date: ${format(new Date(data.date), 'MMMM d, yyyy')}`, pageWidth / 2, startY + 30, { align: 'center' });
        
        let currentY = startY + 40;
        
        // FOH and MON Console Section
        doc.setFontSize(14);
        doc.setTextColor(125, 1, 1);
        doc.text('Console Setup', 14, currentY);
        currentY += 10;
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        
        const consoleData = [];
        if (data.gearSetup.foh_consoles && data.gearSetup.foh_consoles.length > 0) {
          consoleData.push(['FOH Console', data.gearSetup.foh_consoles[0].model || 'N/A']);
        }
        
        if (data.gearSetup.mon_consoles && data.gearSetup.mon_consoles.length > 0) {
          consoleData.push(['MON Console', data.gearSetup.mon_consoles[0].model || 'N/A']);
        }
        
        if (consoleData.length > 0) {
          autoTable(doc, {
            startY: currentY,
            head: [['Type', 'Model']],
            body: consoleData,
            theme: 'striped',
            headStyles: {
              fillColor: [220, 220, 220],
              textColor: [0, 0, 0]
            }
          });
        }
        
        currentY = (doc as any).lastAutoTable.finalY + 10;
        
        // Wireless and IEM Section
        doc.setFontSize(14);
        doc.setTextColor(125, 1, 1);
        doc.text('Wireless Systems', 14, currentY);
        currentY += 10;
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        
        const wirelessData = [];
        if (data.gearSetup.wireless_systems && data.gearSetup.wireless_systems.length > 0) {
          const wireless = data.gearSetup.wireless_systems[0];
          wirelessData.push([
            'Handheld Mics', 
            wireless.model || 'N/A', 
            `${wireless.quantity_hh || 0}`,
            wireless.band || 'N/A'
          ]);
          wirelessData.push([
            'Bodypack Mics', 
            wireless.model || 'N/A', 
            `${wireless.quantity_bp || 0}`,
            wireless.band || 'N/A'
          ]);
        }
        
        if (data.gearSetup.iem_systems && data.gearSetup.iem_systems.length > 0) {
          const iem = data.gearSetup.iem_systems[0];
          wirelessData.push([
            'IEM Systems', 
            iem.model || 'N/A', 
            `${iem.quantity || 0}`,
            iem.band || 'N/A'
          ]);
        }
        
        if (wirelessData.length > 0) {
          autoTable(doc, {
            startY: currentY,
            head: [['Type', 'Model', 'Quantity', 'Band']],
            body: wirelessData,
            theme: 'striped',
            headStyles: {
              fillColor: [220, 220, 220],
              textColor: [0, 0, 0]
            }
          });
        }
        
        currentY = (doc as any).lastAutoTable.finalY + 10;
        
        // Monitors Section
        doc.setFontSize(14);
        doc.setTextColor(125, 1, 1);
        doc.text('Monitor Setup', 14, currentY);
        currentY += 10;
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        
        const monitorData = [];
        monitorData.push(['Wedge Monitors', `${data.gearSetup.available_monitors || 0}`]);
        monitorData.push(['Side Fills', data.gearSetup.has_side_fills ? 'Yes' : 'No']);
        monitorData.push(['Drum Fills', data.gearSetup.has_drum_fills ? 'Yes' : 'No']);
        monitorData.push(['DJ Booths', data.gearSetup.has_dj_booths ? 'Yes' : 'No']);
        monitorData.push(['Other', data.gearSetup.extras_wired || 'N/A']);
        
        autoTable(doc, {
          startY: currentY,
          head: [['Type', 'Details']],
          body: monitorData,
          theme: 'striped',
          headStyles: {
            fillColor: [220, 220, 220],
            textColor: [0, 0, 0]
          }
        });
        
        currentY = (doc as any).lastAutoTable.finalY + 10;
        
        // Infrastructure Section
        doc.setFontSize(14);
        doc.setTextColor(125, 1, 1);
        doc.text('Infrastructure', 14, currentY);
        currentY += 10;
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        
        const infraData = [];
        if (data.gearSetup.available_cat6_runs > 0) {
          infraData.push(['CAT6', `${data.gearSetup.available_cat6_runs}`]);
        }
        if (data.gearSetup.available_hma_runs > 0) {
          infraData.push(['HMA', `${data.gearSetup.available_hma_runs}`]);
        }
        if (data.gearSetup.available_coax_runs > 0) {
          infraData.push(['Coax', `${data.gearSetup.available_coax_runs}`]);
        }
        if (data.gearSetup.available_opticalcon_duo_runs > 0) {
          infraData.push(['Opticalcon Duo', `${data.gearSetup.available_opticalcon_duo_runs}`]);
        }
        if (data.gearSetup.available_analog_runs > 0) {
          infraData.push(['Analog', `${data.gearSetup.available_analog_runs}`]);
        }
        
        if (data.gearSetup.other_infrastructure) {
          infraData.push(['Other', data.gearSetup.other_infrastructure]);
        }
        
        if (infraData.length > 0) {
          autoTable(doc, {
            startY: currentY,
            head: [['Type', 'Quantity/Details']],
            body: infraData,
            theme: 'striped',
            headStyles: {
              fillColor: [220, 220, 220],
              textColor: [0, 0, 0]
            }
          });
        }
        
        currentY = (doc as any).lastAutoTable.finalY + 10;
        
        // Notes Section
        if (data.gearSetup.notes) {
          doc.setFontSize(14);
          doc.setTextColor(125, 1, 1);
          doc.text('Notes', 14, currentY);
          currentY += 10;
          
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(10);
          
          const splitNotes = doc.splitTextToSize(data.gearSetup.notes, pageWidth - 28);
          doc.text(splitNotes, 14, currentY);
        }
        
        // Add page numbers
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFontSize(10);
          doc.setTextColor(100, 100, 100);
          doc.text(
            `Page ${i} of ${totalPages}`,
            pageWidth / 2,
            pageHeight - 10,
            { align: 'center' }
          );
        }
        
        const pdfBlob = doc.output('blob');
        console.log(`Generated gear setup PDF of size ${pdfBlob.size} bytes`);
        resolve(pdfBlob);
      }
    } catch (error) {
      console.error('Error generating gear setup PDF:', error);
      reject(error);
    }
  });
};

export const generateStageGearPDF = async (
  jobId: string,
  selectedDate: string,
  stageNumber: number,
  stageName?: string
): Promise<Blob> => {
  try {
    console.log(`Generating gear setup PDF for stage ${stageNumber} on ${selectedDate}`);
    
    // Fetch job details
    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .select("title")
      .eq("id", jobId)
      .single();
    
    if (jobError) throw jobError;
    
    // Fetch gear setup
    const { data: gearSetup, error: gearError } = await supabase
      .from("festival_gear_setups")
      .select("*")
      .eq("job_id", jobId)
      .eq("date", selectedDate)
      .single();
    
    if (gearError) throw gearError;
    
    // Fetch logo URL
    const { data: logoData } = await supabase
      .from("festival_logos")
      .select("file_path")
      .eq("job_id", jobId)
      .maybeSingle();
    
    let logoUrl;
    if (logoData?.file_path) {
      const { data: { publicUrl } } = supabase
        .storage
        .from('festival-logos')
        .getPublicUrl(logoData.file_path);
      
      logoUrl = publicUrl;
    }
    
    // Generate PDF
    const pdfData: GearSetupPdfData = {
      jobTitle: jobData.title,
      stageNumber,
      stageName,
      date: selectedDate,
      gearSetup,
      logoUrl
    };
    
    return await exportGearSetupPDF(pdfData);
  } catch (error) {
    console.error('Error generating stage gear PDF:', error);
    throw error;
  }
};
