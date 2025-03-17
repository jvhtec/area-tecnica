import { PDFDocument } from 'pdf-lib';
import { exportArtistPDF, ArtistPdfData } from './artistPdfExport';
import { exportArtistTablePDF, ArtistTablePdfData } from './artistTablePdfExport';
import { exportShiftsTablePDF, ShiftsTablePdfData } from './shiftsTablePdfExport';
import { generateStageGearPDF } from './gearSetupPdfExport';
import { supabase } from '@/lib/supabase';

export const fetchLogoUrl = async (jobId: string): Promise<string | undefined> => {
  try {
    const { data, error } = await supabase
      .from("festival_settings")
      .select("logo_url")
      .eq("job_id", jobId)
      .single();
      
    if (error) {
      console.error("Error fetching festival logo:", error);
      return undefined;
    }
    
    if (data?.logo_url) {
      const logoPath = data.logo_url;
      console.log("Retrieved logo path:", logoPath);
      
      if (logoPath.startsWith('http')) {
        return logoPath;
      } 
      else {
        try {
          let bucket = 'festival-assets';
          let path = logoPath;
          
          if (logoPath.includes('/')) {
            const parts = logoPath.split('/', 1);
            bucket = parts[0];
            path = logoPath.substring(bucket.length + 1);
          }
          
          console.log(`Getting public URL for bucket: ${bucket}, path: ${path}`);
          const { data: publicUrlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(path);
            
          if (publicUrlData?.publicUrl) {
            console.log("Generated public URL:", publicUrlData.publicUrl);
            return publicUrlData.publicUrl;
          }
        } catch (storageErr) {
          console.error("Error getting public URL:", storageErr);
        }
      }
    }
    return undefined;
  } catch (err) {
    console.error("Error in logo fetch:", err);
    return undefined;
  }
};

// Create a cover page with basic festival information
const generateCoverPage = async (
  jobId: string,
  jobTitle: string,
  logoUrl?: string
): Promise<Blob> => {
  try {
    console.log("Generating cover page for festival documentation");
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    
    const { width, height } = page.getSize();
    
    // Get festival dates for the cover page
    const { data: jobData } = await supabase
      .from("jobs")
      .select("start_time, end_time")
      .eq("id", jobId)
      .single();
      
    let dateRangeText = "";
    if (jobData?.start_time && jobData?.end_time) {
      const startDate = new Date(jobData.start_time);
      const endDate = new Date(jobData.end_time);
      
      const options: Intl.DateTimeFormatOptions = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      };
      
      if (startDate.getTime() === endDate.getTime()) {
        dateRangeText = startDate.toLocaleDateString(undefined, options);
      } else {
        dateRangeText = `${startDate.toLocaleDateString(undefined, options)} - ${endDate.toLocaleDateString(undefined, options)}`;
      }
    }
    
    // Add a red header bar
    page.drawRectangle({
      x: 0,
      y: height - 100,
      width: width,
      height: 100,
      color: { red: 0.87, green: 0.22, blue: 0.2 },
    });
    
    // Add title with large font
    page.drawText("FESTIVAL DOCUMENTATION", {
      x: 50,
      y: height - 60,
      size: 24,
      color: { red: 1, green: 1, blue: 1 },
    });
    
    // Add festival title
    page.drawText(jobTitle, {
      x: 50,
      y: height / 2 + 50,
      size: 36,
      color: { red: 0, green: 0, blue: 0 },
    });
    
    // Add date range if available
    if (dateRangeText) {
      page.drawText(dateRangeText, {
        x: 50,
        y: height / 2,
        size: 16,
        color: { red: 0.3, green: 0.3, blue: 0.3 },
      });
    }
    
    // Add "Complete Technical Documentation" text
    page.drawText("Complete Technical Documentation", {
      x: 50,
      y: height / 2 - 50,
      size: 16,
      color: { red: 0.5, green: 0.5, blue: 0.5 },
    });
    
    // Add logo if available
    if (logoUrl) {
      try {
        const logoResponse = await fetch(logoUrl);
        const logoImageData = await logoResponse.arrayBuffer();
        let logoImage;
        
        // Determine the type of image and embed it
        if (logoUrl.toLowerCase().endsWith('.png')) {
          logoImage = await pdfDoc.embedPng(logoImageData);
        } else if (logoUrl.toLowerCase().endsWith('.jpg') || logoUrl.toLowerCase().endsWith('.jpeg')) {
          logoImage = await pdfDoc.embedJpg(logoImageData);
        }
        
        if (logoImage) {
          const imgWidth = 150;
          const imgHeight = (logoImage.height / logoImage.width) * imgWidth;
          
          page.drawImage(logoImage, {
            x: width - imgWidth - 50,
            y: height / 2 - (imgHeight / 2),
            width: imgWidth,
            height: imgHeight,
          });
        }
      } catch (logoError) {
        console.error("Error adding logo to cover page:", logoError);
      }
    }
    
    // Add footer with page number
    page.drawText("Page 1", {
      x: width / 2,
      y: 30,
      size: 10,
      color: { red: 0.5, green: 0.5, blue: 0.5 },
    });
    
    // Add generation date
    const currentDate = new Date().toLocaleDateString();
    page.drawText(`Generated on: ${currentDate}`, {
      x: 50,
      y: 50,
      size: 10,
      color: { red: 0.5, green: 0.5, blue: 0.5 },
    });
    
    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  } catch (error) {
    console.error("Error generating cover page:", error);
    throw error;
  }
};

