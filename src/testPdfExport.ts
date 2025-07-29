import { exportWiredMicrophoneMatrixPDF, WiredMicrophoneMatrixData, organizeArtistsByDateAndStage } from './utils/wiredMicrophoneNeedsPdfExport';

const testData: WiredMicrophoneMatrixData = {
  jobTitle: 'Test Job Title',
  artistsByDateAndStage: organizeArtistsByDateAndStage([
    {
      name: 'Artist 1',
      date: '2023-01-01',
      stage: 1,
      wired_mics: [
        { model: 'Model A', quantity: 2 },
        { model: 'Model B', quantity: 1 }
      ]
    },
    {
      name: 'Artist 2',
      date: '2023-01-01',
      stage: 1,
      wired_mics: [
        { model: 'Model A', quantity: 1 }
      ]
    }
  ])
};

exportWiredMicrophoneMatrixPDF(testData).then((blob) => {
  const url = URL.createObjectURL(blob);
  window.open(url);
}).catch((error) => {
  console.error('Error generating PDF:', error);
});
