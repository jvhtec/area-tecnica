import type { jsPDF } from "jspdf";
import { CORPORATE_RED, TEXT_DARK } from "@/utils/pdf/shared/pdfExportShared";

interface ArtistSchedule {
  loadIn?: string;
  show: { start: string; end: string };
  soundcheck?: { start: string; end: string };
  lineCheck?: { start: string; end: string };
}

export const drawArtistScheduleSection = (
  doc: jsPDF,
  schedule: ArtistSchedule,
  yPosition: number,
  language: "es" | "en",
  templateMode = false,
): number => {
  const tx = (es: string, en: string) => (language === "en" ? en : es);
  const blank = templateMode ? "________" : "";

  doc.setFontSize(12);
  doc.setTextColor(...CORPORATE_RED);
  doc.text(tx("Horario", "Schedule"), 14, yPosition);
  yPosition += 8;
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_DARK);

  if (templateMode || schedule.loadIn) {
    doc.text(`${tx("Load In", "Load In")}: ${schedule.loadIn || blank}`, 14, yPosition);
    yPosition += 6;
  }

  doc.text(`${tx("Horario Show", "Show Time")}: ${schedule.show.start || blank} - ${schedule.show.end || blank}`, 14, yPosition);
  yPosition += 6;

  if (templateMode || schedule.soundcheck) {
    doc.text(`${tx("Prueba de Sonido", "Soundcheck")}: ${schedule.soundcheck?.start || blank} - ${schedule.soundcheck?.end || blank}`, 14, yPosition);
    yPosition += 6;
  }

  if (templateMode || schedule.lineCheck) {
    doc.text(`${tx("Line Check", "Line Check")}: ${schedule.lineCheck?.start || blank} - ${schedule.lineCheck?.end || blank}`, 14, yPosition);
    yPosition += 6;
  }

  return yPosition + 4;
};
