
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { PrintOptions } from '@/components/festival/pdf/PrintOptionsDialog';
import { supabase } from '@/lib/supabase';
import { fetchJobLogo } from './logoUtils';
import { mergePDFs } from './pdfMerge';
import { generateCoverPage } from './coverPageGenerator';
import { exportWiredMicrophoneMatrixFromArtists } from '../wiredMicrophoneMatrixDirectExport';

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

  try {
    // Generate cover page - using a basic cover since includeCoverPage doesn't exist in PrintOptions
    console.log('\n📃 GENERATING COVER PAGE');
    const coverPageBlob = await generateCoverPage(jobId, jobTitle);
    console.log('✅ Cover page generated, size:', coverPageBlob.size);
    pdfsToMerge.push(coverPageBlob);

    // Generate wired microphone matrix if requested
    if (options.includeWiredMicNeeds) {
      console.log('\n🎤 GENERATING WIRED MICROPHONE MATRIX');
      
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
        // Check dates in fetched data
        const datesInData = [...new Set(artists.map(a => a.date).filter(Boolean))];
        console.log('📅 DATES IN FETCHED ARTISTS:', datesInData);

        const logoUrl = await fetchJobLogo(jobId);
        const matrixBlob = await exportWiredMicrophoneMatrixFromArtists(
          artists,
          jobTitle,
          logoUrl
        );
        
        console.log('✅ Wired microphone matrix generated, size:', matrixBlob.size);
        pdfsToMerge.push(matrixBlob);
      } else {
        console.log('⚠️ No artists found for wired microphone matrix');
      }
    }

    // Merge PDFs
    console.log('\n🧮 MERGING PDFs');
    const mergedPdf = await mergePDFs(pdfsToMerge);
    console.log('✅ PDFs merged, total size:', mergedPdf.size);

    return { blob: mergedPdf, filename };
  } catch (error) {
    console.error('❌ FESTIVAL PDF GENERATOR ERROR:', error);
    throw error;
  }
};