// Create a table of contents page
const generateTableOfContents = async (
  sections: { title: string; pageCount: number }[],
  logoUrl?: string
): Promise<Blob> => {
  try {
    console.log("Generating table of contents");
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    
    const { width, height } = page.getSize();
    
    // Add a red header bar
    page.drawRectangle({
      x: 0,
      y: height - 100,
      width: width,
      height: 100,
      color: { red: 0.87, green: 0.22, blue: 0.2 },
    });
    
    // Add title
    page.drawText("TABLE OF CONTENTS", {
      x: 50,
      y: height - 60,
      size: 24,
      color: { red: 1, green: 1, blue: 1 },
    });
    
    // Add logo if available
    if (logoUrl) {
      try {
        const logoResponse = await fetch(logoUrl);
        const logoImageData = await logoResponse.arrayBuffer();
        let logoImage;
        
        if (logoUrl.toLowerCase().endsWith('.png')) {
          logoImage = await pdfDoc.embedPng(logoImageData);
        } else if (logoUrl.toLowerCase().endsWith('.jpg') || logoUrl.toLowerCase().endsWith('.jpeg')) {
          logoImage = await pdfDoc.embedJpg(logoImageData);
        }
        
        if (logoImage) {
          const imgWidth = 100;
          const imgHeight = (logoImage.height / logoImage.width) * imgWidth;
          
          page.drawImage(logoImage, {
            x: width - imgWidth - 50,
            y: height - 60 - (imgHeight / 2) + 10,
            width: imgWidth,
            height: imgHeight,
          });
        }
      } catch (logoError) {
        console.error("Error adding logo to TOC:", logoError);
      }
    }
    
    // List sections with page numbers
    let currentY = height - 150;
    let pageCounter = 3; // Start at 3 because cover + TOC = 2 pages
    
    // Draw table header
    page.drawText("Section", {
      x: 50,
      y: currentY,
      size: 14,
      color: { red: 0, green: 0, blue: 0 },
    });
    
    page.drawText("Page", {
      x: width - 100,
      y: currentY,
      size: 14,
      color: { red: 0, green: 0, blue: 0 },
    });
    
    currentY -= 20;
    
    // Draw line separator
    page.drawLine({
      start: { x: 50, y: currentY },
      end: { x: width - 50, y: currentY },
      thickness: 1,
      color: { red: 0.8, green: 0.8, blue: 0.8 },
    });
    
    currentY -= 30;
    
    // Add each section to the TOC
    for (const section of sections) {
      page.drawText(section.title, {
        x: 50,
        y: currentY,
        size: 12,
        color: { red: 0, green: 0, blue: 0 },
      });
      
      page.drawText(pageCounter.toString(), {
        x: width - 100,
        y: currentY,
        size: 12,
        color: { red: 0, green: 0, blue: 0 },
      });
      
      // Add dots between section name and page number
      let dotX = 250;
      while (dotX < width - 105) {
        page.drawText(".", {
          x: dotX,
          y: currentY,
          size: 12,
          color: { red: 0.7, green: 0.7, blue: 0.7 },
        });
        dotX += 10;
      }
      
      pageCounter += section.pageCount;
      currentY -= 30;
    }
    
    // Add footer with page number
    page.drawText("Page 2", {
      x: width / 2,
      y: 30,
      size: 10,
      color: { red: 0.5, green: 0.5, blue: 0.5 },
    });
    
    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  } catch (error) {
    console.error("Error generating table of contents:", error);
    throw error;
  }
};

