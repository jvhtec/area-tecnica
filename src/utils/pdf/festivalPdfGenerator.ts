import { PDFArray, PDFDocument, PDFName } from 'pdf-lib';
import { supabase } from '@/lib/supabase';
import { exportArtistPDF, ArtistPdfData } from '../artistPdfExport';
import { exportArtistTablePDF, ArtistTablePdfData } from '../artistTablePdfExport';
import { exportShiftsTablePDF, ShiftsTablePdfData } from '../shiftsTablePdfExport';
import { exportRfIemTablePDF, RfIemTablePdfData } from '../rfIemTablePdfExport';
import { exportInfrastructureTablePDF, InfrastructureTablePdfData } from '../infrastructureTablePdfExport';
import { exportMissingRiderReportPDF, MissingRiderReportData } from '../missingRiderReportPdfExport';
import { generateStageGearPDF } from '../gearSetupPdfExport';
import { fetchJobLogo, fetchLogoUrl } from './logoUtils';
import { generateCoverPage } from './coverPageGenerator';
import { generateTableOfContents, TocLinkRegion, TocSection } from './tocGenerator';
import { mergePDFs } from './pdfMerge';
import { PrintOptions } from "@/components/festival/pdf/PrintOptionsDialog";
import { exportWiredMicrophoneMatrixPDF, WiredMicrophoneMatrixData, organizeArtistsByDateAndStage } from '../wiredMicrophoneNeedsPdfExport';
import { generateWeatherPDF, WeatherPdfData } from './weatherPdfGenerator';
import { ensurePublicArtistFormLinks } from '../publicArtistFormLinks';
import { buildReadableFilename } from '@/utils/fileName';
import {
  attachShiftAssignmentsAndProfiles,
  buildArtistTableArtists,
  buildInfrastructureArtists,
  buildRfIemArtists,
  sortArtistsChronologically,
} from './festivalPdfSectionBuilders';


const addTableOfContentsLinks = async (mergedBlob: Blob, links: TocLinkRegion[]): Promise<Blob> => {
  if (links.length === 0) return mergedBlob;

  const mergedBytes = await mergedBlob.arrayBuffer();
  const mergedPdf = await PDFDocument.load(mergedBytes, {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
    updateMetadata: false,
  });

  for (const link of links) {
    const tocPage = mergedPdf.getPage(1 + link.pageIndex);
    const destinationPage = mergedPdf.getPage(link.targetPage - 1);

    if (!tocPage || !destinationPage) continue;

    const context = mergedPdf.context;
    const destination = context.obj([
      destinationPage.ref,
      PDFName.of('XYZ'),
      null,
      null,
      null,
    ]);

    const action = context.obj({
      Type: 'Action',
      S: 'GoTo',
      D: destination,
    });

    const annotation = context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [link.x, link.y, link.x + link.width, link.y + link.height],
      Border: [0, 0, 0],
      A: action,
    });

    const pageNode = tocPage.node;
    const existingAnnots = pageNode.lookupMaybe(PDFName.of('Annots'), PDFArray);

    if (existingAnnots) {
      existingAnnots.push(annotation);
    } else {
      pageNode.set(PDFName.of('Annots'), context.obj([annotation]));
    }
  }

  const linkedPdfBytes = await mergedPdf.save();
  return new Blob([new Uint8Array(linkedPdfBytes)], { type: 'application/pdf' });
};

const getPdfPageCount = async (pdf: Blob): Promise<number> => {
  try {
    const bytes = await pdf.arrayBuffer();
    const doc = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
      updateMetadata: false,
    });
    return doc.getPageCount();
  } catch (error) {
    console.error('Error counting PDF pages:', error);
    return 0;
  }
};

const getTotalPages = (pageCounts: number[]): number =>
  pageCounts.reduce((total, count) => total + count, 0);

