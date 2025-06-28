
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

      // Get the gear setup (no date filter needed)
      const { data: gearSetup, error: gearError } = await supabase
        .from("festival_gear_setups")
        .select("*")
        .eq("job_id", jobId)
        .maybeSingle();

      if (gearError) {
        console.error("Error fetching gear setup:", gearError);
        reject(gearError);
        return;
      }

      if (!gearSetup) {
        console.log(`No gear setup found for job ${jobId}`);
        reject(new Error(`No gear setup found for festival`));
        return;
      }

      console.log(`Found gear setup:`, gearSetup);

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

      // Determine which data to use: stage-specific takes priority over global
      const setupToUse = stageSetup || gearSetup;
      const isStageSpecific = !!stageSetup;
      
      console.log(`Using ${isStageSpecific ? 'stage-specific' : 'global'} setup data for stage ${stageNumber}:`, setupToUse);

      const doc = new jsPDF({ orientation: 'portrait' });
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const footerHeight = 50; // Reserve space for logo and footer
      const maxContentHeight = pageHeight - footerHeight;

      // Page management functions
      const checkPageBreak = (requiredHeight: number, currentY: number): number => {
        if (currentY + requiredHeight > maxContentHeight) {
          doc.addPage();
          addPageHeader();
          return 30; // Return new Y position after header
        }
        return currentY;
      };

      const addPageHeader = () => {
        // Header with corporate red color
        doc.setFillColor(125, 1, 1);
        doc.rect(0, 0, pageWidth, 20, 'F');

        // Title with custom stage name
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.text(`${jobData.title} - ${actualStageName}`, pageWidth / 2, 8, { align: 'center' });
        doc.text(`Equipment Setup`, pageWidth / 2, 15, { align: 'center' });
      };

      // Initial header
      addPageHeader();

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

      let yPosition = 30;

      // Add configuration note if using stage-specific setup
      if (isStageSpecific) {
        yPosition = checkPageBreak(10, yPosition);
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(`Configuration: Stage-specific setup for ${actualStageName}`, 14, yPosition);
        yPosition += 10;
      }

      // Equipment sections
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);

      // FOH Consoles
      if (setupToUse.foh_consoles && setupToUse.foh_consoles.length > 0) {
        yPosition = checkPageBreak(60, yPosition);
        
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
          margin: { left: 14, right: 14 },
          pageBreak: 'auto',
          showHead: 'everyPage',
          didDrawPage: () => {
            if (doc.internal.pages.length > 2) { // More than 1 page (pages array includes empty first element)
              addPageHeader();
            }
          }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Monitor Consoles
      if (setupToUse.mon_consoles && setupToUse.mon_consoles.length > 0) {
        yPosition = checkPageBreak(60, yPosition);
        
        doc.setFontSize(14);
        doc.setTextColor(125, 1, 1);
        doc.text('Monitor Consoles', 14, yPosition);
        yPosition += 10;

        const monData = setupToUse.mon_consoles.map((console: any) => [
          console.model || 'N/A',
          console.quantity?.toString() || '1',
          console.notes || ''
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Model', 'Quantity', 'Notes']],
          body: monData,
          theme: 'grid',
          headStyles: { fillColor: [125, 1, 1] },
          margin: { left: 14, right: 14 },
          pageBreak: 'auto',
          showHead: 'everyPage',
          didDrawPage: () => {
            if (doc.internal.pages.length > 2) {
              addPageHeader();
            }
          }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Monitors
      yPosition = checkPageBreak(20, yPosition);
      
      doc.setFontSize(14);
      doc.setTextColor(125, 1, 1);
      doc.text('Monitors', 14, yPosition);
      yPosition += 10;

      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      const monitorQuantity = setupToUse.monitors_quantity || (isStageSpecific ? 0 : setupToUse.available_monitors || 0);
      doc.text(`Available Monitors: ${monitorQuantity}`, 14, yPosition);
      yPosition += 10;

      // Wireless
      if (setupToUse.wireless_systems && setupToUse.wireless_systems.length > 0) {
        yPosition = checkPageBreak(60, yPosition);
        
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
          margin: { left: 14, right: 14 },
          pageBreak: 'auto',
          showHead: 'everyPage',
          didDrawPage: () => {
            if (doc.internal.pages.length > 2) {
              addPageHeader();
            }
          }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // IEM
      if (setupToUse.iem_systems && setupToUse.iem_systems.length > 0) {
        yPosition = checkPageBreak(60, yPosition);
        
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
          margin: { left: 14, right: 14 },
          pageBreak: 'auto',
          showHead: 'everyPage',
          didDrawPage: () => {
            if (doc.internal.pages.length > 2) {
              addPageHeader();
            }
          }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Wired Microphones
      if (setupToUse.wired_mics && setupToUse.wired_mics.length > 0) {
        yPosition = checkPageBreak(60, yPosition);
        
        doc.setFontSize(14);
        doc.setTextColor(125, 1, 1);
        doc.text('Wired Microphones', 14, yPosition);
        yPosition += 10;

        const wiredMicData = setupToUse.wired_mics.map((mic: any) => [
          mic.model || 'N/A',
          mic.quantity?.toString() || '1',
          mic.exclusive_use ? 'Yes' : 'No',
          mic.notes || ''
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Model', 'Quantity', 'Exclusive Use', 'Notes']],
          body: wiredMicData,
          theme: 'grid',
          headStyles: { fillColor: [125, 1, 1] },
          margin: { left: 14, right: 14 },
          pageBreak: 'auto',
          showHead: 'everyPage',
          didDrawPage: () => {
            if (doc.internal.pages.length > 2) {
              addPageHeader();
            }
          }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Infrastructure
      yPosition = checkPageBreak(50, yPosition);
      
      doc.setFontSize(14);
      doc.setTextColor(125, 1, 1);
      doc.text('Infrastructure', 14, yPosition);
      yPosition += 10;

      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      
      // Use stage-specific infrastructure if available, otherwise fall back to global
      const cat6Runs = setupToUse.infra_cat6_quantity !== undefined ? setupToUse.infra_cat6_quantity : (setupToUse.available_cat6_runs || 0);
      const hmaRuns = setupToUse.infra_hma_quantity !== undefined ? setupToUse.infra_hma_quantity : (setupToUse.available_hma_runs || 0);
      const coaxRuns = setupToUse.infra_coax_quantity !== undefined ? setupToUse.infra_coax_quantity : (setupToUse.available_coax_runs || 0);
      const analogRuns = setupToUse.infra_analog !== undefined ? setupToUse.infra_analog : (setupToUse.available_analog_runs || 0);
      const opticalconRuns = setupToUse.infra_opticalcon_duo_quantity !== undefined ? setupToUse.infra_opticalcon_duo_quantity : (setupToUse.available_opticalcon_duo_runs || 0);
      
      yPosition = checkPageBreak(40, yPosition);
      doc.text(`Available CAT6 Runs: ${cat6Runs}`, 14, yPosition);
      yPosition += 8;
      doc.text(`Available HMA Runs: ${hmaRuns}`, 14, yPosition);
      yPosition += 8;
      doc.text(`Available Coax Runs: ${coaxRuns}`, 14, yPosition);
      yPosition += 8;
      doc.text(`Available Analog Runs: ${analogRuns}`, 14, yPosition);
      yPosition += 8;
      doc.text(`Available Opticalcon Duo Runs: ${opticalconRuns}`, 14, yPosition);
      yPosition += 10;

      // Extras
      yPosition = checkPageBreak(30, yPosition);
      
      doc.setFontSize(14);
      doc.setTextColor(125, 1, 1);
      doc.text('Extras', 14, yPosition);
      yPosition += 10;

      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      
      // Use stage-specific extras if available, otherwise fall back to global
      const sideFills = setupToUse.extras_sf !== undefined ? setupToUse.extras_sf : (setupToUse.has_side_fills || false);
      const drumFills = setupToUse.extras_df !== undefined ? setupToUse.extras_df : (setupToUse.has_drum_fills || false);
      const djBooths = setupToUse.extras_djbooth !== undefined ? setupToUse.extras_djbooth : (setupToUse.has_dj_booths || false);
      
      doc.text(`Side Fills: ${sideFills ? 'Yes' : 'No'}`, 14, yPosition);
      yPosition += 8;
      doc.text(`Drum Fills: ${drumFills ? 'Yes' : 'No'}`, 14, yPosition);
      yPosition += 8;
      doc.text(`DJ Booths: ${djBooths ? 'Yes' : 'No'}`, 14, yPosition);
      yPosition += 10;

      // Notes
      if (setupToUse.notes) {
        yPosition = checkPageBreak(30, yPosition);
        
        doc.setFontSize(14);
        doc.setTextColor(125, 1, 1);
        doc.text('Notes', 14, yPosition);
        yPosition += 10;

        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        const notes = doc.splitTextToSize(setupToUse.notes, pageWidth - 28);
        const notesHeight = notes.length * 6;
        yPosition = checkPageBreak(notesHeight, yPosition);
        doc.text(notes, 14, yPosition);
        yPosition += notesHeight;
      }

      // Add footer and logo to all pages
      const totalPages = doc.internal.pages.length - 1; // Subtract 1 because pages array includes empty first element
      
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        
        // Footer text
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        const generatedDate = format(new Date(), 'dd/MM/yyyy HH:mm');
        doc.text(`Generated: ${generatedDate}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
        doc.text(`${actualStageName} Equipment Setup`, 14, pageHeight - 10);
      }

      // Add Sector Pro logo at bottom center of last page
      try {
        const sectorLogoPath = '/sector pro logo.png';
        const sectorImg = new Image();
        sectorImg.onload = () => {
          try {
            const logoWidth = 30;
            const ratio = sectorImg.width / sectorImg.height;
            const logoHeight = logoWidth / ratio;
            
            // Add logo to all pages
            for (let i = 1; i <= totalPages; i++) {
              doc.setPage(i);
              doc.addImage(
                sectorImg, 
                'PNG', 
                pageWidth/2 - logoWidth/2,
                pageHeight - logoHeight - 15,
                logoWidth,
                logoHeight
              );
            }
            
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
