
import { exportWiredMicrophoneMatrixPDF, organizeArtistsByDateAndStage, WiredMicrophoneMatrixData } from './wiredMicrophoneMatrixPdfExport';

export const exportWiredMicrophoneMatrixFromArtists = async (
  artists: any[],
  jobTitle: string,
  logoUrl?: string
): Promise<Blob> => {
  console.log('\n🔍 DIRECT EXPORT DEBUG START');
  console.log('📊 Raw artists input:', {
    totalArtists: artists.length,
    sampleArtists: artists.slice(0, 3).map(a => ({
      name: a.name,
      date: a.date,
      stage: a.stage,
      wiredMicsCount: a.wired_mics?.length || 0
    }))
  });

  // Check if we have valid artists with dates
  const artistsWithDates = artists.filter(a => a.date);
  console.log(`📅 Artists with dates: ${artistsWithDates.length}/${artists.length}`);
  
  if (artistsWithDates.length === 0) {
    console.error('❌ NO ARTISTS WITH DATES FOUND!');
    throw new Error('No artists with valid dates found for matrix generation');
  }

  // Log unique dates found
  const uniqueDates = [...new Set(artistsWithDates.map(a => a.date))];
  console.log('📅 Unique dates found:', uniqueDates);

  const artistsByDateAndStage = organizeArtistsByDateAndStage(artists);

  const matrixData: WiredMicrophoneMatrixData = {
    jobTitle,
    logoUrl,
    artistsByDateAndStage
  };

  console.log('🎯 Matrix data prepared:', {
    jobTitle,
    dateStagesCount: matrixData.artistsByDateAndStage.size,
    dates: Array.from(matrixData.artistsByDateAndStage.keys())
  });

  return await exportWiredMicrophoneMatrixPDF(matrixData);
};