export const generateAndMergeFestivalPDFs = async (
  jobId: string,
  jobTitle: string,
  options: PrintOptions,
  customFilename?: string
): Promise<{ blob: Blob; filename: string }> => {
  console.log("Starting comprehensive PDF generation with options:", options);

  const logoUrl = (await fetchJobLogo(jobId)) || (await fetchLogoUrl(jobId));
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
  const stageNamesByNumber = (stageNames || []).reduce((acc, stage) => {
    acc[Number(stage.number)] = stage.name || `Escenario ${stage.number}`;
    return acc;
  }, {} as Record<number, string>);
  
  const gearPdfs: Blob[] = [];
  const shiftPdfs: Blob[] = [];
  const artistTablePdfs: Blob[] = [];
  const individualArtistPdfs: Blob[] = [];
  const individualArtistIndexTitles: string[] = [];
  let rfIemTablePdf: Blob | null = null;
  let infrastructureTablePdf: Blob | null = null;
  let missingRiderReportPdf: Blob | null = null;
  let wiredMicMatrixPdf: Blob | null = null;
  let weatherPdf: Blob | null = null;
  
  try {
    const { data: artists, error: artistError } = await supabase
      .from("festival_artists")
      .select("*")
      .eq("job_id", jobId);
    
    if (artistError) throw artistError;

    const stagePlotUrlsByArtistId: Record<string, string> = {};
    const artistsWithStagePlot = (artists || []).filter((artist) => Boolean(artist.stage_plot_file_path));

    if (artistsWithStagePlot.length > 0) {
      await Promise.all(
        artistsWithStagePlot.map(async (artist) => {
          try {
            const { data: signedData, error: signedError } = await supabase.storage
              .from("festival_artist_files")
              .createSignedUrl(String(artist.stage_plot_file_path), 60 * 60);

            if (!signedError && signedData?.signedUrl) {
              stagePlotUrlsByArtistId[String(artist.id)] = signedData.signedUrl;
            }
          } catch (stagePlotError) {
            console.error(`Error signing stage plot for artist ${artist.id}:`, stagePlotError);
          }
        })
      );
    }
    
    if (options.includeGearSetup && options.gearSetupStages.length > 0) {
      console.log("Starting gear setup PDF generation for stages:", options.gearSetupStages);
      
      for (const stageNum of options.gearSetupStages) {
        try {
          const stageName = getStageNameByNumber(stageNum);
          
          const pdf = await generateStageGearPDF(jobId, stageNum, stageName, logoUrl);
          
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
              const shiftIds = filteredShifts.map((shift) => shift.id);
              const { data: assignmentsData, error: assignmentsError } = await supabase
                .from("festival_shift_assignments")
                .select("id, shift_id, technician_id, external_technician_name, role")
                .in("shift_id", shiftIds);

              if (assignmentsError) {
                console.error(`Error fetching assignments for date ${date}:`, assignmentsError);
                continue;
              }

              const technicianIds = Array.from(
                new Set(
                  (assignmentsData || [])
                    .map((assignment) => assignment.technician_id)
                    .filter((technicianId): technicianId is string => Boolean(technicianId)),
                ),
              );

              let profilesById = new Map<string, {
                id: string;
                first_name: string | null;
                last_name: string | null;
                email: string | null;
                department: string | null;
                role: string | null;
              }>();

              if (technicianIds.length > 0) {
                const { data: profilesData, error: profilesError } = await supabase
                  .from("profiles")
                  .select("id, first_name, last_name, email, department, role")
                  .in("id", technicianIds);

                if (profilesError) {
                  console.error(`Error fetching profiles for date ${date}:`, profilesError);
                } else {
                  profilesById = new Map((profilesData || []).map((profile) => [profile.id, profile]));
                }
              }

              const typedShifts = attachShiftAssignmentsAndProfiles(
                filteredShifts,
                assignmentsData || [],
                profilesById,
              );
            
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
        const dateGroups = new Map<string, typeof sortedArtists>();
        
        sortedArtists.forEach(artist => {
          if (!dateGroups.has(artist.date)) {
            dateGroups.set(artist.date, []);
          }
          dateGroups.get(artist.date)?.push(artist);
        });
        
        // Process dates in chronological order
        for (const [date, dateArtists] of dateGroups.entries()) {
          if (!dateArtists || dateArtists.length === 0) continue;
          
          // Group by stage within each date
          const stageMap = new Map<number, typeof dateArtists>();
          
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
              stage: String(stageNum),
              stageNames: stageNamesByNumber,
              artists: buildArtistTableArtists(stageArtists as unknown as Record<string, unknown>[]),
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
              monitorsFromFoh: Boolean(artist.monitors_from_foh || false),
              fohWavesOutboard: String(artist.foh_waves_outboard || ""),
              monWavesOutboard: String(artist.mon_waves_outboard || ""),
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
            logoUrl,
            wiredMics: artist.wired_mics || [],
            micKit: artist.mic_kit || undefined,
            stagePlotUrl: stagePlotUrlsByArtistId[String(artist.id)],
            stagePlotFileType: artist.stage_plot_file_type ? String(artist.stage_plot_file_type) : undefined,
          };
          
          const pdf = await exportArtistPDF(artistData);
          console.log(`Generated PDF for artist ${artist.name}, size: ${pdf.size} bytes`);
          if (pdf && pdf.size > 0) {
            individualArtistPdfs.push(pdf);
            individualArtistIndexTitles.push(artist.name || 'Unnamed Artist');
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
        const rfIemArtists = buildRfIemArtists(sortedArtists as unknown as Record<string, unknown>[]);
        const rfIemData: RfIemTablePdfData = {
          jobTitle,
          logoUrl,
          artists: rfIemArtists
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
        const normalizedInfrastructureArtists = buildInfrastructureArtists(
          sortedArtists as unknown as Record<string, unknown>[],
        );
        const infrastructureData: InfrastructureTablePdfData = {
          jobTitle,
          logoUrl,
          artists: normalizedInfrastructureArtists
        };
        
        try {
          infrastructureTablePdf = await exportInfrastructureTablePDF(infrastructureData);
          console.log(`Generated Infrastructure table PDF, size: ${infrastructureTablePdf.size} bytes`);
        } catch (err) {
          console.error('Error generating Infrastructure table PDF:', err);
        }
      }
    }
    
    // Generate weather PDF if requested
    if (options.includeWeatherPrediction) {
      console.log("Starting weather PDF generation");
      
      try {
        // Fetch job details to get location info
        const { data: jobData, error: jobError } = await supabase
          .from("jobs")
          .select("*")
          .eq("id", jobId)
          .single();
        
        if (jobError) {
          console.error("Error fetching job data for weather:", jobError);
        } else {
          // Get job dates
          const startDate = new Date(jobData.start_time);
          const endDate = new Date(jobData.end_time);
          const jobDates = [];
          
          const currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            jobDates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          const weatherData: WeatherPdfData = {
            jobTitle: jobTitle || 'Festival',
            logoUrl,
            venue: {
              address: jobData.description // Using description as venue address fallback
            },
            jobDates
          };
          
          const weatherPdfBlob = await generateWeatherPDF(weatherData);
          
          if (weatherPdfBlob && weatherPdfBlob.size > 0) {
            console.log(`Generated weather PDF, size: ${weatherPdfBlob.size} bytes`);
            weatherPdf = weatherPdfBlob;
          } else {
            console.log('No weather data available, skipping weather PDF');
          }
        }
      } catch (err) {
        console.error('Error generating weather PDF:', err);
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
        const publicFormLinksByArtistId = await ensurePublicArtistFormLinks(
          sortedMissingRiderArtists.map((artist) => ({
            id: artist.id,
            form_language: artist.form_language,
          })),
        );
        
        const missingRiderData: MissingRiderReportData = {
          jobTitle,
          logoUrl,
          artists: sortedMissingRiderArtists.map(artist => ({
            id: artist.id,
            name: artist.name || 'Unnamed Artist',
            stage: artist.stage || 1,
            stageName: getStageNameByNumber(artist.stage || 1),
            date: artist.date || '',
            showTime: {
              start: artist.show_start || '',
              end: artist.show_end || ''
            },
            formUrl: publicFormLinksByArtistId[artist.id],
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
    
    const [
      shiftPageCounts,
      gearPageCounts,
      artistTablePageCounts,
      individualArtistPageCounts,
      rfIemPageCount,
      infrastructurePageCount,
      wiredMicPageCount,
      weatherPageCount,
      missingRiderPageCount,
    ] = await Promise.all([
      Promise.all(shiftPdfs.map(getPdfPageCount)),
      Promise.all(gearPdfs.map(getPdfPageCount)),
      Promise.all(artistTablePdfs.map(getPdfPageCount)),
      Promise.all(individualArtistPdfs.map(getPdfPageCount)),
      rfIemTablePdf ? getPdfPageCount(rfIemTablePdf) : Promise.resolve(0),
      infrastructureTablePdf ? getPdfPageCount(infrastructureTablePdf) : Promise.resolve(0),
      wiredMicMatrixPdf ? getPdfPageCount(wiredMicMatrixPdf) : Promise.resolve(0),
      weatherPdf ? getPdfPageCount(weatherPdf) : Promise.resolve(0),
      missingRiderReportPdf ? getPdfPageCount(missingRiderReportPdf) : Promise.resolve(0),
    ]);

    const totalShiftPages = getTotalPages(shiftPageCounts);
    const totalGearPages = getTotalPages(gearPageCounts);
    const totalArtistTablePages = getTotalPages(artistTablePageCounts);
    const individualArtistIndexEntries = individualArtistIndexTitles
      .map((title, index) => ({
        title,
        pageCount: individualArtistPageCounts[index] || 0,
      }))
      .filter((entry) => entry.pageCount > 0);
    const totalIndividualArtistPages = getTotalPages(
      individualArtistIndexEntries.map((entry) => entry.pageCount)
    );

    const tocSections: TocSection[] = [];
    
    if (options.includeShiftSchedules && totalShiftPages > 0) {
      tocSections.push({ title: "Turnos de Personal", pageCount: totalShiftPages });
    }
    if (options.includeGearSetup && totalGearPages > 0) {
      tocSections.push({ title: "Equipamiento por Escenario", pageCount: totalGearPages });
    }
    if (options.includeArtistTables && totalArtistTablePages > 0) {
      tocSections.push({ title: "Tablas de Artistas", pageCount: totalArtistTablePages });
    }
    if (options.includeRfIemTable && rfIemPageCount > 0) {
      tocSections.push({ title: "Resumen RF e IEM", pageCount: rfIemPageCount });
    }
    if (options.includeInfrastructureTable && infrastructurePageCount > 0) {
      tocSections.push({ title: "Resumen de Infraestructura", pageCount: infrastructurePageCount });
    }
    if (options.includeWiredMicNeeds && wiredMicPageCount > 0) {
      tocSections.push({ title: "Matriz de Microfonia Cableada", pageCount: wiredMicPageCount });
    }
    if (options.includeWeatherPrediction && weatherPageCount > 0) {
      tocSections.push({ title: "Prevision Meteorologica", pageCount: weatherPageCount });
    }
    if (options.includeMissingRiderReport && missingRiderPageCount > 0) {
      tocSections.push({ title: "Reporte de Riders Faltantes", pageCount: missingRiderPageCount });
    }
    if (options.includeArtistRequirements && totalIndividualArtistPages > 0) {
      tocSections.push({
        title: "Requerimientos Individuales por Artista",
        pageCount: totalIndividualArtistPages,
        children: individualArtistIndexEntries,
      });
    }
    
    console.log(`Table of contents sections:`, tocSections);
    
    const coverPage = await generateCoverPage(jobId, jobTitle, logoUrl);
    const { blob: tableOfContents, links: tocLinks } = await generateTableOfContents(tocSections, logoUrl);
    
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
      ...(options.includeWeatherPrediction && weatherPdf ? [weatherPdf] : []),  // 7. Weather Forecast
      ...(options.includeMissingRiderReport && missingRiderReportPdf ? [missingRiderReportPdf] : []),  // 8. Missing Rider Report
      ...(options.includeArtistRequirements ? individualArtistPdfs : [])  // 9. Individual Artist Requirements
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
      weatherPdf: weatherPdf ? 1 : 0,
      missingRiderReportPdf: missingRiderReportPdf ? 1 : 0,
      individualArtistPdfs: individualArtistPdfs.length
    });
    console.log('Selected options:', options);
    
    // Count actual content PDFs - be more specific about what constitutes content
    const actualContentPdfs = [
      ...shiftPdfs,
      ...gearPdfs,
      ...artistTablePdfs,
      ...(rfIemTablePdf ? [rfIemTablePdf] : []),
      ...(infrastructureTablePdf ? [infrastructureTablePdf] : []),
      ...(wiredMicMatrixPdf ? [wiredMicMatrixPdf] : []),
      ...(weatherPdf ? [weatherPdf] : []),
      ...(missingRiderReportPdf ? [missingRiderReportPdf] : []),
      ...individualArtistPdfs
    ];

    const actualContentPages = [
      totalShiftPages,
      totalGearPages,
      totalArtistTablePages,
      rfIemPageCount,
      infrastructurePageCount,
      wiredMicPageCount,
      weatherPageCount,
      missingRiderPageCount,
      totalIndividualArtistPages,
    ].reduce((total, pageCount) => total + pageCount, 0);

    console.log(`Actual content PDFs count: ${actualContentPdfs.length}`);
    console.log(`Actual content page count: ${actualContentPages}`);
    
    // Check if we have at least one content page beyond cover and TOC
    if (actualContentPages === 0) {
      throw new Error('No content documents were generated. Please ensure at least one document type has data to include in the PDF.');
    }
    
    const mergedBlob = await mergePDFs(selectedPdfs);
    const mergedBlobWithTocLinks = await addTableOfContentsLinks(mergedBlob, tocLinks);
    
    // Generate filename if not provided
    const filename = customFilename || buildReadableFilename([jobTitle || "Festival", "Documentación completa"]);
    
    return { blob: mergedBlobWithTocLinks, filename };
  } catch (error) {
    console.error('Error generating festival PDFs:', error);
    throw error;
  }
};
