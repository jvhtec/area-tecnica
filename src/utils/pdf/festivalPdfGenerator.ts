import { supabase } from '@/lib/supabase';
import { exportArtistPDF, ArtistPdfData } from '../artistPdfExport';
import { exportArtistTablePDF, ArtistTablePdfData } from '../artistTablePdfExport';
import { exportShiftsTablePDF, ShiftsTablePdfData } from '../shiftsTablePdfExport';
import { exportRfIemTablePDF, RfIemTablePdfData } from '../rfIemTablePdfExport';
import { exportInfrastructureTablePDF, ArtistInfrastructureData } from '../infrastructureTablePdfExport';
import { exportMissingRiderReportPDF, MissingRiderReportData } from '../missingRiderReportPdfExport';
import { generateStageGearPDF } from '../gearSetupPdfExport';
import { fetchLogoUrl } from './logoUtils';
import { generateCoverPage } from './coverPageGenerator';
import { generateTableOfContents } from './tocGenerator';
import { mergePDFs } from './pdfMerge';
import { sortChronologically, groupByDateChronologically } from '../timeUtils';
import { PrintOptions } from "@/components/festival/pdf/PrintOptionsDialog";

interface FestivalDate {
  date: string;
  type: string;
}

const fetchFestivalDates = async (jobId: string): Promise<FestivalDate[]> => {
  const { data: dateTypes, error } = await supabase
    .from("job_date_types")
    .select("date, type")
    .eq("job_id", jobId)
    .order("date", { ascending: true });

  if (error) {
    console.error("Error fetching date types:", error);
    return [];
  }

  return dateTypes || [];
};

