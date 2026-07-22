import { supabase } from '@/lib/supabase';
import { exportArtistPDF, ArtistPdfData } from '../artistPdfExport';
import { exportArtistTablePDF, ArtistTablePdfData } from '../artistTablePdfExport';
import { exportRfIemTablePDF, RfIemTablePdfData } from '../rfIemTablePdfExport';
import { exportInfrastructureTablePDF, InfrastructureTablePdfData } from '../infrastructureTablePdfExport';
import { exportMissingRiderReportPDF, MissingRiderReportData } from '../missingRiderReportPdfExport';
import { generateStageGearPDF } from '../gearSetupPdfExport';
import { generateCoverPage } from './coverPageGenerator';
import { generateTableOfContents, TocSection } from './tocGenerator';
import { mergePDFs } from './pdfMerge';
import type { PrintOptions } from "@/components/festival/pdf/PrintOptionsDialog";
import { exportWiredMicrophoneMatrixPDF, WiredMicrophoneMatrixData, organizeArtistsByDateAndStage } from '../wiredMicrophoneNeedsPdfExport';
import { generateWeatherPDF, WeatherPdfData } from './weatherPdfGenerator';
import { ensurePublicArtistFormLinks } from '../publicArtistFormLinks';
import { buildReadableFilename } from '@/utils/fileName';
import { combineWavesDisplay } from '@/constants/wavesModels';
import { getArtistRiderStatus } from '@/features/festival-management/selectors';
import {
  normalizeVenueCoordinates,
  resolveHojaVenue,
} from '@/utils/hoja-de-ruta/venue-resolution';
import {
  buildArtistTableArtists,
  buildInfrastructureArtists,
  buildRfIemArtists,
  sortArtistsChronologically,
} from './festivalPdfSectionBuilders';
import {
  addTableOfContentsLinks,
  clampPdfConcurrency,
  getPdfPageCount,
  getTotalPages,
  isNonEmptyBlob,
  runWithConcurrency,
  type FestivalPdfGenerationOptions,
  type FestivalPdfProgress,
} from "@/utils/pdf/festivalPdfSupport";
import { generateFestivalShiftPdfs } from "@/utils/pdf/festivalPdfShiftSection";
import { loadFestivalStageMetadata, loadStagePlotUrls } from "@/utils/pdf/festivalPdfContext";
export type { FestivalPdfGenerationOptions, FestivalPdfProgress, FestivalPdfProgressPhase } from "@/utils/pdf/festivalPdfSupport";


