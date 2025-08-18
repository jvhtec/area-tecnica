import { supabase } from '@/lib/supabase';
import { exportArtistPDF, ArtistPdfData } from '../artistPdfExport';
import { exportArtistTablePDF, ArtistTablePdfData } from '../artistTablePdfExport';
import { exportShiftsTablePDF, ShiftsTablePdfData } from '../shiftsTablePdfExport';
import { exportRfIemTablePDF, RfIemTablePdfData } from '../rfIemTablePdfExport';
import { exportInfrastructureTablePDF, InfrastructureTablePdfData } from '../infrastructureTablePdfExport';
import { exportMissingRiderReportPDF, MissingRiderReportData } from '../missingRiderReportPdfExport';
import { generateStageGearPDF } from '../gearSetupPdfExport';
import { fetchLogoUrl } from './logoUtils';
import { generateCoverPage } from './coverPageGenerator';
import { generateTableOfContents } from './tocGenerator';
import { mergePDFs } from './pdfMerge';
import { PrintOptions } from "@/components/festival/pdf/PrintOptionsDialog";
import { exportWiredMicrophoneMatrixPDF, WiredMicrophoneMatrixData, organizeArtistsByDateAndStage } from '../wiredMicrophoneNeedsPdfExport';

// Helper function to sort artists chronologically across all dates
const sortArtistsChronologically = (artists: any[]) => {
  return artists.sort((a, b) => {
    // First sort by date
    if (a.date !== b.date) {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }
    
    // Then sort by stage within the same date
    if (a.stage !== b.stage) {
      return a.stage - b.stage;
    }
    
    // Finally sort by show time within the same date and stage
    const aTime = a.show_start || '';
    const bTime = b.show_start || '';
    
    // Handle shows that cross midnight (early morning shows)
    const aHour = aTime ? parseInt(aTime.split(':')[0], 10) : 0;
    const bHour = bTime ? parseInt(bTime.split(':')[0], 10) : 0;
    
    // If show starts between 00:00-06:59, treat it as next day for sorting
    const adjustedATime = aHour >= 0 && aHour < 7 ? `${aHour + 24}${aTime.substring(aTime.indexOf(':'))}` : aTime;
    const adjustedBTime = bHour >= 0 && bHour < 7 ? `${bHour + 24}${bTime.substring(bTime.indexOf(':'))}` : bTime;
    
    if (adjustedATime < adjustedBTime) return -1;
    if (adjustedATime > adjustedBTime) return 1;
    
    // Fallback to artist name
    return (a.name || '').localeCompare(b.name || '');
  });
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
  
  // Fetch stage names for consistent usage
  const { data: stageNames, error: stageError } = await supabase
    .from("festival_stages")
    .select("number, name")
    .eq("job_id", jobId)
    .order("number");
  
  if (stageError) {
    console.error("Error fetching stage names:", stageError);
  }
  
  const getStageNameByNumber = (stageNumber: number): string => {
    const stage = stageNames?.find(s => s.number === stageNumber);
    return stage?.name || `Stage ${stageNumber}`;
  };
  
  const gearPdfs: Blob[] = [];
  const shiftPdfs: Blob[] = [];
  const artistTablePdfs: Blob[] = [];
  const individualArtistPdfs: Blob[] = [];
  let rfIemTablePdf: Blob | null = null;
  let infrastructureTablePdf: Blob | null = null;
  let missingRiderReportPdf: Blob | null = null;
  let wiredMicMatrixPdf: Blob | null = null;
  
  try {
    const { data: artists, error: artistError } = await supabase
      .from("festival_artists")
      .select("*")
      .eq("job_id", jobId);
    
    if (artistError) throw artistError;
    
    if (options.includeGearSetup && options.gearSetupStages.length > 0) {
      console.log("Starting gear setup PDF generation for stages:", options.gearSetupStages);
      
      for (const stageNum of options.gearSetupStages) {
        try {
          const stageName = getStageNameByNumber(stageNum);
          
          const pdf = await generateStageGearPDF(jobId, stageNum, stageName);
          
          if (pdf && pdf.size > 0) {
            console.log(`Generated gear setup PDF for ${stageName}, size: ${pdf.size} bytes`);
            gearPdfs.push(pdf);
          } else {
            console.log(`No gear setup found for ${stageName}, skipping`);
          }
        } catch (err) {
          console.error(`Error generating gear setup PDF for stage ${stageNum}:`, err);
        }
      }
    }
    
    if (options.includeShiftSchedules) {
      console.log("Starting shift table PDF generation");
      
      // Get all dates from job_date_types instead of only artist dates
      const { data: jobDates, error: jobDatesError } = await supabase
        .from("job_date_types")
        .select("date")
        .eq("job_id", jobId)
        .order("date");
      
      if (jobDatesError) {
        console.error("Error fetching job dates:", jobDatesError);
      } else {
        const allJobDates = [...new Set(jobDates?.map(d => d.date) || [])];
        console.log("Processing shift schedules for all job dates:", allJobDates);
        
        for (const date of allJobDates) {
          if (!date) continue;
          
          const { data: shiftsData, error: shiftsError } = await supabase
            .from("festival_shifts")
            .select(`
              id, job_id, name, date, start_time, end_time, department, stage
            `)
            .eq("job_id", jobId)
            .eq("date", date);
          
          if (shiftsError) continue;
          
          const filteredShifts = shiftsData?.filter(shift => 
            !shift.stage || options.shiftScheduleStages.includes(Number(shift.stage))
          );
          
          if (filteredShifts && filteredShifts.length > 0) {
            try {
              console.log(`Generating shifts PDF for date ${date} with ${filteredShifts.length} shifts`);
            
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
                date: date,
                jobId: jobId,
                shifts: typedShifts,
                logoUrl
              };
            
              console.log(`Creating shifts table PDF with ${typedShifts.length} shifts and logoUrl: ${logoUrl}`);
              const shiftPdf = await exportShiftsTablePDF(shiftsTableData);
            
              console.log(`Generated shifts PDF for date ${date}, size: ${shiftPdf.size} bytes, type: ${shiftPdf.type}`);
              if (shiftPdf && shiftPdf.size > 0) {
                shiftPdfs.push(shiftPdf);
                console.log(`Added shift PDF to array. Current count: ${shiftPdfs.length}`);
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
      }
    }
    
    if (options.includeArtistTables) {
      // Filter artists by selected stages first
      const stageFilteredArtists = artists?.filter(a => 
        options.artistTableStages.includes(Number(a.stage))
      );
      
      if (stageFilteredArtists && stageFilteredArtists.length > 0) {
        // Sort ALL artists chronologically first
        const sortedArtists = sortArtistsChronologically(stageFilteredArtists);
        
        // Then group by date while maintaining chronological order
        const dateGroups = new Map<string, any[]>();
        
        sortedArtists.forEach(artist => {
          if (!dateGroups.has(artist.date)) {
            dateGroups.set(artist.date, []);
          }
          dateGroups.get(artist.date)?.push(artist);
        });
        
        const { data: stages } = await supabase
          .from("festival_stages")
          .select("*")
          .eq("job_id", jobId);
        
        // Process dates in chronological order
        for (const [date, dateArtists] of dateGroups.entries()) {
          if (!dateArtists || dateArtists.length === 0) continue;
          
          // Group by stage within each date
          const stageMap = new Map<number, any[]>();
          
          dateArtists.forEach(artist => {
            if (!stageMap.has(artist.stage)) {
              stageMap.set(artist.stage, []);
            }
            stageMap.get(artist.stage)?.push(artist);
          });
          
          for (const [stageNum, stageArtists] of stageMap.entries()) {
            if (stageArtists.length === 0) continue;
            
            const stageName = getStageNameByNumber(stageNum);
            
            const tableData: ArtistTablePdfData = {
              jobTitle: jobTitle,
              date: date,
              stage: stageName,
              artists: stageArtists.map(artist => {
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
                  notes: String(artist.notes || ''),
                  micKit: artist.mic_kit || 'band',
                  wiredMics: artist.wired_mics || [],
                  infrastructure: {
                    infra_cat6: artist.infra_cat6,
                    infra_cat6_quantity: artist.infra_cat6_quantity,
                    infra_hma: artist.infra_hma,
                    infra_hma_quantity: artist.infra_hma_quantity,
                    infra_coax: artist.infra_coax,
                    infra_coax_quantity: artist.infra_coax_quantity,
                    infra_opticalcon_duo: artist.infra_opticalcon_duo,
                    infra_opticalcon_duo_quantity: artist.infra_opticalcon_duo_quantity,
                    infra_analog: artist.infra_analog,
                    other_infrastructure: artist.other_infrastructure,
                    infrastructure_provided_by: artist.infrastructure_provided_by
                  },
                  riderMissing: Boolean(artist.rider_missing || false)
                };
              }),
              logoUrl
            };
            
            try {
              console.log(`Generating table PDF for ${date} ${stageName}`);
              const pdf = await exportArtistTablePDF(tableData);
              console.log(`Generated table PDF, size: ${pdf.size} bytes`);
              if (pdf && pdf.size > 0) {
                artistTablePdfs.push(pdf);
              } else {
                console.warn(`Generated empty table PDF for ${date} ${stageName}, skipping`);
              }
            } catch (err) {
              console.error(`Error generating table PDF for ${date} ${stageName}:`, err);
            }
          }
        }
      }
    }
    
    if (options.includeArtistRequirements && artists && artists.length > 0) {
      const filteredArtists = artists.filter(artist => 
        options.artistRequirementStages.includes(Number(artist.stage))
      );
      
      // Use the same chronological sorting for individual artist requirements
      const sortedArtists = sortArtistsChronologically(filteredArtists);
      
      console.log(`Sorted ${sortedArtists.length} artists for PDF generation`);
      
      for (const artist of sortedArtists) {
        try {
          console.log(`Generating PDF for artist: ${artist.name}, Stage: ${artist.stage}, Time: ${artist.show_start}`);
          
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
    
    // Generate RF & IEM table if option is selected
    if (options.includeRfIemTable && artists && artists.length > 0) {
      const filteredArtists = artists.filter(artist => 
        options.rfIemTableStages.includes(Number(artist.stage))
      );
      
      // Use chronological sorting for RF & IEM table as well
      const sortedArtists = sortArtistsChronologically(filteredArtists);
      
      console.log(`Generating RF & IEM table with ${sortedArtists.length} artists`);
      
      if (sortedArtists.length > 0) {
        const rfIemData: RfIemTablePdfData = {
          jobTitle,
          logoUrl,
          artists: sortedArtists.map(artist => {
            return {
              name: artist.name || 'Unnamed Artist',
              stage: artist.stage || 1,
              wirelessSystems: artist.wireless_systems || [],
              iemSystems: artist.iem_systems || [],
              wirelessProvidedBy: artist.wireless_provided_by || 'festival',
              iemProvidedBy: artist.iem_provided_by || 'festival'
            };
          })
        };
        
        try {
          rfIemTablePdf = await exportRfIemTablePDF(rfIemData);
          console.log(`Generated RF & IEM table PDF, size: ${rfIemTablePdf.size} bytes`);
        } catch (err) {
          console.error('Error generating RF & IEM table PDF:', err);
        }
      }
    }
    
    // Generate Infrastructure table if option is selected
    if (options.includeInfrastructureTable && artists && artists.length > 0) {
      const filteredArtists = artists.filter(artist => 
        options.infrastructureTableStages.includes(Number(artist.stage))
      );
      
      // Use chronological sorting for Infrastructure table as well
      const sortedArtists = sortArtistsChronologically(filteredArtists);
      
      console.log(`Generating Infrastructure table with ${sortedArtists.length} artists`);
      
      if (sortedArtists.length > 0) {
        const infrastructureData: InfrastructureTablePdfData = {
          jobTitle,
          logoUrl,
          artists: sortedArtists.map(artist => {
            return {
              name: artist.name || 'Unnamed Artist',
              stage: artist.stage || 1,
              providedBy: artist.infrastructure_provided_by || 'festival',
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
            };
          })
        };
        
        try {
          infrastructureTablePdf = await exportInfrastructureTablePDF(infrastructureData);
          console.log(`Generated Infrastructure table PDF, size: ${infrastructureTablePdf.size} bytes`);
        } catch (err) {
          console.error('Error generating Infrastructure table PDF:', err);
        }
      }
    }
    
    // Generate Missing Rider Report if option is selected
    if (options.includeMissingRiderReport) {
      console.log("Processing Missing Rider Report generation");
      
      if (artists && artists.length > 0) {
        const missingRiderArtists = artists.filter(artist => 
          Boolean(artist.rider_missing)
        );
        
        console.log(`Found ${missingRiderArtists.length} artists with missing riders out of ${artists.length} total artists`);
        
        // Use chronological sorting for Missing Rider Report as well
        const sortedMissingRiderArtists = sortArtistsChronologically(missingRiderArtists);
        
        const missingRiderData: MissingRiderReportData = {
          jobTitle,
          logoUrl,
          artists: sortedMissingRiderArtists.map(artist => ({
            name: artist.name || 'Unnamed Artist',
            stage: artist.stage || 1,
            date: artist.date || '',
            showTime: {
              start: artist.show_start || '',
              end: artist.show_end || ''
            }
          }))
        };
        
        try {
          console.log("Generating Missing Rider Report PDF with data:", {
            artistCount: missingRiderData.artists.length,
            jobTitle: missingRiderData.jobTitle,
            hasLogo: !!missingRiderData.logoUrl
          });
          
          missingRiderReportPdf = await exportMissingRiderReportPDF(missingRiderData);
          console.log(`Generated Missing Rider Report PDF, size: ${missingRiderReportPdf.size} bytes`);
        } catch (err) {
          console.error('Error generating Missing Rider Report PDF:', err);
        }
      } else {
        console.log("No artists found for Missing Rider Report generation");
        
        // Still generate an empty report to show that all riders are complete
        const emptyMissingRiderData: MissingRiderReportData = {
          jobTitle,
          logoUrl,
          artists: []
        };
        
        try {
          missingRiderReportPdf = await exportMissingRiderReportPDF(emptyMissingRiderData);
          console.log(`Generated empty Missing Rider Report PDF, size: ${missingRiderReportPdf.size} bytes`);
        } catch (err) {
          console.error('Error generating empty Missing Rider Report PDF:', err);
        }
      }
    }
    
    // Generate Wired Microphone Matrix PDF if option is selected - UPDATED APPROACH
    if (options.includeWiredMicNeeds && artists && artists.length > 0) {
      const filteredArtists = artists.filter(artist => 
        options.wiredMicNeedsStages.includes(Number(artist.stage)) &&
        artist.mic_kit === 'festival' &&
        artist.wired_mics &&
        Array.isArray(artist.wired_mics) &&
        artist.wired_mics.length > 0
      );
      
      console.log(`Generating Wired Microphone Matrix PDF with ${filteredArtists.length} artists`);
      
      if (filteredArtists.length > 0) {
        // Use the new matrix-based approach
        const artistsByDateAndStage = organizeArtistsByDateAndStage(filteredArtists);
        
        const wiredMicMatrixData: WiredMicrophoneMatrixData = {
          jobTitle,
          logoUrl,
          artistsByDateAndStage
        };
        
        try {
          wiredMicMatrixPdf = await exportWiredMicrophoneMatrixPDF(wiredMicMatrixData);
          console.log(`Generated Wired Microphone Matrix PDF, size: ${wiredMicMatrixPdf.size} bytes`);
        } catch (err) {
          console.error('Error generating Wired Microphone Matrix PDF:', err);
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
    if (options.includeWiredMicNeeds && wiredMicMatrixPdf) {
      tocSections.push({ title: "Wired Microphone Requirements Matrix", pageCount: 1 });
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
      ...(options.includeWiredMicNeeds && wiredMicMatrixPdf ? [wiredMicMatrixPdf] : []),  // 6. Wired Microphone Matrix
      ...(options.includeMissingRiderReport && missingRiderReportPdf ? [missingRiderReportPdf] : []),  // 7. Missing Rider Report
      ...(options.includeArtistRequirements ? individualArtistPdfs : [])  // 8. Individual Artist Requirements
    ];
    
    console.log(`Total PDFs to merge: ${selectedPdfs.length}`);
    console.log('PDF breakdown:', {
      coverPage: 1,
      tableOfContents: 1,
      shiftPdfs: shiftPdfs.length,
      gearPdfs: gearPdfs.length,
      artistTablePdfs: artistTablePdfs.length,
      rfIemTablePdf: rfIemTablePdf ? 1 : 0,
      infrastructureTablePdf: infrastructureTablePdf ? 1 : 0,
      wiredMicMatrixPdf: wiredMicMatrixPdf ? 1 : 0,
      missingRiderReportPdf: missingRiderReportPdf ? 1 : 0,
      individualArtistPdfs: individualArtistPdfs.length
    });
    
    // Check if we have at least one content PDF beyond cover and TOC
    const contentPdfCount = selectedPdfs.length - 2; // Subtract cover page and TOC
    if (contentPdfCount === 0) {
      throw new Error('No content documents were selected for generation. Please select at least one document type to include in the PDF.');
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
