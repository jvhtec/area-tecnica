"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.organizeArtistsByDateAndStage = exports.exportWiredMicrophoneMatrixPDF = void 0;
var jspdf_1 = require("jspdf");
var jspdf_autotable_1 = require("jspdf-autotable");
var exportWiredMicrophoneMatrixPDF = function (data) { return __awaiter(void 0, void 0, void 0, function () {
    var pdf, pageWidth, pageHeight, margin, primaryColor, secondaryColor, lightGray, headerGray, isFirstPage, dateEntries, i, _a, date, stagesMap, stageEntries, _loop_1, j, timestamp, pageCount, i;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                pdf = new jspdf_1.default('landscape', 'pt', 'a4');
                pageWidth = pdf.internal.pageSize.width;
                pageHeight = pdf.internal.pageSize.height;
                margin = 20;
                primaryColor = [139, 21, 33];
                secondaryColor = [52, 73, 94];
                lightGray = [240, 240, 240];
                headerGray = [248, 249, 250];
                isFirstPage = true;
                console.log('🚀 FRESH START: Starting simplified PDF generation');
                console.log('📊 Input data:', {
                    totalDates: data.artistsByDateAndStage.size,
                    dateStructure: Array.from(data.artistsByDateAndStage.entries()).map(function (_a) {
                        var date = _a[0], stages = _a[1];
                        return ({
                            date: date,
                            stageCount: stages.size,
                            totalArtists: Array.from(stages.values()).reduce(function (sum, artists) { return sum + artists.length; }, 0)
                        });
                    })
                });
                dateEntries = Array.from(data.artistsByDateAndStage.entries());
                i = 0;
                _b.label = 1;
            case 1:
                if (!(i < dateEntries.length)) return [3 /*break*/, 6];
                _a = dateEntries[i], date = _a[0], stagesMap = _a[1];
                stageEntries = Array.from(stagesMap.entries());
                _loop_1 = function (j) {
                    var _c, stage, artists, yPosition, logoResponse, logoBlob_1, logoDataUrl, error_1, formattedDate, matrixData, headers, tableBody, availableWidth, micModelColumnWidth, peakColumnWidth, artistColumnsWidth, artistColumnWidth;
                    var _d;
                    return __generator(this, function (_e) {
                        switch (_e.label) {
                            case 0:
                                _c = stageEntries[j], stage = _c[0], artists = _c[1];
                                console.log("\n\uD83D\uDCCB Processing: ".concat(date, " - Stage ").concat(stage, " (").concat(artists.length, " artists)"));
                                if (!isFirstPage) {
                                    pdf.addPage();
                                }
                                isFirstPage = false;
                                yPosition = 20;
                                if (!(data.logoUrl && yPosition === 20)) return [3 /*break*/, 6];
                                _e.label = 1;
                            case 1:
                                _e.trys.push([1, 5, , 6]);
                                return [4 /*yield*/, fetch(data.logoUrl)];
                            case 2:
                                logoResponse = _e.sent();
                                return [4 /*yield*/, logoResponse.blob()];
                            case 3:
                                logoBlob_1 = _e.sent();
                                return [4 /*yield*/, new Promise(function (resolve) {
                                        var reader = new FileReader();
                                        reader.onload = function () { return resolve(reader.result); };
                                        reader.readAsDataURL(logoBlob_1);
                                    })];
                            case 4:
                                logoDataUrl = _e.sent();
                                pdf.addImage(logoDataUrl, 'PNG', margin, yPosition, 50, 25);
                                yPosition += 35;
                                return [3 /*break*/, 6];
                            case 5:
                                error_1 = _e.sent();
                                console.error('❌ Logo loading error:', error_1);
                                return [3 /*break*/, 6];
                            case 6:
                                // Header with burgundy background
                                pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                                pdf.rect(0, yPosition, pageWidth, 25, 'F');
                                pdf.setTextColor(255, 255, 255);
                                pdf.setFontSize(16);
                                pdf.setFont('helvetica', 'bold');
                                pdf.text('Wired Microphone Requirements Matrix', pageWidth / 2, yPosition + 16, { align: 'center' });
                                yPosition += 35;
                                // Job title
                                pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
                                pdf.setFontSize(14);
                                pdf.setFont('helvetica', 'normal');
                                pdf.text(data.jobTitle, pageWidth / 2, yPosition, { align: 'center' });
                                yPosition += 20;
                                formattedDate = formatDateSimply(date);
                                pdf.setFillColor(headerGray[0], headerGray[1], headerGray[2]);
                                pdf.rect(margin, yPosition - 5, pageWidth - (margin * 2), 20, 'F');
                                pdf.setFontSize(12);
                                pdf.setFont('helvetica', 'bold');
                                pdf.text("".concat(formattedDate, " - Stage ").concat(stage), pageWidth / 2, yPosition + 8, { align: 'center' });
                                yPosition += 30;
                                matrixData = generateSimplifiedMatrixData(artists);
                                console.log('📊 Matrix generated:', {
                                    micModels: matrixData.micModels,
                                    artists: matrixData.artistNames,
                                    sampleData: matrixData.micModels.slice(0, 2).map(function (model) { return ({
                                        model: model,
                                        artistValues: matrixData.artistNames.slice(0, 3).map(function (artist) { var _a; return "".concat(artist, ": ").concat(((_a = matrixData.individualMatrix[model]) === null || _a === void 0 ? void 0 : _a[artist]) || 0); }),
                                        peak: matrixData.peakMatrix[model]
                                    }); })
                                });
                                if (matrixData.micModels.length === 0) {
                                    pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
                                    pdf.setFontSize(11);
                                    pdf.setFont('helvetica', 'normal');
                                    pdf.text('No wired microphone requirements for this stage.', margin, yPosition);
                                    return [2 /*return*/, "continue"];
                                }
                                // Add note
                                pdf.setFontSize(10);
                                pdf.setFont('helvetica', 'italic');
                                pdf.setTextColor(100, 100, 100);
                                pdf.text('Individual cells show exact quantities per artist. Peak shows maximum concurrent usage.', margin, yPosition);
                                yPosition += 20;
                                headers = __spreadArray(__spreadArray(['Microphone Model'], matrixData.artistNames, true), ['Peak Need'], false);
                                tableBody = matrixData.micModels.map(function (micModel) {
                                    var row = [micModel];
                                    // Add individual artist quantities
                                    matrixData.artistNames.forEach(function (artistName) {
                                        var _a;
                                        var quantity = ((_a = matrixData.individualMatrix[micModel]) === null || _a === void 0 ? void 0 : _a[artistName]) || 0;
                                        row.push(quantity.toString());
                                    });
                                    // Add peak quantity
                                    var peakQuantity = matrixData.peakMatrix[micModel] || 0;
                                    row.push(peakQuantity.toString());
                                    return row;
                                });
                                availableWidth = pageWidth - (margin * 2);
                                micModelColumnWidth = Math.min(availableWidth * 0.25, 150);
                                peakColumnWidth = 80;
                                artistColumnsWidth = availableWidth - micModelColumnWidth - peakColumnWidth;
                                artistColumnWidth = Math.max(artistColumnsWidth / matrixData.artistNames.length, 60);
                                // Generate table
                                (0, jspdf_autotable_1.autoTable)(pdf, {
                                    startY: yPosition,
                                    head: [headers],
                                    body: tableBody,
                                    theme: 'grid',
                                    headStyles: {
                                        fillColor: primaryColor,
                                        textColor: [255, 255, 255],
                                        fontSize: 10,
                                        fontStyle: 'bold',
                                        halign: 'center',
                                        valign: 'middle'
                                    },
                                    bodyStyles: {
                                        fontSize: 9,
                                        textColor: secondaryColor,
                                        cellPadding: 3,
                                        halign: 'center',
                                        valign: 'middle'
                                    },
                                    alternateRowStyles: {
                                        fillColor: lightGray
                                    },
                                    styles: {
                                        cellPadding: 3,
                                        lineColor: [200, 200, 200],
                                        lineWidth: 0.5,
                                        overflow: 'linebreak'
                                    },
                                    columnStyles: (_d = {
                                            0: {
                                                cellWidth: micModelColumnWidth,
                                                fontStyle: 'bold',
                                                halign: 'left'
                                            }
                                        },
                                        _d[headers.length - 1] = {
                                            cellWidth: peakColumnWidth,
                                            fillColor: [255, 240, 240],
                                            fontStyle: 'bold',
                                            textColor: primaryColor
                                        },
                                        _d),
                                    didParseCell: function (data) {
                                        // Style artist columns
                                        if (data.column.index > 0 && data.column.index < headers.length - 1) {
                                            data.cell.styles.cellWidth = artistColumnWidth;
                                            // Highlight non-zero quantities
                                            if (data.section === 'body' && parseInt(data.cell.text[0]) > 0) {
                                                data.cell.styles.fillColor = [235, 255, 235];
                                                data.cell.styles.fontStyle = 'bold';
                                            }
                                        }
                                    },
                                    margin: { left: margin, right: margin }
                                });
                                return [2 /*return*/];
                        }
                    });
                };
                j = 0;
                _b.label = 2;
            case 2:
                if (!(j < stageEntries.length)) return [3 /*break*/, 5];
                return [5 /*yield**/, _loop_1(j)];
            case 3:
                _b.sent();
                _b.label = 4;
            case 4:
                j++;
                return [3 /*break*/, 2];
            case 5:
                i++;
                return [3 /*break*/, 1];
            case 6:
                timestamp = new Date().toLocaleString();
                pageCount = pdf.getNumberOfPages();
                for (i = 1; i <= pageCount; i++) {
                    pdf.setPage(i);
                    pdf.setFontSize(8);
                    pdf.setFont('helvetica', 'normal');
                    pdf.setTextColor(128, 128, 128);
                    pdf.setDrawColor(200, 200, 200);
                    pdf.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);
                    pdf.text("Generated on ".concat(timestamp), margin, pageHeight - 10);
                    pdf.text("".concat(data.jobTitle, " - Wired Microphone Matrix"), pageWidth - margin, pageHeight - 10, { align: 'right' });
                    pdf.text("Page ".concat(i, " of ").concat(pageCount), pageWidth / 2, pageHeight - 10, { align: 'center' });
                }
                return [2 /*return*/, new Blob([pdf.output('blob')], { type: 'application/pdf' })];
        }
    });
}); };
exports.exportWiredMicrophoneMatrixPDF = exportWiredMicrophoneMatrixPDF;
// Simple date formatting - no complex timezone handling
var formatDateSimply = function (dateString) {
    console.log("\uD83D\uDCC5 Formatting date: \"".concat(dateString, "\""));
    // Handle YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        var _a = dateString.split('-'), year = _a[0], month = _a[1], day = _a[2];
        var date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        var weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        var months = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        var formatted = "".concat(weekdays[date.getDay()], ", ").concat(months[date.getMonth()], " ").concat(parseInt(day), ", ").concat(year);
        console.log("\uD83D\uDCC5 Formatted: \"".concat(dateString, "\" -> \"").concat(formatted, "\""));
        return formatted;
    }
    return dateString; // Fallback to original
};
// Completely simplified matrix generation - direct database mapping
var generateSimplifiedMatrixData = function (artists) {
    console.log('\n🔄 SIMPLIFIED MATRIX GENERATION START');
    console.log('🎭 Artists input:', artists.map(function (a) {
        var _a, _b;
        return ({
            name: a.name,
            wiredMicsCount: ((_a = a.wired_mics) === null || _a === void 0 ? void 0 : _a.length) || 0,
            wiredMicsPreview: (_b = a.wired_mics) === null || _b === void 0 ? void 0 : _b.slice(0, 2)
        });
    }));
    var micModelsSet = new Set();
    var artistNamesSet = new Set();
    var individualMatrix = {};
    // Step 1: Direct database mapping - no accumulation bugs
    artists.forEach(function (artist, artistIndex) {
        var artistName = artist.name || "Artist ".concat(artistIndex + 1);
        artistNamesSet.add(artistName);
        console.log("\n\uD83D\uDC64 Processing artist: ".concat(artistName));
        console.log("\uD83C\uDFA4 Raw wired_mics:", artist.wired_mics);
        if (!artist.wired_mics || !Array.isArray(artist.wired_mics)) {
            console.log("\u26A0\uFE0F No wired_mics array for ".concat(artistName));
            return;
        }
        // Process each mic entry directly
        artist.wired_mics.forEach(function (micEntry, micIndex) {
            console.log("\uD83C\uDFA4 Processing mic ".concat(micIndex, ":"), micEntry);
            if (!micEntry || typeof micEntry !== 'object') {
                console.log("\u274C Invalid mic entry ".concat(micIndex));
                return;
            }
            var micModel = String(micEntry.model || '').trim();
            var quantity = parseInt(String(micEntry.quantity || 0));
            if (!micModel || quantity <= 0) {
                console.log("\u274C Invalid mic: model=\"".concat(micModel, "\", quantity=").concat(quantity));
                return;
            }
            console.log("\u2705 VALID MIC: ".concat(artistName, " needs ").concat(quantity, "x ").concat(micModel));
            micModelsSet.add(micModel);
            // Initialize if needed
            if (!individualMatrix[micModel]) {
                individualMatrix[micModel] = {};
            }
            // CRITICAL FIX: Direct assignment, no accumulation
            individualMatrix[micModel][artistName] = quantity;
            console.log("\uD83D\uDCDD STORED: ".concat(micModel, "[").concat(artistName, "] = ").concat(quantity));
        });
    });
    // Step 2: Simple peak calculation - just sum all requirements
    var peakMatrix = {};
    console.log('\n⚡ CALCULATING PEAKS');
    micModelsSet.forEach(function (micModel) {
        var artistRequirements = individualMatrix[micModel] || {};
        var peak = Object.values(artistRequirements).reduce(function (sum, qty) { return sum + (qty || 0); }, 0);
        peakMatrix[micModel] = peak;
        console.log("\uD83D\uDCCA Peak for ".concat(micModel, ": ").concat(peak, " (from ").concat(Object.entries(artistRequirements).map(function (_a) {
            var artist = _a[0], qty = _a[1];
            return "".concat(artist, ":").concat(qty);
        }).join(', '), ")"));
    });
    var result = {
        micModels: Array.from(micModelsSet).sort(),
        artistNames: Array.from(artistNamesSet).sort(),
        individualMatrix: individualMatrix,
        peakMatrix: peakMatrix
    };
    console.log('\n🎯 FINAL SIMPLIFIED RESULT:');
    console.log("\uD83C\uDFA4 Mic models (".concat(result.micModels.length, "):"), result.micModels);
    console.log("\uD83D\uDC65 Artists (".concat(result.artistNames.length, "):"), result.artistNames);
    console.log('📊 Individual matrix sample:', Object.entries(result.individualMatrix).slice(0, 2));
    console.log('⚡ Peak matrix sample:', Object.entries(result.peakMatrix).slice(0, 3));
    return result;
};
// Helper function to organize artists by date and stage - fixed date handling
var organizeArtistsByDateAndStage = function (artists) {
    var _a;
    var organized = new Map();
    console.log('\n🗂️ ORGANIZING ARTISTS BY DATE/STAGE - FIXED VERSION');
    console.log("\uD83D\uDCCB Input: ".concat(artists.length, " artists"));
    // Log all unique dates first
    var allDates = [];
    for (var i = 0; i < artists.length; i++) {
        var date = artists[i].date;
        if (date) {
            allDates.push(date);
        }
    }
    var uniqueDates = Array.from(new Set(allDates));
    console.log('📅 ALL DATES IN INPUT:', uniqueDates);
    for (var i = 0; i < artists.length; i++) {
        var artist = artists[i];
        var date = artist.date;
        var stage = artist.stage || 1;
        console.log("\uD83D\uDCCC Artist ".concat(i, ": \"").concat(artist.name, "\" -> Date: \"").concat(date, "\", Stage: ").concat(stage));
        if (!date) {
            console.warn("\u26A0\uFE0F Skipping \"".concat(artist.name, "\" - no date field"));
            continue;
        }
        // Initialize structures
        if (!organized.has(date)) {
            organized.set(date, new Map());
        }
        if (!organized.get(date).has(stage)) {
            organized.get(date).set(stage, []);
        }
        organized.get(date).get(stage).push(artist);
    }
    console.log('\n📊 ORGANIZATION COMPLETE:');
    var organizedEntries = Array.from(organized.entries());
    for (var i = 0; i < organizedEntries.length; i++) {
        var _b = organizedEntries[i], date = _b[0], stages = _b[1];
        console.log("\uD83D\uDCC5 Date \"".concat(date, "\": ").concat(stages.size, " stages"));
        var stageEntries = Array.from(stages.entries());
        for (var j = 0; j < stageEntries.length; j++) {
            var _c = stageEntries[j], stage = _c[0], stageArtists = _c[1];
            console.log("  \uD83C\uDFAA Stage ".concat(stage, ": ").concat(stageArtists.length, " artists"));
            for (var k = 0; k < stageArtists.length; k++) {
                var artist = stageArtists[k];
                var wiredMicCount = ((_a = artist.wired_mics) === null || _a === void 0 ? void 0 : _a.length) || 0;
                console.log("    \uD83D\uDC64 ".concat(artist.name, ": ").concat(wiredMicCount, " wired mics"));
            }
        }
    }
    return organized;
};
exports.organizeArtistsByDateAndStage = organizeArtistsByDateAndStage;