export const mergePDFs = async (pdfBlobs: Blob[]): Promise<Blob> => {
  try {
    console.log(`Attempting to merge ${pdfBlobs.length} PDF documents`);
    
    if (pdfBlobs.length === 0) {
      throw new Error('No PDFs provided for merging');
    }
    
    if (pdfBlobs.length === 1) {
      console.log('Only one PDF provided, returning it directly');
      return pdfBlobs[0];
    }
    
    const mergedPdf = await PDFDocument.create();
    
    for (let i = 0; i < pdfBlobs.length; i++) {
      try {
        const pdfBlob = pdfBlobs[i];
        console.log(`Processing PDF ${i+1}/${pdfBlobs.length}, size: ${pdfBlob.size} bytes`);
        
        if (!pdfBlob || pdfBlob.size === 0) {
          console.warn(`Skipping empty PDF at index ${i}`);
          continue;
        }
        
        const arrayBuffer = await pdfBlob.arrayBuffer();
        
        try {
          const pdfDoc = await PDFDocument.load(arrayBuffer, { 
            ignoreEncryption: true,
            throwOnInvalidObject: false,
            updateMetadata: false
          });
          
          const pageIndices = pdfDoc.getPageIndices();
          console.log(`PDF ${i+1} has ${pageIndices.length} pages`);
          
          if (pageIndices.length === 0) {
            console.warn(`PDF ${i+1} has no pages, skipping`);
            continue;
          }
          
          for (const pageIndex of pageIndices) {
            try {
              const [copiedPage] = await mergedPdf.copyPages(pdfDoc, [pageIndex]);
              mergedPdf.addPage(copiedPage);
              console.log(`Copied page ${pageIndex+1} from PDF ${i+1}`);
            } catch (pageError) {
              console.error(`Error copying page ${pageIndex+1} from PDF ${i+1}:`, pageError);
              continue;
            }
          }
        } catch (pdfError) {
          console.error(`Error processing PDF content at index ${i}:`, pdfError);
          console.log(`Problematic PDF size: ${pdfBlob.size} bytes`);
          continue;
        }
      } catch (err) {
        console.error(`Error processing PDF at index ${i}:`, err);
        continue;
      }
    }
    
    const pageCount = mergedPdf.getPageCount();
    console.log(`Merged document has ${pageCount} pages`);
    
    if (pageCount === 0) {
      throw new Error('No valid pages found in the provided PDFs');
    }
    
    console.log(`Successfully merged ${pageCount} pages`);
    const mergedPdfBytes = await mergedPdf.save();
    return new Blob([mergedPdfBytes], { type: 'application/pdf' });
  } catch (error) {
    console.error('Error merging PDFs:', error);
    throw new Error(`Failed to merge PDF documents: ${error.message}`);
  }
};

