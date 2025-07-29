"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var wiredMicrophoneNeedsPdfExport_1 = require("./utils/wiredMicrophoneNeedsPdfExport");
var testData = {
    jobTitle: 'Test Job Title',
    artistsByDateAndStage: (0, wiredMicrophoneNeedsPdfExport_1.organizeArtistsByDateAndStage)([
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
(0, wiredMicrophoneNeedsPdfExport_1.exportWiredMicrophoneMatrixPDF)(testData).then(function (blob) {
    var url = URL.createObjectURL(blob);
    window.open(url);
}).catch(function (error) {
    console.error('Error generating PDF:', error);
});