export const generateAndMergeFestivalPDFs = async (
  jobId: string,
  jobTitle: string,
  options: PrintOptions,
  customFilename?: string,
  generationOptions: FestivalPdfGenerationOptions = {},
): Promise<{ blob: Blob; filename: string }> => {
  console.log("Starting comprehensive PDF generation with options:", options);
  const pdfConcurrency = clampPdfConcurrency(generationOptions.concurrency);
  const reportProgress = (progress: FestivalPdfProgress) => {
    generationOptions.onProgress?.(progress);
  };

  const { getStageNameByNumber, logoUrl, stageNamesByNumber } = await loadFestivalStageMetadata(jobId);
  console.log("Logo URL for PDFs:", logoUrl);
  
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

    const stagePlotUrlsByArtistId = await loadStagePlotUrls(artists || []);
    
    if (options.includeGearSetup && options.gearSetupStages.length > 0) {
      console.log("Starting gear setup PDF generation for stages:", options.gearSetupStages);
      let completedGearPdfs = 0;
      reportProgress({
        phase: "gear-setup",
        completed: completedGearPdfs,
        total: options.gearSetupStages.length,
        label: "Preparando dotacion tecnica",
      });
      
      const generatedGearPdfs = await runWithConcurrency(options.gearSetupStages, async (stageNum) => {
        try {
          const stageName = getStageNameByNumber(stageNum);
          
          const pdf = await generateStageGearPDF(jobId, stageNum, stageName, logoUrl);
          
          if (pdf && pdf.size > 0) {
            console.log(`Generated gear setup PDF for ${stageName}, size: ${pdf.size} bytes`);
            return pdf;
          } else {
            console.log(`No gear setup found for ${stageName}, skipping`);
          }
        } catch (err) {
          console.error(`Error generating gear setup PDF for stage ${stageNum}:`, err);
        } finally {
          completedGearPdfs += 1;
          reportProgress({
            phase: "gear-setup",
            completed: completedGearPdfs,
            total: options.gearSetupStages.length,
            label: "Generando dotacion tecnica",
          });
        }
        return null;
      }, pdfConcurrency);

      gearPdfs.push(...generatedGearPdfs.filter(isNonEmptyBlob));
    }
    
    shiftPdfs.push(...await generateFestivalShiftPdfs({
      jobId,
      jobTitle,
      logoUrl,
      options,
      pdfConcurrency,
      reportProgress,
    }));
    
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
        
        const artistTableJobs: Array<{
          date: string;
          stageNum: number;
          stageArtists: typeof sortedArtists;
          stageName: string;
        }> = [];

        // Build date/stage jobs in chronological order, then generate them concurrently.
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
            artistTableJobs.push({ date, stageNum, stageArtists, stageName });
          }
        }

        let completedArtistTablePdfs = 0;
        reportProgress({
          phase: "artist-tables",
          completed: completedArtistTablePdfs,
          total: artistTableJobs.length,
          label: "Preparando tablas de artistas",
        });

        const generatedArtistTablePdfs = await runWithConcurrency(artistTableJobs, async ({
          date,
          stageNum,
          stageArtists,
          stageName,
        }) => {
          try {
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
                return pdf;
              } else {
                console.warn(`Generated empty table PDF for ${date} ${stageName}, skipping`);
              }
            } catch (err) {
              console.error(`Error generating table PDF for ${date} ${stageName}:`, err);
            }
          } finally {
            completedArtistTablePdfs += 1;
            reportProgress({
              phase: "artist-tables",
              completed: completedArtistTablePdfs,
              total: artistTableJobs.length,
              label: "Generando tablas de artistas",
            });
          }
          return null;
        }, pdfConcurrency);

        artistTablePdfs.push(...generatedArtistTablePdfs.filter(isNonEmptyBlob));
      }
    }
    
    if (options.includeArtistRequirements && artists && artists.length > 0) {
      const filteredArtists = artists.filter(artist => 
        options.artistRequirementStages.includes(Number(artist.stage))
      );
      
      // Use the same chronological sorting for individual artist requirements
      const sortedArtists = sortArtistsChronologically(filteredArtists);
      
      console.log(`Sorted ${sortedArtists.length} artists for PDF generation`);
      let completedArtistRequirementPdfs = 0;
      reportProgress({
        phase: "artist-requirements",
        completed: completedArtistRequirementPdfs,
        total: sortedArtists.length,
        label: "Preparando fichas de artistas",
      });
      
      const generatedArtistPdfs = await runWithConcurrency(sortedArtists, async (artist) => {
        try {
          console.log(`Generating PDF for artist: ${artist.name}, Stage: ${artist.stage}, Time: ${artist.show_start}`);
          
          const artistData: ArtistPdfData = {
            name: artist.name || 'Unnamed Artist',
            stage: artist.stage || 1,
            date: artist.date || '',
            schedule: {
              loadIn: artist.load_in_time || undefined,
              show: { start: artist.show_start || '', end: artist.show_end || '' },
              soundcheck: artist.soundcheck_start ? { start: artist.soundcheck_start || '', end: artist.soundcheck_end || '' } : undefined,
              lineCheck: artist.line_check ? { start: artist.line_check_start || '', end: artist.line_check_end || '' } : undefined,
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
              fohWavesOutboard: combineWavesDisplay(artist.foh_waves_models, artist.foh_outboard),
              monWavesOutboard: combineWavesDisplay(artist.mon_waves_models, artist.mon_outboard),
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
            return {
              pdf,
              title: artist.name || 'Unnamed Artist',
            };
          } else {
            console.warn(`Generated empty PDF for artist ${artist.name}, skipping`);
          }
        } catch (err) {
          console.error(`Error generating PDF for artist ${artist.name}:`, err);
        } finally {
          completedArtistRequirementPdfs += 1;
          reportProgress({
            phase: "artist-requirements",
            completed: completedArtistRequirementPdfs,
            total: sortedArtists.length,
            label: "Generando fichas de artistas",
          });
        }
        return null;
      }, pdfConcurrency);

      for (const result of generatedArtistPdfs) {
        if (!result) continue;
        individualArtistPdfs.push(result.pdf);
        individualArtistIndexTitles.push(result.title);
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
        const [
          { data: jobData, error: jobError },
          { data: hojaVenue, error: hojaVenueError },
        ] = await Promise.all([
          supabase
            .from("jobs")
            .select("start_time, end_time, location_id, description")
            .eq("id", jobId)
            .single(),
          supabase
            .from("hoja_de_ruta")
            .select("venue_name, venue_address, venue_latitude, venue_longitude")
            .eq("job_id", jobId)
            .maybeSingle(),
        ]);
        
        if (jobError) {
          console.error("Error fetching job data for weather:", jobError);
        } else {
          if (hojaVenueError) {
            console.warn("Unable to load saved Hoja venue for festival weather PDF:", hojaVenueError);
          }

          let catalogLocation:
            | {
                name?: string | null;
                formatted_address?: string | null;
                latitude?: number | null;
                longitude?: number | null;
              }
            | null = null;

          if (jobData.location_id) {
            const { data, error } = await supabase
              .from("locations")
              .select("name, formatted_address, latitude, longitude")
              .eq("id", jobData.location_id)
              .maybeSingle();

            if (error) {
              console.warn("Unable to load catalog location for festival weather PDF:", error);
            } else {
              catalogLocation = data;
            }
          }

          const resolvedVenue = resolveHojaVenue({
            name: hojaVenue?.venue_name,
            address: hojaVenue?.venue_address,
            coordinates: {
              lat: hojaVenue?.venue_latitude,
              lng: hojaVenue?.venue_longitude,
            },
          }, {
            name: catalogLocation?.name,
            address: catalogLocation?.formatted_address || catalogLocation?.name,
            coordinates: normalizeVenueCoordinates({
              lat: catalogLocation?.latitude,
              lng: catalogLocation?.longitude,
            }),
          });

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
              address:
                resolvedVenue.address ||
                (!resolvedVenue.coordinates ? jobData.description || undefined : undefined),
              coordinates: resolvedVenue.coordinates,
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
        const missingRiderArtists = artists.filter((artist) => getArtistRiderStatus(artist) !== 'complete');

        console.log(`Found ${missingRiderArtists.length} artists with missing or outdated riders out of ${artists.length} total artists`);
        
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
          artists: sortedMissingRiderArtists.map((artist) => ({
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
              status: getArtistRiderStatus(artist) === 'missing' ? 'missing' as const : 'outdated' as const,
              copiedFromDate: artist.rider_copied_from_date || undefined,
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
        (artist.mic_kit === 'festival' || artist.mic_kit === 'mixed') &&
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
    
    reportProgress({
      phase: "merge",
      completed: 0,
      total: 3,
      label: "Calculando paginas",
    });

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
    reportProgress({
      phase: "merge",
      completed: 1,
      total: 3,
      label: "Creando indice",
    });
    
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
    
    reportProgress({
      phase: "merge",
      completed: 2,
      total: 3,
      label: "Combinando PDFs",
    });

    const mergedBlob = await mergePDFs(selectedPdfs);
    const mergedBlobWithTocLinks = await addTableOfContentsLinks(mergedBlob, tocLinks);
    reportProgress({
      phase: "merge",
      completed: 3,
      total: 3,
      label: "PDF listo",
    });
    
    // Generate filename if not provided
    const filename = customFilename || buildReadableFilename([jobTitle || "Festival", "Documentación completa"]);
    
    return { blob: mergedBlobWithTocLinks, filename };
  } catch (error) {
    console.error('Error generating festival PDFs:', error);
    throw error;
  }
};
