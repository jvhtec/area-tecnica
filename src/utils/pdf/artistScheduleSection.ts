import type { jsPDF } from "jspdf";
import {
  FESTIVAL_INK,
  FESTIVAL_SOFT,
  drawFestivalSectionHeading,
  setFestivalMonoText,
  setFestivalText,
  type FestivalGeometry,
} from "@/utils/pdf/festival-report";

interface ArtistSchedule {
  loadIn?: string;
  show: { start: string; end: string };
  soundcheck?: { start: string; end: string };
  lineCheck?: { start: string; end: string };
}

/**
 * The artist's own call sheet: label left in mono, time right in mono, one
 * hairline-free row each. Uses the set's numbered section mark so the datasheet
 * reads like the rest of the bundle rather than like a different document.
 */
export const drawArtistScheduleSection = (
  doc: jsPDF,
  geo: FestivalGeometry,
  schedule: ArtistSchedule,
  yPosition: number,
  language: "es" | "en",
  templateMode = false,
  sectionNumber = 1,
): number => {
  const { mm } = geo;
  const tx = (es: string, en: string) => (language === "en" ? en : es);
  const blank = templateMode ? "________" : "—";

  const range = (value?: { start: string; end: string }): string =>
    `${value?.start || blank} – ${value?.end || blank}`;

  const rows: Array<[string, string]> = [];
  if (templateMode || schedule.loadIn) {
    rows.push([tx("Carga", "Load in"), schedule.loadIn || blank]);
  }
  if (templateMode || schedule.soundcheck) {
    rows.push([tx("Prueba de sonido", "Soundcheck"), range(schedule.soundcheck)]);
  }
  if (templateMode || schedule.lineCheck) {
    rows.push([tx("Line check", "Line check"), range(schedule.lineCheck)]);
  }
  rows.push([tx("Show", "Show"), range(schedule.show)]);

  let y = drawFestivalSectionHeading(
    doc,
    geo,
    tx("Horario", "Schedule"),
    yPosition,
    sectionNumber,
  );

  const columnWidth = geo.contentWidth / 2;
  rows.forEach(([label, value], index) => {
    const x = geo.left + columnWidth * (index % 2);
    if (index % 2 === 0 && index > 0) y += 8 * mm;

    setFestivalText(doc, FESTIVAL_SOFT, 7.4);
    doc.text(label, x, y);
    setFestivalMonoText(doc, FESTIVAL_INK, 8, "bold");
    doc.text(value, x, y + 4.6 * mm);
  });

  return y + (rows.length > 2 ? 8 * mm : 0) + 11 * mm;
};