export const generateAndMergeFestivalPDFs = async (
  jobId: string,
  jobTitle: string
): Promise<Blob> => {
  console.log("Starting comprehensive PDF generation for festival:", jobTitle);

  const logoUrl = await fetchLogoUrl(jobId);
  console.log("Logo URL for PDFs:", logoUrl);
  
  // Organize PDFs in groups for easier tracking and TOC generation
  const gearPdfs: Blob[] = [];
  const shiftPdfs: Blob[] = [];
  const artistTablePdfs: Blob[] = [];
  const individualArtistPdfs: Blob[] = [];
  
  try {
    // Fetch artist data
    const { data: artists, error: artistError } = await supabase
      .from("festival_artists")
      .select("*")
      .eq("job_id", jobId);
    
    if (artistError) throw artistError;
    
    // Fetch technical info
    const { data: technicalInfo, error: technicalError } = await supabase
      .from("festival_artist_technical_info")
      .select("*")
      .eq("job_id", jobId);
      
    if (technicalError) {
      console.error("Error fetching technical info:", technicalError);
    }
    
    // Fetch infrastructure info
    const { data: infrastructureInfo, error: infraError } = await supabase
      .from("festival_artist_infrastructure_info")
      .select("*")
      .eq("job_id", jobId);
      
    if (infraError) {
      console.error("Error fetching infrastructure info:", infraError);
    }
    
    // Fetch extras info
    const { data: extrasInfo, error: extrasError } = await supabase
      .from("festival_artist_extras")
      .select("*")
      .eq("job_id", jobId);
      
    if (extrasError) {
      console.error("Error fetching extras info:", extrasError);
    }
    
    // Create maps for different types of artist info
    const techInfoMap = new Map();
    const infraInfoMap = new Map();
    const extrasInfoMap = new Map();
    
    if (technicalInfo) {
      technicalInfo.forEach(item => {
        if (item.artist_id) {
          techInfoMap.set(item.artist_id, item);
        }
      });
    }
    
    if (infrastructureInfo) {
      infrastructureInfo.forEach(item => {
        if (item.artist_id) {
          infraInfoMap.set(item.artist_id, item);
        }
      });
    }
    
    if (extrasInfo) {
      extrasInfo.forEach(item => {
        if (item.artist_id) {
          extrasInfoMap.set(item.artist_id, item);
        }
      });
    }

    // Extract unique dates from artists
    const uniqueDates = [...new Set(artists?.map(a => a.date) || [])];
    
    // ====== 1. FIRST GENERATE GEAR SETUP PDFS ======
    console.log("Starting gear setup PDF generation for dates:", uniqueDates);
    for (const date of uniqueDates) {
      if (!date) continue;
      
      console.log(`Fetching gear setup data for date ${date}`);
      const { data: gearSetupData, error: gearSetupError } = await supabase
        .from("festival_gear_setups")
        .select("*")
        .eq("job_id", jobId)
        .eq("date", date)
        .single();
      
      if (gearSetupError) {
        console.error(`Error fetching gear setup for date ${date}:`, gearSetupError);
        continue;
      }
      
      if (gearSetupData) {
        const maxStages = gearSetupData.max_stages || 1;
        console.log(`Found gear setup with ${maxStages} stages for date ${date}`);
        
        // Fetch stage names
        const { data: stages } = await supabase
          .from("festival_stages")
          .select("*")
          .eq("job_id", jobId);
        
        // Generate PDF for each stage
        for (let stageNum = 1; stageNum <= maxStages; stageNum++) {
          try {
            console.log(`Generating gear setup PDF for stage ${stageNum} on date ${date}`);
            const stageObj = stages?.find(s => s.number === stageNum);
            const stageName = stageObj ? stageObj.name : `Stage ${stageNum}`;
            
            const pdf = await generateStageGearPDF(jobId, date, stageNum, stageName);
            
            console.log(`Generated gear setup PDF for stage ${stageNum}, size: ${pdf.size} bytes`);
            if (pdf && pdf.size > 0) {
              gearPdfs.push(pdf);
            } else {
              console.warn(`Generated empty gear setup PDF for stage ${stageNum}, skipping`);
            }
          } catch (err) {
            console.error(`Error generating gear setup PDF for stage ${stageNum}:`, err);
          }
        }
      } else {
        console.log(`No gear setup found for date ${date}, skipping gear setup PDF generation`);
      }
    }
    
    // ====== 2. GENERATE SHIFT TABLE PDFS ======
    console.log("Starting shift table PDF generation for dates:", uniqueDates);
    for (const date of uniqueDates) {
      if (!date) continue;
      
      console.log(`Fetching shifts data for date ${date}`);
      const { data: shiftsData, error: shiftsError } = await supabase
        .from("festival_shifts")
        .select(`
          id, job_id, name, date, start_time, end_time, department, stage,
          assignments:festival_shift_assignments(
            id, shift_id, technician_id, role,
            profiles:technician_id(id, first_name, last_name, email, department, role)
          )
        `)
        .eq("job_id", jobId)
        .eq("date", date);
      
      if (shiftsError) {
        console.error(`Error fetching shifts for date ${date}:`, shiftsError);
        continue;
      }
      
      console.log(`Found ${shiftsData?.length || 0} shifts for date ${date}`);
      
      if (shiftsData && shiftsData.length > 0) {
        try {
          console.log(`Generating shifts PDF for date ${date}`);
          const typedShifts = shiftsData.map(shift => {
            const typedAssignments = (shift.assignments || []).map(assignment => {
              let profileData = null;
              
              if (assignment.profiles) {
                const profilesData = assignment.profiles as any;
                
                if (Array.isArray(profilesData) && profilesData.length > 0) {
                  profileData = {
                    id: profilesData[0].id,
                    first_name: profilesData[0].first_name,
                    last_name: profilesData[0].last_name,
                    email: profilesData[0].email,
                    department: profilesData[0].department,
                    role: profilesData[0].role
                  };
                } else if (typeof profilesData === 'object' && profilesData !== null) {
                  profileData = {
                    id: profilesData.id,
                    first_name: profilesData.first_name,
                    last_name: profilesData.last_name,
                    email: profilesData.email,
                    department: profilesData.department,
                    role: profilesData.role
                  };
                }
              }
              
              return {
                id: assignment.id,
                shift_id: assignment.shift_id,
                technician_id: assignment.technician_id,
                role: assignment.role,
                profiles: profileData
              };
            });
            
            return {
              id: shift.id,
              job_id: shift.job_id,
              date: shift.date,
              start_time: shift.start_time,
              end_time: shift.end_time,
              name: shift.name,
              department: shift.department || undefined,
              stage: shift.stage ? Number(shift.stage) : undefined,
              assignments: typedAssignments
            };
          });
          
          // Create the shifts table PDF data
          const shiftsTableData: ShiftsTablePdfData = {
            jobTitle: jobTitle || 'Festival',
            date: date,
            jobId: jobId,
            shifts: typedShifts,
            logoUrl
          };
          
          console.log(`Creating shifts table PDF with ${typedShifts.length} shifts`);
          const pdf = await exportShiftsTablePDF(shiftsTableData);
          
          console.log(`Generated shifts PDF for date ${date}, size: ${pdf.size} bytes`);
          if (pdf && pdf.size > 0) {
            shiftPdfs.push(pdf);
          } else {
            console.warn(`Generated empty shifts PDF for date ${date}, skipping`);
          }
        } catch (err) {
          console.error(`Error generating shifts PDF for date ${date}:`, err);
        }
      } else {
        console.log(`No shifts found for date ${date}, skipping shifts PDF generation`);
      }
    }
    
    // ====== 3. GENERATE ARTIST TABLE PDFS ======
    // Generate stage-specific artist table PDFs for each date
    for (const date of uniqueDates) {
      if (!date) continue;
      
      const stageMap = new Map<number, any[]>();
      
      artists?.filter(a => a.date === date).forEach(artist => {
        if (!stageMap.has(artist.stage)) {
          stageMap.set(artist.stage, []);
        }
        stageMap.get(artist.stage)?.push(artist);
      });
      
      const { data: stages } = await supabase
        .from("festival_stages")
        .select("*")
        .eq("job_id", jobId);
      
      for (const [stageNum, stageArtists] of stageMap.entries()) {
        if (stageArtists.length === 0) continue;
        
        const stageObj = stages?.find(s => s.number === stageNum);
        const stageName = stageObj ? stageObj.name : `Stage ${stageNum}`;
        
        const tableData: ArtistTablePdfData = {
          jobTitle: jobTitle || 'Festival',
          date: date,
          stage: stageName,
          artists: stageArtists.map(a => ({
            name: String(a.name || ''),
            stage: Number(a.stage || 1),
            showTime: { 
              start: String(a.show_start || ''), 
              end: String(a.show_end || '') 
            },
            soundcheck: a.soundcheck_start ? { 
              start: String(a.soundcheck_start || ''), 
              end: String(a.soundcheck_end || '') 
            } : undefined,
            technical: {
              fohTech: Boolean(a.foh_tech || false),
              monTech: Boolean(a.mon_tech || false),
              fohConsole: { 
                model: String(a.foh_console || ''), 
                providedBy: String(a.foh_console_provided_by || 'festival') 
              },
              monConsole: { 
                model: String(a.mon_console || ''), 
                providedBy: String(a.mon_console_provided_by || 'festival') 
              },
              wireless: {
                hh: Number(a.wireless_quantity_hh || 0),
                bp: Number(a.wireless_quantity_bp || 0),
                providedBy: String(a.wireless_provided_by || 'festival')
              },
              iem: {
                quantity: Number(a.iem_quantity || 0),
                providedBy: String(a.iem_provided_by || 'festival')
              },
              monitors: {
                enabled: Boolean(a.monitors_enabled || false),
                quantity: Number(a.monitors_quantity || 0)
              }
            },
            extras: {
              sideFill: Boolean(a.extras_sf || false),
              drumFill: Boolean(a.extras_df || false),
              djBooth: Boolean(a.extras_djbooth || false)
            },
            notes: String(a.notes || '')
          })),
          logoUrl
        };
        
        try {
          console.log(`Generating table PDF for ${date} Stage ${stageNum}`);
          const pdf = await exportArtistTablePDF(tableData);
          console.log(`Generated table PDF, size: ${pdf.size} bytes`);
          if (pdf && pdf.size > 0) {
            artistTablePdfs.push(pdf);
          } else {
            console.warn(`Generated empty table PDF for ${date} Stage ${stageNum}, skipping`);
          }
        } catch (err) {
          console.error(`Error generating table PDF for ${date} Stage ${stageNum}:`, err);
        }
      }
    }
    
    // ====== 4. GENERATE INDIVIDUAL ARTIST PDFS ======
    console.log(`Starting PDF generation for ${artists?.length || 0} artists`);
    
    // Generate individual artist PDFs
    if (artists && artists.length > 0) {
      for (const artist of artists) {
        try {
          console.log(`Generating PDF for artist: ${artist.name}`);
          
          const artistData: ArtistPdfData = {
            name: artist.name || 'Unnamed Artist',
            stage: artist.stage || 1,
            date: artist.date || '',
            schedule: {
              show: { 
                start: artist.show_start || '', 
                end: artist.show_end || '' 
              },
              soundcheck: artist.soundcheck_start ? {
                start: artist.soundcheck_start || '',
                end: artist.soundcheck_end || ''
              } : undefined
            },
            technical: {
              fohTech: Boolean(artist.foh_tech || false),
              monTech: Boolean(artist.mon_tech || false),
              fohConsole: { 
                model: String(artist.foh_console || ''), 
                providedBy: String(artist.foh_console_provided_by || 'festival') 
              },
              monConsole: { 
                model: String(artist.mon_console || ''), 
                providedBy: String(artist.mon_console_provided_by || 'festival') 
              },
              wireless: {
                model: String(artist.wireless_model || ''),
                providedBy: String(artist.wireless_provided_by || 'festival'),
                handhelds: Number(artist.wireless_quantity_hh || 0),
                bodypacks: Number(artist.wireless_quantity_bp || 0),
                band: String(artist.wireless_band || '')
              },
              iem: {
                model: String(artist.iem_model || ''),
                providedBy: String(artist.iem_provided_by || 'festival'),
                quantity: Number(artist.iem_quantity || 0),
                band: String(artist.iem_band || '')
              },
              monitors: {
                enabled: Boolean(artist.monitors_enabled || false),
                quantity: Number(artist.monitors_quantity || 0)
              }
            },
            infrastructure: {
              providedBy: String(artist.infrastructure_provided_by || 'festival'),
              cat6: { 
                enabled: Boolean(artist.infra_cat6 || false), 
                quantity: Number(artist.infra_cat6_quantity || 0) 
              },
              hma: { 
                enabled: Boolean(artist.infra_hma || false), 
                quantity: Number(artist.infra_hma_quantity || 0) 
              },
              coax: { 
                enabled: Boolean(artist.infra_coax || false), 
                quantity: Number(artist.infra_coax_quantity || 0) 
              },
              opticalconDuo: { 
                enabled: Boolean(artist.infra_opticalcon_duo || false), 
                quantity: Number(artist.infra_opticalcon_duo_quantity || 0) 
              },
              analog: Number(artist.infra_analog || 0),
              other: String(artist.other_infrastructure || '')
            },
            extras: {
              sideFill: Boolean(artist.extras_sf || false),
              drumFill: Boolean(artist.extras_df || false),
              djBooth: Boolean(artist.extras_djbooth || false),
              wired: String(artist.extras_wired || '')
            },
            notes: artist.notes ? String(artist.notes) : undefined,
            logoUrl
          };
          
          const pdf = await exportArtistPDF(artistData);
          console.log(`Generated PDF for artist ${artist.name}, size: ${pdf.size} bytes`);
          if (pdf && pdf.size > 0) {
            individualArtistPdfs.push(pdf);
          } else {
            console.warn(`Generated empty PDF for artist ${artist.name}, skipping`);
          }
        } catch (err) {
          console.error(`Error generating PDF for artist ${artist.name}:`, err);
        }
      }
    }
    
    // ====== CREATE TOC AND COMBINE EVERYTHING ======
    // Create a table of contents
    const tocSections = [
      { title: "Stage Equipment Setup", pageCount: gearPdfs.length },
      { title: "Staff Shift Schedules", pageCount: shiftPdfs.length },
      { title: "Artist Schedule Tables", pageCount: artistTablePdfs.length },
      { title: "Individual Artist Requirements", pageCount: individualArtistPdfs.length }
    ];
    
    // Create cover and TOC
    const coverPage = await generateCoverPage(jobId, jobTitle, logoUrl);
    const tableOfContents = await generateTableOfContents(tocSections, logoUrl);
    
    // Combine everything in the desired order
    const allPdfs = [
      coverPage,
      tableOfContents,
      ...gearPdfs,
      ...shiftPdfs,
      ...artistTablePdfs,
      ...individualArtistPdfs
    ];
    
    console.log(`Total PDFs to merge: ${allPdfs.length}`);
    
    if (allPdfs.length <= 2) { // Only cover and TOC
      throw new Error('No valid documents were generated beyond cover and TOC');
    }
    
    return await mergePDFs(allPdfs);
    
  } catch (error) {
    console.error('Error generating festival PDFs:', error);
    throw error;
  }
};
