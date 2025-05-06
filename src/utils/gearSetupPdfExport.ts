
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { CombinedGearSetup } from '@/types/festival';

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
      
      // === HEADER SECTION ===
      doc.setFillColor(125, 1, 1); // Corporate red color used in other PDFs
      doc.rect(0, 0, pageWidth, 30, 'F');
      
      // Load festival logo if provided
      const loadLogoPromise = data.logoUrl 
        ? new Promise<void>((resolveLogoLoad) => {
            console.log("Attempting to load logo from URL:", data.logoUrl);
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
              try {
                console.log("Logo loaded successfully");
                // Calculate logo dimensions (max height 20px in header)
                const maxHeight = 20;
                const ratio = img.width / img.height;
                const logoHeight = Math.min(maxHeight, img.height);
                const logoWidth = logoHeight * ratio;
                
                // Add logo to top right corner
                doc.addImage(
                  img, 
                  'PNG', 
                  5, // X position (left margin)
                  5, // Y position (top margin)
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
        // Title in header
        doc.setFontSize(18);
        doc.setTextColor(255, 255, 255); // White text for header
        doc.text(`Stage ${data.stageNumber} Gear Setup`, pageWidth / 2, 15, { align: 'center' });
        
        // Subtitle in header
        doc.setFontSize(12);
        doc.text(format(new Date(data.date), 'MMMM d, yyyy'), pageWidth / 2, 25, { align: 'center' });
        
        let currentY = 40;
        
        // FOH and MON Console Section
        doc.setFontSize(14);
        doc.setTextColor(125, 1, 1); // Corporate red for section headers
        doc.text('Console Setup', 14, currentY);
        currentY += 10;
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        
        const consoleData = [];
        
        // Add all FOH consoles
        if (data.gearSetup.foh_consoles && data.gearSetup.foh_consoles.length > 0) {
          data.gearSetup.foh_consoles.forEach(console => {
            consoleData.push(['FOH Console', `${console.model} (${console.quantity})`]);
          });
        }
        
        // Add all MON consoles
        if (data.gearSetup.mon_consoles && data.gearSetup.mon_consoles.length > 0) {
          data.gearSetup.mon_consoles.forEach(console => {
            consoleData.push(['MON Console', `${console.model} (${console.quantity})`]);
          });
        }
        
        if (consoleData.length > 0) {
          autoTable(doc, {
            startY: currentY,
            head: [['Type', 'Model (Quantity)']],
            body: consoleData,
            theme: 'grid',
            styles: {
              fontSize: 9,
              cellPadding: 3,
              lineWidth: 0.1,
            },
            headStyles: {
              fillColor: [125, 1, 1],
              textColor: [255, 255, 255]
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
            'IEM Channels', 
            iem.model || 'N/A', 
            `${iem.quantity_hh || 0}`,
            iem.band || 'N/A'
          ]);
          wirelessData.push([
            'IEM Bodypacks', 
            iem.model || 'N/A', 
            `${iem.quantity_bp || 0}`,
            iem.band || 'N/A'
          ]);
        }
        
        if (wirelessData.length > 0) {
          autoTable(doc, {
            startY: currentY,
            head: [['Type', 'Model', 'Quantity', 'Band']],
            body: wirelessData,
            theme: 'grid',
            styles: {
              fontSize: 9,
              cellPadding: 3,
              lineWidth: 0.1,
            },
            headStyles: {
              fillColor: [125, 1, 1],
              textColor: [255, 255, 255]
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
        monitorData.push(['Wedge Monitors', `${data.gearSetup.monitors_quantity || 0}`]);
        monitorData.push(['Side Fills', data.gearSetup.extras_sf ? 'Yes' : 'No']);
        monitorData.push(['Drum Fills', data.gearSetup.extras_df ? 'Yes' : 'No']);
        monitorData.push(['DJ Booths', data.gearSetup.extras_djbooth ? 'Yes' : 'No']);
        monitorData.push(['Other', data.gearSetup.extras_wired || 'N/A']);
        
        autoTable(doc, {
          startY: currentY,
          head: [['Type', 'Details']],
          body: monitorData,
          theme: 'grid',
          styles: {
            fontSize: 9,
            cellPadding: 3,
            lineWidth: 0.1,
          },
          headStyles: {
            fillColor: [125, 1, 1],
            textColor: [255, 255, 255]
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
        if (data.gearSetup.infra_cat6) {
          infraData.push(['CAT6', `${data.gearSetup.infra_cat6_quantity || 0}`]);
        }
        if (data.gearSetup.infra_hma) {
          infraData.push(['HMA', `${data.gearSetup.infra_hma_quantity || 0}`]);
        }
        if (data.gearSetup.infra_coax) {
          infraData.push(['Coax', `${data.gearSetup.infra_coax_quantity || 0}`]);
        }
        if (data.gearSetup.infra_opticalcon_duo) {
          infraData.push(['Opticalcon Duo', `${data.gearSetup.infra_opticalcon_duo_quantity || 0}`]);
        }
        if (data.gearSetup.infra_analog > 0) {
          infraData.push(['Analog', `${data.gearSetup.infra_analog || 0}`]);
        }
        
        if (data.gearSetup.other_infrastructure) {
          infraData.push(['Other', data.gearSetup.other_infrastructure]);
        }
        
        if (infraData.length > 0) {
          autoTable(doc, {
            startY: currentY,
            head: [['Type', 'Quantity/Details']],
            body: infraData,
            theme: 'grid',
            styles: {
              fontSize: 9,
              cellPadding: 3,
              lineWidth: 0.1,
            },
            headStyles: {
              fillColor: [125, 1, 1],
              textColor: [255, 255, 255]
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
        
        // Add company logo at the bottom
        try {
          // Add a small company logo at the bottom right
          const companyLogoUrl = '/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png';
          const companyImg = new Image();
          companyImg.onload = () => {
            try {
              // Logo at bottom right
              const logoWidth = 40;
              const ratio = companyImg.width / companyImg.height;
              const logoHeight = logoWidth / ratio;
              
              doc.addImage(
                companyImg, 
                'PNG', 
                pageWidth - logoWidth - 10, // X position (right aligned)
                pageHeight - logoHeight - 10, // Y position (bottom aligned)
                logoWidth,
                logoHeight
              );
              
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
              
              // Finalize PDF
              const pdfBlob = doc.output('blob');
              console.log(`Generated gear setup PDF of size ${pdfBlob.size} bytes`);
              resolve(pdfBlob);
            } catch (err) {
              console.error('Error adding company logo to PDF:', err);
              
              // Add page numbers even if logo fails
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
              resolve(pdfBlob);
            }
          };
          companyImg.onerror = () => {
            console.error('Failed to load company logo');
            
            // Add page numbers even if logo fails to load
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
            resolve(pdfBlob);
          };
          companyImg.src = companyLogoUrl;
        } catch (logoErr) {
          console.error('Error with company logo in gear setup PDF:', logoErr);
          
          // Add page numbers even if there's an error with the logo
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
          resolve(pdfBlob);
        }
      }).catch(err => {
        console.error("Error in PDF generation:", err);
        reject(err);
      });
    } catch (error) {
      console.error('Error generating gear setup PDF:', error);
      reject(error);
    }
  });
};

export const generateStageGearPDF = async (
  jobId: string,
  stageNumber: number,
  stageName?: string
): Promise<Blob | null> => {
  try {
    console.log(`Generating gear setup PDF for stage ${stageNumber}`);
    
    // Fetch job details
    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .select("title")
      .eq("id", jobId)
      .single();
    
    if (jobError) throw jobError;
    
    // Fetch global gear setup
    const { data: globalSetupData, error: globalError } = await supabase
      .from("festival_gear_setups")
      .select("*")
      .eq("job_id", jobId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (globalError) throw globalError;
    
    if (!globalSetupData || globalSetupData.length === 0) {
      console.log('No global gear setup found for this festival');
      return null;
    }
    
    const globalSetup = globalSetupData[0];
    
    // Fetch stage-specific gear setup if it exists
    const { data: stageSetup, error: stageError } = await supabase
      .from("festival_stage_gear_setups")
      .select("*")
      .eq("gear_setup_id", globalSetup.id)
      .eq("stage_number", stageNumber)
      .maybeSingle();
    
    if (stageError) {
      console.error('Error fetching stage-specific setup:', stageError);
    }

    // Combine global and stage-specific data
    // Start with global setup data
    let combinedSetup = { ...globalSetup };
    
    // Override with stage-specific data where available
    if (stageSetup) {
      console.log('Using stage-specific gear setup for PDF generation');
      
      // Override fields that can be customized at the stage level
      combinedSetup = {
        ...globalSetup,
        foh_consoles: stageSetup.foh_consoles || globalSetup.foh_consoles,
        mon_consoles: stageSetup.mon_consoles || globalSetup.mon_consoles,
        wireless_systems: stageSetup.wireless_systems || globalSetup.wireless_systems,
        iem_systems: stageSetup.iem_systems || globalSetup.iem_systems,
        
        // Monitor setup
        monitors_quantity: stageSetup.monitors_quantity,
        extras_sf: stageSetup.extras_sf,
        extras_df: stageSetup.extras_df,
        extras_djbooth: stageSetup.extras_djbooth,
        extras_wired: stageSetup.extras_wired || globalSetup.extras_wired,
        
        // Infrastructure
        infra_cat6: stageSetup.infra_cat6,
        infra_cat6_quantity: stageSetup.infra_cat6_quantity,
        infra_hma: stageSetup.infra_hma,
        infra_hma_quantity: stageSetup.infra_hma_quantity,
        infra_coax: stageSetup.infra_coax,
        infra_coax_quantity: stageSetup.infra_coax_quantity,
        infra_opticalcon_duo: stageSetup.infra_opticalcon_duo,
        infra_opticalcon_duo_quantity: stageSetup.infra_opticalcon_duo_quantity,
        infra_analog: stageSetup.infra_analog,
        other_infrastructure: stageSetup.other_infrastructure || globalSetup.other_infrastructure,
        
        // Notes
        notes: stageSetup.notes || globalSetup.notes
      };
    }
    
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
      date: new Date().toISOString().split('T')[0], // Current date as fallback
      gearSetup: combinedSetup,
      logoUrl
    };
    
    return await exportGearSetupPDF(pdfData);
  } catch (error) {
    console.error('Error generating stage gear PDF:', error);
    throw error;
  }
};
