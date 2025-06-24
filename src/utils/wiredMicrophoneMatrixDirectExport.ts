
import { exportWiredMicrophoneMatrixPDF, organizeArtistsByDateAndStage, WiredMicrophoneMatrixData } from './wiredMicrophoneMatrixPdfExport';

export const exportWiredMicrophoneMatrixFromArtists = async (
  artists: any[],
  jobTitle: string,
  logoUrl?: string
): Promise<Blob> => {
  const artistsByDateAndStage = organizeArtistsByDateAndStage(artists);

  const matrixData: WiredMicrophoneMatrixData = {
    jobTitle,
    logoUrl,
    artistsByDateAndStage
  };

  return await exportWiredMicrophoneMatrixPDF(matrixData);
};