export const generateAndMergeFestivalPDFs = async (
  jobId: string,
  jobTitle: string,
  options: PrintOptions,
  customFilename?: string
): Promise<{ blob: Blob; filename: string }> => {
  console.log("Starting comprehensive PDF generation with options:", options);

  const logoUrl = await fetchLogoUrl(jobId);
  console.log("Logo URL for PDFs:", logoUrl);
  
  const gearPdfs: Blob[] = [];
  const shiftPdfs: Blob[] = [];
  const artistTablePdfs: Blob[] = [];
  const individualArtistPdfs: Blob[] = [];
  let rfIemTablePdf: Blob | null = null;
  let infrastructureTablePdf: Blob | null = null;
  let missingRiderReportPdf: Blob | null = null;
  
  try {
    // Fetch all festival dates with types
    const festivalDates = await fetchFestivalDates(jobId);
    console.log("Festival dates found:", festivalDates);

    // Fetch all artists
    const { data: artists, error: artistError } = await supabase
      .from("festival_artists")
      .select("*")
      .eq("job_id", jobId);
    
    if (artistError) throw artistError;
    
    if (options.includeGearSetup && options.gearSetupStages.length > 0) {
      console.log("Starting gear setup PDF generation for stages:", options.gearSetupStages);
      
      for (const stageNum of options.gearSetupStages) {
        try {
          const { data: stages } = await supabase
            .from("festival_stages")
            .select("*")
            .eq("job_id", jobId);
          
          const stageObj = stages?.find(s => s.number === stageNum);
          const stageName = stageObj ? stageObj.name : `Stage ${stageNum}`;
          
          const pdf = await generateStageGearPDF(jobId, stageNum, stageName);
          
          if (pdf && pdf.size > 0) {
            console.log(`Generated gear setup PDF for stage ${stageNum}, size: ${pdf.size} bytes`);
            gearPdfs.push(pdf);
          } else {
            console.log(`No gear setup found for stage ${stageNum}, skipping`);
          }
        } catch (err) {
          console.error(`Error generating gear setup PDF for stage ${stageNum}:`, err);
        }
      }
    }
    
    // Process shift schedules for ALL festival dates (including setup days)
    if (options.includeShiftSchedules) {
      console.log("Starting shift table PDF generation for all festival dates:", festivalDates);
      
      for (const festivalDate of festivalDates) {
        const { data: shiftsData, error: shiftsError } = await supabase
          .from("festival_shifts")
          .select(`
            id, job_id, name, date, start_time, end_time, department, stage
          `)
          .eq("job_id", jobId)
          .eq("date", festivalDate.date);
        
        if (shiftsError) {
          console.error(`Error fetching shifts for ${festivalDate.date}:`, shiftsError);
          continue;
        }
        
        const filteredShifts = shiftsData?.filter(shift => 
          !shift.stage || options.shiftScheduleStages.includes(Number(shift.stage))
        );
        
        if (filteredShifts && filteredShifts.length > 0) {
          try {
            console.log(`Generating shifts PDF for ${festivalDate.type} day ${festivalDate.date} with ${filteredShifts.length} shifts`);
          
            const shiftsWithAssignments = await Promise.all(filteredShifts.map(async (shift) => {
              try {
                const { data: assignmentsData, error: assignmentsError } = await supabase
                  .from("festival_shift_assignments")
                  .select(`
                    id, shift_id, technician_id, external_technician_name, role
                  `)
                  .eq("shift_id", shift.id);
                
                if (assignmentsError) {
                  console.error(`Error fetching assignments for shift ${shift.id}:`, assignmentsError);
                  return { ...shift, assignments: [] };
                }
                
                const assignmentsWithProfiles = await Promise.all((assignmentsData || []).map(async (assignment) => {
                  if (!assignment.technician_id && !assignment.external_technician_name) {
                    return { ...assignment, profiles: null };
                  }
                  
                  if (assignment.external_technician_name) {
                    return { 
                      ...assignment, 
                      profiles: null,
                      external_technician_name: assignment.external_technician_name
                    };
                  }
                  
                  try {
                    const { data: profileData, error: profileError } = await supabase
                      .from("profiles")
                      .select(`id, first_name, last_name, email, department, role`)
                      .eq("id", assignment.technician_id)
                      .single();
                      
                    if (profileError) {
                      console.error(`Error fetching profile for technician ${assignment.technician_id}:`, profileError);
                      return { ...assignment, profiles: null };
                    }
                    
                    return { ...assignment, profiles: profileData };
                  } catch (err) {
                    console.error(`Error processing profile data for technician ${assignment.technician_id}:`, err);
                    return { ...assignment, profiles: null };
                  }
                }));
                
                return { ...shift, assignments: assignmentsWithProfiles || [] };
              } catch (err) {
                console.error(`Error processing assignments for shift ${shift.id}:`, err);
                return { ...shift, assignments: [] };
              }
            }));
          
            const typedShifts = shiftsWithAssignments.map(shift => {
              return {
                id: shift.id,
                job_id: shift.job_id,
                date: shift.date,
                start_time: shift.start_time,
                end_time: shift.end_time,
                name: shift.name,
                department: shift.department || undefined,
                stage: shift.stage ? Number(shift.stage) : undefined,
                assignments: shift.assignments.map(assignment => ({
                  ...assignment,
                  external_technician_name: assignment.external_technician_name || undefined
                }))
              };
            });
          
            const shiftsTableData: ShiftsTablePdfData = {
              jobTitle: jobTitle || 'Festival',
              date: festivalDate.date,
              dateType: festivalDate.type,
              jobId: jobId,
              shifts: typedShifts,
              logoUrl
            };
          
            console.log(`Creating shifts table PDF with ${typedShifts.length} shifts for ${festivalDate.type} day and logoUrl: ${logoUrl}`);
            const shiftPdf = await exportShiftsTablePDF(shiftsTableData);
          
            console.log(`Generated shifts PDF for ${festivalDate.type} day ${festivalDate.date}, size: ${shiftPdf.size} bytes, type: ${shiftPdf.type}`);
            if (shiftPdf && shiftPdf.size > 0) {
              shiftPdfs.push(shiftPdf);
              console.log(`Added shift PDF to array. Current count: ${shiftPdfs.length}`);
            } else {
              console.warn(`Generated empty shifts PDF for ${festivalDate.type} day ${festivalDate.date}, skipping`);
            }
          } catch (err) {
            console.error(`Error generating shifts PDF for ${festivalDate.type} day ${festivalDate.date}:`, err);
          }
        } else {
          console.log(`No shifts found for ${festivalDate.type} day ${festivalDate.date}, skipping shifts PDF generation`);
        }
      }
    }
    
    // Process artist tables chronologically across all dates
    if (options.includeArtistTables && artists && artists.length > 0) {
      console.log("Starting chronological artist table generation");
      
      // Sort all artists chronologically across all dates
      const sortedArtists = sortChronologically(
        artists.map(artist => ({
          ...artist,
          time: artist.show_start
        }))
      );
      
      // Group by date while maintaining chronological order
      const artistsByDate = groupByDateChronologically(sortedArtists);
      
      // Generate PDFs for each date in chronological order
      for (const [date, dateArtists] of Object.entries(artistsByDate)) {
        const stageArtists = dateArtists.filter(a => 
          options.artistTableStages.includes(Number(a.stage))
        );
        
        if (stageArtists.length > 0) {
          const stageMap = new Map<number, any[]>();
          
          stageArtists.forEach(artist => {
            if (!stageMap.has(artist.stage)) {
              stageMap.set(artist.stage, []);
            }
            stageMap.get(artist.stage)?.push(artist);
          });
          
          const { data: stages } = await supabase
            .from("festival_stages")
            .select("*")
            .eq("job_id", jobId);
          
          // Find date type for this date
          const dateTypeInfo = festivalDates.find(fd => fd.date === date);
          
          for (const [stageNum, filteredArtists] of stageMap.entries()) {
            if (filteredArtists.length === 0) continue;
            
            const stageObj = stages?.find(s => s.number === stageNum);
            const stageName = stageObj ? stageObj.name : `Stage ${stageNum}`;
            
            const tableData: ArtistTablePdfData = {
              jobTitle: jobTitle,
              date: date,
              dateType: dateTypeInfo?.type,
              stage: stageName,
              artists: filteredArtists.map(artist => {
                // Convert the database wireless_systems and iem_systems to the correct format
                const wirelessSystems = (artist.wireless_systems || []).map((system: any) => ({
                  model: system.model || '',
                  quantity_hh: system.quantity_hh || 0,
                  quantity_bp: system.quantity_bp || 0,
                  band: system.band || ''
                }));
                
                const iemSystems = (artist.iem_systems || []).map((system: any) => ({
                  model: system.model || '',
                  quantity_hh: system.quantity_hh || 0,
                  quantity_bp: system.quantity_bp || 0,
                  quantity: system.quantity || 0,
                  band: system.band || ''
                }));
                
                return {
                  name: String(artist.name || ''),
                  stage: Number(artist.stage || 1),
                  showTime: { 
                    start: String(artist.show_start || ''), 
                    end: String(artist.show_end || '') 
                  },
                  soundcheck: artist.soundcheck_start ? { 
                    start: String(artist.soundcheck_start || ''), 
                    end: String(artist.soundcheck_end || '') 
                  } : undefined,
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
                      systems: wirelessSystems,
                      providedBy: String(artist.wireless_provided_by || 'festival')
                    },
                    iem: {
                      systems: iemSystems,
                      providedBy: String(artist.iem_provided_by || 'festival')
                    },
                    monitors: {
                      enabled: Boolean(artist.monitors_enabled || false),
                      quantity: Number(artist.monitors_quantity || 0)
                    }
                  },
                  extras: {
                    sideFill: Boolean(artist.extras_sf || false),
                    drumFill: Boolean(artist.extras_df || false),
                    djBooth: Boolean(artist.extras_djbooth || false)
                  },
                  notes: String(artist.notes || '')
                };
              }),
              logoUrl
            };
            
            try {
              console.log(`Generating chronological table PDF for ${dateTypeInfo?.type || 'Unknown'} day ${date} Stage ${stageNum}`);
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
      }
    }
    
    // Process individual artist requirements chronologically
    if (options.includeArtistRequirements && artists && artists.length > 0) {
      const filteredArtists = artists.filter(artist => 
        options.artistRequirementStages.includes(Number(artist.stage))
      );
      
      // Sort artists chronologically across all dates and times
      const sortedArtists = sortChronologically(
        filteredArtists.map(artist => ({
          ...artist,
          time: artist.show_start
        }))
      );
      
      console.log(`Sorted ${sortedArtists.length} artists chronologically for PDF generation`);
      
      for (const artist of sortedArtists) {
        try {
          console.log(`Generating PDF for artist: ${artist.name}, Stage: ${artist.stage}, Date: ${artist.date}, Time: ${artist.show_start}`);
          
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
                systems: artist.wireless_systems || [],
                providedBy: String(artist.wireless_provided_by || 'festival'),
                model: String(artist.wireless_model || ''),
                handhelds: Number(artist.wireless_quantity_hh || 0),
                bodypacks: Number(artist.wireless_quantity_bp || 0),
                band: String(artist.wireless_band || '')
              },
              iem: {
                systems: artist.iem_systems || [],
                providedBy: String(artist.iem_provided_by || 'festival'),
                model: String(artist.iem_model || ''),
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
            notes: String(artist.notes || '')
          };

          const pdf = await exportArtistPDF(artistData);
          console.log(`Generated individual artist PDF for ${artist.name}, size: ${pdf.size} bytes`);
          if (pdf && pdf.size > 0) {
            individualArtistPdfs.push(pdf);
          }
        } catch (err) {
          console.error(`Error generating PDF for artist ${artist.name}:`, err);
        }
      }
    }
    
    // Generate RF/IEM table with chronological sorting
    if (options.includeRfIemTable && artists && artists.length > 0) {
      const filteredArtists = artists.filter(artist => 
        options.rfIemTableStages.includes(Number(artist.stage))
      );
      
      // Sort artists chronologically
      const sortedArtists = sortChronologically(
        filteredArtists.map(artist => ({
          ...artist,
          time: artist.show_start
        }))
      );
      
      const rfIemData: RfIemTablePdfData = {
        jobTitle: jobTitle || 'Festival',
        jobId: jobId,
        artists: sortedArtists,
        logoUrl
      };
      
      try {
        console.log(`Generating RF/IEM table PDF with ${sortedArtists.length} artists`);
        rfIemTablePdf = await exportRfIemTablePDF(rfIemData);
        console.log(`Generated RF/IEM table PDF, size: ${rfIemTablePdf.size} bytes`);
      } catch (err) {
        console.error('Error generating RF/IEM table PDF:', err);
      }
    }
    
    // Generate infrastructure table with chronological sorting
    if (options.includeInfrastructureTable && artists && artists.length > 0) {
      const filteredArtists = artists.filter(artist => 
        options.infrastructureTableStages.includes(Number(artist.stage))
      );
      
      // Sort artists chronologically
      const sortedArtists = sortChronologically(
        filteredArtists.map(artist => ({
          ...artist,
          time: artist.show_start
        }))
      );
      
      const infrastructureData: ArtistInfrastructureData = {
        jobTitle: jobTitle || 'Festival',
        jobId: jobId,
        artists: sortedArtists,
        logoUrl
      };
      
      try {
        console.log(`Generating infrastructure table PDF with ${sortedArtists.length} artists`);
        infrastructureTablePdf = await exportInfrastructureTablePDF(infrastructureData);
        console.log(`Generated infrastructure table PDF, size: ${infrastructureTablePdf.size} bytes`);
      } catch (err) {
        console.error('Error generating infrastructure table PDF:', err);
      }
    }
    
    // Generate missing rider report with chronological sorting
    if (options.includeMissingRiderReport && artists && artists.length > 0) {
      const missingRiderArtists = artists.filter(artist => artist.rider_missing);
      
      if (missingRiderArtists.length > 0) {
        // Sort artists chronologically
        const sortedMissingRiderArtists = sortChronologically(
          missingRiderArtists.map(artist => ({
            ...artist,
            time: artist.show_start
          }))
        );
        
        const missingRiderData: MissingRiderReportData = {
          jobTitle: jobTitle || 'Festival',
          artists: sortedMissingRiderArtists,
          logoUrl
        };
        
        try {
          console.log(`Generating missing rider report PDF with ${sortedMissingRiderArtists.length} artists`);
          missingRiderReportPdf = await exportMissingRiderReportPDF(missingRiderData);
          console.log(`Generated missing rider report PDF, size: ${missingRiderReportPdf.size} bytes`);
        } catch (err) {
          console.error('Error generating missing rider report PDF:', err);
        }
      }
    }
    
    const tocSections = [];
    
    if (options.includeShiftSchedules && shiftPdfs.length > 0) {
      tocSections.push({ title: "Staff Shift Schedules", pageCount: shiftPdfs.length });
    }
    if (options.includeGearSetup && gearPdfs.length > 0) {
      tocSections.push({ title: "Stage Equipment Setup", pageCount: gearPdfs.length });
    }
    if (options.includeArtistTables && artistTablePdfs.length > 0) {
      tocSections.push({ title: "Artist Schedule Tables", pageCount: artistTablePdfs.length });
    }
    if (options.includeRfIemTable && rfIemTablePdf) {
      tocSections.push({ title: "Artist RF & IEM Overview", pageCount: 1 });
    }
    if (options.includeInfrastructureTable && infrastructureTablePdf) {
      tocSections.push({ title: "Infrastructure Needs Overview", pageCount: 1 });
    }
    if (options.includeMissingRiderReport && missingRiderReportPdf) {
      tocSections.push({ title: "Missing Rider Report", pageCount: 1 });
    }
    if (options.includeArtistRequirements && individualArtistPdfs.length > 0) {
      tocSections.push({ title: "Individual Artist Requirements", pageCount: individualArtistPdfs.length });
    }
    
    console.log(`Table of contents sections:`, tocSections);
    
    const coverPage = await generateCoverPage(jobId, jobTitle, logoUrl);
    const tableOfContents = await generateTableOfContents(tocSections, logoUrl);
    
    // Updated PDF order according to requirements
    const selectedPdfs = [
      coverPage,
      tableOfContents,
      ...(options.includeShiftSchedules ? shiftPdfs : []),       // 1. Staff Shifts Schedule
      ...(options.includeGearSetup ? gearPdfs : []),             // 2. Stage Equipment Setups
      ...(options.includeArtistTables ? artistTablePdfs : []),   // 3. Artist Schedule Tables
      ...(options.includeRfIemTable && rfIemTablePdf ? [rfIemTablePdf] : []),  // 4. RF and IEM Overview
      ...(options.includeInfrastructureTable && infrastructureTablePdf ? [infrastructureTablePdf] : []),  // 5. Infrastructure Needs Overview
      ...(options.includeMissingRiderReport && missingRiderReportPdf ? [missingRiderReportPdf] : []),  // 6. Missing Rider Report
      ...(options.includeArtistRequirements ? individualArtistPdfs : [])  // 7. Individual Artist Requirements
    ];
    
    console.log(`Total PDFs to merge: ${selectedPdfs.length}`);
    
    if (selectedPdfs.length <= 2) {
      throw new Error('No documents were selected for generation');
    }
    
    const mergedBlob = await mergePDFs(selectedPdfs);
    
    // Generate filename if not provided
    const filename = customFilename || `${jobTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_Complete_Documentation.pdf`;
    
    return { blob: mergedBlob, filename };
  } catch (error) {
    console.error('Error generating festival PDFs:', error);
    throw error;
  }
};
