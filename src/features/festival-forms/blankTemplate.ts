import type { ArtistPdfData } from "@/utils/pdf/artistPdfTypes";

interface BlankTemplateInput
  extends Pick<
    ArtistPdfData,
    "name" | "stage" | "date" | "schedule" | "logoUrl" | "festivalOptions" | "publicFormUrl" | "publicFormQrDataUrl"
  > {
  /** Set when the template is for one artist whose rider is not missing (the per-artist dialog). */
  forArtist?: boolean;
}

/**
 * The blank, printable technical form. Only the header (who, when, the public link) is filled in;
 * every technical field is empty and provided by the festival, so the artist completes it by hand.
 */
export function buildBlankArtistPdfData({ forArtist = false, ...input }: BlankTemplateInput): ArtistPdfData {
  return {
    ...input,
    technical: {
      fohTech: false,
      monTech: false,
      fohConsole: { model: "", providedBy: "festival" },
      monConsole: { model: "", providedBy: "festival" },
      wireless: { systems: [], providedBy: "festival" },
      iem: { systems: [], providedBy: "festival" },
      monitors: { enabled: false, quantity: 0 },
    },
    infrastructure: {
      providedBy: "festival",
      cat6: { enabled: false, quantity: 0 },
      hma: { enabled: false, quantity: 0 },
      coax: { enabled: false, quantity: 0 },
      opticalconDuo: { enabled: false, quantity: 0 },
      analog: 0,
      other: "",
    },
    extras: { sideFill: false, drumFill: false, djBooth: false, wired: "" },
    notes: "",
    wiredMics: [],
    ...(forArtist ? { micKit: "festival" as const, riderMissing: false } : {}),
  };
}
