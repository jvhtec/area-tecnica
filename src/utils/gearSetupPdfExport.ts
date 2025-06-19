import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';

export const generateStageGearPDF = async (
  jobId: string,
  stageNumber: number,
  stageName?: string
): Promise<Blob> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(`Starting PDF generation for stage ${stageNumber} (${stageName})`);
      
      // Fetch stage name from database if not provided
      let actualStageName = stageName;
      if (!actualStageName) {
        const { data: stageData, error: stageError } = await supabase
          .from("festival_stages")
          .select("name")
          .eq("job_id", jobId)
          .eq("number", stageNumber)
          .maybeSingle();
        
        if (stageError) {
          console.error("Error fetching stage name:", stageError);
        }
        
        actualStageName = stageData?.name || `Stage ${stageNumber}`;
      }

      // Fetch job data
      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("title")
        .eq("id", jobId)
        .single();

      if (jobError) {
        console.error("Error fetching job data:", jobError);
        reject(jobError);
        return;
      }

      // Get the gear setup for the stage
      const { data: gearSetup, error: gearError } = await supabase
        .from("festival_gear_setups")
        .select("*")
        .eq("job_id", jobId)
        .order("date")
        .limit(1)
        .maybeSingle();

      if (gearError) {
        console.error("Error fetching gear setup:", gearError);
        reject(gearError);
        return;
      }

      if (!gearSetup) {
        console.log("No gear setup found for this job");
        reject(new Error("No gear setup found"));
        return;
      }

      // Check for stage-specific setup
      const { data: stageSetup, error: stageSetupError } = await supabase
        .from("festival_stage_gear_setups")
        .select("*")
        .eq("gear_setup_id", gearSetup.id)
        .eq("stage_number", stageNumber)
        .maybeSingle();

      if (stageSetupError) {
        console.error("Error fetching stage setup:", stageSetupError);
      }

      // Use stage-specific setup if available, otherwise use global setup
      const setupToUse = stageSetup || gearSetup;
      
      console.log("Using setup data:", setupToUse);

      const doc = new jsPDF({ orientation: 'portrait' });
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;

      // Header with corporate red color
      doc.setFillColor(125, 1, 1);
      doc.rect(0, 0, pageWidth, 20, 'F');

      // Load logo
      const loadLogoPromise = new Promise<void>((resolveLogoLoad) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          try {
            const maxHeight = 18;
            const ratio = img.width / img.height;
            const logoHeight = Math.min(maxHeight, img.height);
            const logoWidth = logoHeight * ratio;
            
            doc.addImage(
              img, 
              'JPEG', 
              5, 
              1,
              logoWidth,
              logoHeight
            );
            resolveLogoLoad();
          } catch (err) {
            console.error('Error adding logo to PDF:', err);
            resolveLogoLoad();
          }
        };
        img.onerror = (e) => {
          console.error('Error loading logo image:', e);
          resolveLogoLoad();
        };
        img.src = `/logos/${jobId}.jpg`;
      });

      await loadLogoPromise;

      // Title with custom stage name
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text(`${jobData.title} - ${actualStageName}`, pageWidth / 2, 8, { align: 'center' });
      doc.text('Equipment Setup', pageWidth / 2, 15, { align: 'center' });

      let yPosition = 30;

      // Equipment sections
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);

      // FOH Consoles
      if (setupToUse.foh_consoles && setupToUse.foh_consoles.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(125, 1, 1);
        doc.text('FOH Consoles', 14, yPosition);
        yPosition += 10;

        const fohData = setupToUse.foh_consoles.map((console: any) => [
          console.model || 'N/A',
          console.quantity?.toString() || '1',
          console.notes || ''
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Model', 'Quantity', 'Notes']],
          body: fohData,
          theme: 'grid',
          headStyles: { fillColor: [125, 1, 1] },
          margin: { left: 14, right: 14 }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Monitors
      doc.setFontSize(14);
      doc.setTextColor(125, 1, 1);
      doc.text('Monitors', 14, yPosition);
      yPosition += 10;

      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`Available Monitors: ${setupToUse.available_monitors || 0}`, 14, yPosition);
      yPosition += 10;

      // Wireless
      if (setupToUse.wireless_systems && setupToUse.wireless_systems.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(125, 1, 1);
        doc.text('Wireless Systems', 14, yPosition);
        yPosition += 10;

        const wirelessData = setupToUse.wireless_systems.map((system: any) => [
          system.model || 'N/A',
          system.quantity_hh?.toString() || '0',
          system.quantity_bp?.toString() || '0',
          system.band || 'N/A',
          system.notes || ''
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Model', 'HH Quantity', 'BP Quantity', 'Band', 'Notes']],
          body: wirelessData,
          theme: 'grid',
          headStyles: { fillColor: [125, 1, 1] },
          margin: { left: 14, right: 14 }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // IEM
      if (setupToUse.iem_systems && setupToUse.iem_systems.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(125, 1, 1);
        doc.text('IEM Systems', 14, yPosition);
        yPosition += 10;

        const iemData = setupToUse.iem_systems.map((system: any) => [
          system.model || 'N/A',
          system.quantity_hh?.toString() || '0',
          system.quantity_bp?.toString() || '0',
          system.band || 'N/A',
          system.notes || ''
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Model', 'HH Quantity', 'BP Quantity', 'Band', 'Notes']],
          body: iemData,
          theme: 'grid',
          headStyles: { fillColor: [125, 1, 1] },
          margin: { left: 14, right: 14 }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Infrastructure
      doc.setFontSize(14);
      doc.setTextColor(125, 1, 1);
      doc.text('Infrastructure', 14, yPosition);
      yPosition += 10;

      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`Available CAT6 Runs: ${setupToUse.available_cat6_runs || 0}`, 14, yPosition);
      yPosition += 8;
      doc.text(`Available HMA Runs: ${setupToUse.available_hma_runs || 0}`, 14, yPosition);
      yPosition += 8;
      doc.text(`Available Coax Runs: ${setupToUse.available_coax_runs || 0}`, 14, yPosition);
      yPosition += 8;
      doc.text(`Available Analog Runs: ${setupToUse.available_analog_runs || 0}`, 14, yPosition);
      yPosition += 8;
      doc.text(`Available Opticalcon Duo Runs: ${setupToUse.available_opticalcon_duo_runs || 0}`, 14, yPosition);
      yPosition += 10;

      // Extras
      doc.setFontSize(14);
      doc.setTextColor(125, 1, 1);
      doc.text('Extras', 14, yPosition);
      yPosition += 10;

      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`Side Fills: ${setupToUse.has_side_fills ? 'Yes' : 'No'}`, 14, yPosition);
      yPosition += 8;
      doc.text(`Drum Fills: ${setupToUse.has_drum_fills ? 'Yes' : 'No'}`, 14, yPosition);
      yPosition += 8;
      doc.text(`DJ Booths: ${setupToUse.has_dj_booths ? 'Yes' : 'No'}`, 14, yPosition);
      yPosition += 10;

      // Notes
      if (setupToUse.notes) {
        doc.setFontSize(14);
        doc.setTextColor(125, 1, 1);
        doc.text('Notes', 14, yPosition);
        yPosition += 10;

        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        const notes = doc.splitTextToSize(setupToUse.notes, pageWidth - 28);
        doc.text(notes, 14, yPosition);
        yPosition += 10;
      }

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      const generatedDate = format(new Date(), 'dd/MM/yyyy HH:mm');
      doc.text(`Generated: ${generatedDate}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
      doc.text(`${actualStageName} Equipment Setup`, 14, pageHeight - 10);

      // Add Sector Pro logo at bottom center
      try {
        const sectorLogoPath = '/sector pro logo.png';
        const sectorImg = new Image();
        sectorImg.onload = () => {
          try {
            const logoWidth = 30;
            const ratio = sectorImg.width / sectorImg.height;
            const logoHeight = logoWidth / ratio;
            
            doc.addImage(
              sectorImg, 
              'PNG', 
              pageWidth/2 - logoWidth/2,
              pageHeight - logoHeight - 15,
              logoWidth,
              logoHeight
            );
            
            const blob = doc.output('blob');
            console.log(`PDF generated successfully for ${actualStageName}`);
            resolve(blob);
          } catch (err) {
            console.error('Error adding Sector Pro logo:', err);
            const blob = doc.output('blob');
            resolve(blob);
          }
        };
        
        sectorImg.onerror = () => {
          const blob = doc.output('blob');
          resolve(blob);
        };
        
        sectorImg.src = sectorLogoPath;
      } catch (logoErr) {
        console.error('Error loading Sector Pro logo:', logoErr);
        const blob = doc.output('blob');
        resolve(blob);
      }
    } catch (error) {
      console.error('Error generating stage gear PDF:', error);
      reject(error);
    }
  });
};
