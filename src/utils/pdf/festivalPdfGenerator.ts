
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { PrintOptions } from '@/components/festival/pdf/PrintOptionsDialog';
import { supabase } from '@/lib/supabase';
import { fetchJobLogo } from './logoUtils';
import { mergePDFs } from './pdfMerge';
import { generateCoverPage } from './coverPageGenerator';
import { generateTableOfContents } from './tocGenerator';
import { exportWiredMicrophoneMatrixFromArtists } from '../wiredMicrophoneMatrixDirectExport';
import { exportGearSetupPDF } from '../gearSetupPdfExport';
import { exportShiftsTablePDF, ShiftsTablePdfData } from '../shiftsTablePdfExport';
import { exportArtistTablePDF } from '../artistTablePdfExport';
import { exportArtistPDF, ArtistPdfData } from '../artistPdfExport';
import { exportRfIemTablePDF } from '../rfIemTablePdfExport';
import { exportInfrastructureTablePDF } from '../infrastructureTablePdfExport';
import { exportMissingRiderReportPDF } from '../missingRiderReportPdfExport';

export const generateAndMergeFestivalPDFs = async (
  jobId: string,
  jobTitle: string,
  options: PrintOptions,
  filename: string
): Promise<{ blob: Blob; filename: string }> => {
  console.log('\n🎬 FESTIVAL PDF GENERATOR START');
  console.log('🎯 Job ID:', jobId);
  console.log('📋 Options:', options);

  const pdfsToMerge: Blob[] = [];
  const sections: { title: string; pageCount: number }[] = [];

  try {
    // Fetch common data
    const logoUrl = await fetchJobLogo(jobId);
    
    // Fetch job data for cover page
    const { data: jobData } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    // Generate cover page
    console.log('\n📃 GENERATING COVER PAGE');
    const coverPageBlob = await generateCoverPage(jobId, jobTitle, logoUrl);
    console.log('✅ Cover page generated, size:', coverPageBlob.size);
    pdfsToMerge.push(coverPageBlob);

    // Generate gear setup PDFs
    if (options.includeGearSetup && options.gearSetupStages.length > 0) {
      console.log('\n🔧 GENERATING GEAR SETUP PDFs');
      
      try {
        for (const stage of options.gearSetupStages) {
          console.log(`Generating gear setup for stage ${stage}`);
          const gearBlob = await exportGearSetupPDF(jobId, jobTitle, stage, logoUrl);
          pdfsToMerge.push(gearBlob);
          sections.push({ title: `Stage ${stage} Equipment Setup`, pageCount: 2 });
        }
        console.log('✅ Gear setup PDFs generated');
      } catch (error) {
        console.error('❌ Error generating gear setup PDFs:', error);
      }
    }

    // Generate shift schedules
    if (options.includeShiftSchedules && options.shiftScheduleStages.length > 0) {
      console.log('\n📅 GENERATING SHIFT SCHEDULES');
      
      try {
        // Fetch shifts data for each stage
        for (const stage of options.shiftScheduleStages) {
          console.log(`Generating shifts for stage ${stage}`);
          
          // Fetch shifts for this stage
          const { data: shifts } = await supabase
            .from('festival_shifts')
            .select(`
              *,
              assignments:festival_shift_assignments(
                *,
                profiles(first_name, last_name)
              )
            `)
            .eq('job_id', jobId)
            .eq('stage', stage);

          const pdfData: ShiftsTablePdfData = {
            jobTitle,
            date: new Date().toISOString().split('T')[0],
            jobId,
            shifts: shifts || [],
            logoUrl
          };

          const shiftsBlob = await exportShiftsTablePDF(pdfData);
          pdfsToMerge.push(shiftsBlob);
          sections.push({ title: `Stage ${stage} Staff Schedules`, pageCount: 1 });
        }
        console.log('✅ Shift schedules generated');
      } catch (error) {
        console.error('❌ Error generating shift schedules:', error);
      }
    }

    // Generate artist tables
    if (options.includeArtistTables && options.artistTableStages.length > 0) {
      console.log('\n🎭 GENERATING ARTIST TABLES');
      
      try {
        for (const stage of options.artistTableStages) {
          console.log(`Generating artist table for stage ${stage}`);
          const artistTableData = {
            jobId,
            jobTitle,
            stage,
            logoUrl
          };
          const artistTableBlob = await exportArtistTablePDF(artistTableData);
          pdfsToMerge.push(artistTableBlob);
          sections.push({ title: `Stage ${stage} Artist Schedule`, pageCount: 1 });
        }
        console.log('✅ Artist tables generated');
      } catch (error) {
        console.error('❌ Error generating artist tables:', error);
      }
    }

    // Generate individual artist requirements
    if (options.includeArtistRequirements && options.artistRequirementStages.length > 0) {
      console.log('\n📋 GENERATING ARTIST REQUIREMENTS');
      
      try {
        for (const stage of options.artistRequirementStages) {
          console.log(`Generating artist requirements for stage ${stage}`);
          
          // Fetch artists for this stage
          const { data: artists, error } = await supabase
            .from('festival_artists')
            .select('*')
            .eq('job_id', jobId)
            .eq('stage', stage)
            .order('date', { ascending: true })
            .order('name', { ascending: true });

          if (error) {
            console.error('Error fetching artists:', error);
            continue;
          }

          if (!artists || artists.length === 0) {
            console.log(`No artists found for stage ${stage}`);
            continue;
          }

          // Generate PDF for each artist
          for (const artist of artists) {
            console.log(`Generating requirements for artist: ${artist.name}`);
            
            const artistPdfData: ArtistPdfData = {
              name: artist.name,
              stage: artist.stage || stage,
              date: artist.date || new Date().toISOString().split('T')[0],
              schedule: {
                show: {
                  start: artist.show_start || '00:00',
                  end: artist.show_end || '00:00'
                },
                soundcheck: artist.soundcheck ? {
                  start: artist.soundcheck_start || '00:00',
                  end: artist.soundcheck_end || '00:00'
                } : undefined
              },
              technical: {
                fohTech: artist.foh_tech || false,
                monTech: artist.mon_tech || false,
                fohConsole: {
                  model: artist.foh_console || 'TBD',
                  providedBy: artist.foh_console_provided_by || 'festival'
                },
                monConsole: {
                  model: artist.mon_console || 'TBD',
                  providedBy: artist.mon_console_provided_by || 'festival'
                },
                wireless: {
                  systems: artist.wireless_systems || [],
                  providedBy: artist.wireless_provided_by || 'festival'
                },
                iem: {
                  systems: artist.iem_systems || [],
                  providedBy: artist.iem_provided_by || 'festival'
                },
                monitors: {
                  enabled: artist.monitors_enabled || false,
                  quantity: artist.monitors_quantity || 0
                }
              },
              infrastructure: {
                providedBy: artist.infrastructure_provided_by || 'festival',
                cat6: {
                  enabled: artist.infra_cat6 || false,
                  quantity: artist.infra_cat6_quantity || 0
                },
                hma: {
                  enabled: artist.infra_hma || false,
                  quantity: artist.infra_hma_quantity || 0
                },
                coax: {
                  enabled: artist.infra_coax || false,
                  quantity: artist.infra_coax_quantity || 0
                },
                opticalconDuo: {
                  enabled: artist.infra_opticalcon_duo || false,
                  quantity: artist.infra_opticalcon_duo_quantity || 0
                },
                analog: artist.infra_analog || 0,
                other: artist.other_infrastructure || ''
              },
              extras: {
                sideFill: artist.extras_sf || false,
                drumFill: artist.extras_df || false,
                djBooth: artist.extras_djbooth || false,
                wired: artist.extras_wired || ''
              },
              notes: artist.notes || '',
              logoUrl,
              wiredMics: artist.wired_mics || []
            };

            const artistReqBlob = await exportArtistPDF(artistPdfData);
            pdfsToMerge.push(artistReqBlob);
          }
          
          sections.push({ title: `Stage ${stage} Artist Requirements`, pageCount: artists.length * 3 });
        }
        console.log('✅ Artist requirements generated');
      } catch (error) {
        console.error('❌ Error generating artist requirements:', error);
      }
    }

    // Generate RF & IEM tables
    if (options.includeRfIemTable && options.rfIemTableStages.length > 0) {
      console.log('\n📡 GENERATING RF & IEM TABLES');
      
      try {
        for (const stage of options.rfIemTableStages) {
          console.log(`Generating RF/IEM table for stage ${stage}`);
          const rfIemBlob = await exportRfIemTablePDF(jobId, jobTitle, stage, logoUrl);
          pdfsToMerge.push(rfIemBlob);
          sections.push({ title: `Stage ${stage} RF & IEM Overview`, pageCount: 1 });
        }
        console.log('✅ RF & IEM tables generated');
      } catch (error) {
        console.error('❌ Error generating RF & IEM tables:', error);
      }
    }

    // Generate infrastructure tables
    if (options.includeInfrastructureTable && options.infrastructureTableStages.length > 0) {
      console.log('\n🏗️ GENERATING INFRASTRUCTURE TABLES');
      
      try {
        for (const stage of options.infrastructureTableStages) {
          console.log(`Generating infrastructure table for stage ${stage}`);
          const infraBlob = await exportInfrastructureTablePDF(jobId, jobTitle, stage, logoUrl);
          pdfsToMerge.push(infraBlob);
          sections.push({ title: `Stage ${stage} Infrastructure Needs`, pageCount: 1 });
        }
        console.log('✅ Infrastructure tables generated');
      } catch (error) {
        console.error('❌ Error generating infrastructure tables:', error);
      }
    }

    // Generate wired microphone matrix
    if (options.includeWiredMicNeeds) {
      console.log('\n🎤 GENERATING WIRED MICROPHONE MATRIX');
      
      try {
        // Fetch artists with proper date filtering
        const { data: artists, error: artistsError } = await supabase
          .from('festival_artists')
          .select('*')
          .eq('job_id', jobId)
          .order('date', { ascending: true })
          .order('stage', { ascending: true })
          .order('name', { ascending: true });

        if (artistsError) {
          console.error('❌ Error fetching artists:', artistsError);
          throw artistsError;
        }

        console.log('🎭 ARTISTS FETCHED FOR MATRIX:', {
          totalCount: artists?.length || 0,
          sampleData: artists?.slice(0, 3).map(a => ({
            name: a.name,
            date: a.date,
            stage: a.stage,
            wiredMicsCount: a.wired_mics?.length || 0,
            wiredMicsPreview: a.wired_mics?.slice(0, 2)
          }))
        });

        if (artists && artists.length > 0) {
          // Filter by selected stages if specified
          const filteredArtists = options.wiredMicNeedsStages.length > 0 
            ? artists.filter(a => options.wiredMicNeedsStages.includes(a.stage || 1))
            : artists;

          console.log(`📊 Filtered to ${filteredArtists.length} artists for selected stages`);

          if (filteredArtists.length > 0) {
            const matrixBlob = await exportWiredMicrophoneMatrixFromArtists(
              filteredArtists,
              jobTitle,
              logoUrl
            );
            
            console.log('✅ Wired microphone matrix generated, size:', matrixBlob.size);
            pdfsToMerge.push(matrixBlob);
            sections.push({ title: 'Wired Microphone Requirements', pageCount: 2 });
          }
        } else {
          console.log('⚠️ No artists found for wired microphone matrix');
        }
      } catch (error) {
        console.error('❌ Error generating wired microphone matrix:', error);
      }
    }

    // Generate missing rider report
    if (options.includeMissingRiderReport) {
      console.log('\n📋 GENERATING MISSING RIDER REPORT');
      
      try {
        const missingRiderBlob = await exportMissingRiderReportPDF(jobId, jobTitle, logoUrl);
        pdfsToMerge.push(missingRiderBlob);
        sections.push({ title: 'Missing Rider Report', pageCount: 1 });
        console.log('✅ Missing rider report generated');
      } catch (error) {
        console.error('❌ Error generating missing rider report:', error);
      }
    }

    // Generate Table of Contents if we have multiple sections
    if (sections.length > 1) {
      console.log('\n📑 GENERATING TABLE OF CONTENTS');
      try {
        const tocBlob = await generateTableOfContents(sections, logoUrl);
        // Insert TOC after cover page (at index 1)
        pdfsToMerge.splice(1, 0, tocBlob);
        console.log('✅ Table of contents generated');
      } catch (error) {
        console.error('❌ Error generating table of contents:', error);
      }
    }

    // Merge PDFs
    console.log('\n🧮 MERGING PDFs');
    console.log(`📊 Total PDFs to merge: ${pdfsToMerge.length}`);
    
    if (pdfsToMerge.length === 0) {
      throw new Error('No PDFs were generated to merge');
    }

    const mergedPdf = await mergePDFs(pdfsToMerge);
    console.log('✅ PDFs merged, total size:', mergedPdf.size);

    return { blob: mergedPdf, filename };
  } catch (error) {
    console.error('❌ FESTIVAL PDF GENERATOR ERROR:', error);
    throw error;
  }
};
