import { describe, expect, it } from "vitest";
import { buildBlankArtistPdfData } from "../blankTemplate";
import {
  buildArtistFormEmail,
  escapeHtml,
  parseRecipientEmails,
  QR_CONTENT_ID,
  toInlineQrImage,
} from "../emailTemplate";
import {
  buildAllLinksText,
  buildArtistFormUrl,
  buildStageLinksText,
  formatStageLabel,
  sortStages,
  toFormLanguage,
  type ArtistLinkRow,
} from "../links";

const ORIGIN = "https://sector-pro.work";

const artist = (overrides: Partial<ArtistLinkRow>): ArtistLinkRow => ({
  artistId: "a",
  name: "Banda",
  stage: 1,
  date: "2026-07-10",
  form_language: "es",
  ...overrides,
});

describe("form links", () => {
  it("builds the public URL with the artist's language", () => {
    expect(buildArtistFormUrl("tok", "en", ORIGIN)).toBe("https://sector-pro.work/festival/artist-form/tok?lang=en");
  });

  it("falls back to Spanish for unknown languages", () => {
    expect(toFormLanguage("fr")).toBe("es");
    expect(toFormLanguage(null)).toBe("es");
    expect(toFormLanguage("en")).toBe("en");
  });

  it("labels artists without a stage instead of hiding them, and sorts them last", () => {
    expect(formatStageLabel(null)).toBe("Sin escenario");
    expect(formatStageLabel(3)).toBe("Escenario 3");
    expect(sortStages([null, 3, 1, 3, 2])).toEqual([1, 2, 3, null]);
  });

  const options = { scopeLabel: "10/07/2026", showDate: false, formatDate: (d?: string | null) => d ?? "", origin: ORIGIN };

  it("lists every artist grouped by stage, with a placeholder where no link was sent", () => {
    const text = buildAllLinksText(
      [
        artist({ artistId: "1", name: "Uno", stage: 2, token: "t1", form_language: "en" }),
        artist({ artistId: "2", name: "Dos", stage: 1 }),
        artist({ artistId: "3", name: "Tres", stage: null, token: "t3" }),
      ],
      options,
    );
    expect(text).toBe(
      [
        "Enlaces de Formularios de Artistas - 10/07/2026",
        "",
        "Escenario 1:",
        "Dos - Enlace aún no generado",
        "",
        "Escenario 2:",
        `Uno - ${ORIGIN}/festival/artist-form/t1?lang=en`,
        "",
        "Sin escenario:",
        `Tres - ${ORIGIN}/festival/artist-form/t3?lang=es`,
        "",
        "",
      ].join("\n"),
    );
  });

  it("adds each artist's date when several dates are listed", () => {
    const text = buildStageLinksText([artist({ token: "t" })], 1, { ...options, scopeLabel: "Todas las fechas", showDate: true });
    expect(text).toContain("Banda (2026-07-10) - ");
    expect(text.startsWith("Escenario 1 - Todas las fechas\n\n")).toBe(true);
  });
});

describe("artist form email", () => {
  it("escapes HTML in names and links", () => {
    expect(escapeHtml(`<b>"O'Neil" & co</b>`)).toBe("&lt;b&gt;&quot;O&#39;Neil&quot; &amp; co&lt;/b&gt;");
    const { bodyHtml } = buildArtistFormEmail({
      language: "es",
      artistName: `<script>alert(1)</script>`,
      formLink: `${ORIGIN}/x?a=1&b="2"`,
    });
    expect(bodyHtml).not.toContain("<script>");
    expect(bodyHtml).toContain("&lt;script&gt;");
    expect(bodyHtml).toContain('href="https://sector-pro.work/x?a=1&amp;b=&quot;2&quot;"');
  });

  it("writes the email in the artist's language and references the inline QR", () => {
    const es = buildArtistFormEmail({ language: "es", artistName: "Banda", formLink: `${ORIGIN}/f` });
    const en = buildArtistFormEmail({ language: "en", artistName: "Banda", formLink: `${ORIGIN}/f` });
    expect(es.subject).toBe("Formulario técnico - Banda");
    expect(en.subject).toBe("Technical form - Banda");
    expect(es.bodyHtml).toContain("Haz clic aquí para completar el formulario");
    expect(en.bodyHtml).toContain("Click here to fill the form");
    expect(es.bodyHtml).toContain(`cid:${QR_CONTENT_ID}`);
  });

  it("does not put the raw subject through HTML escaping", () => {
    expect(buildArtistFormEmail({ language: "es", artistName: "A & B", formLink: "x" }).subject).toBe(
      "Formulario técnico - A & B",
    );
  });

  it("splits recipients on commas, semicolons and new lines, without duplicates", () => {
    expect(parseRecipientEmails(" a@x.com, b@x.com;a@x.com\n c@x.com ,, ")).toEqual(["a@x.com", "b@x.com", "c@x.com"]);
    expect(parseRecipientEmails("  ")).toEqual([]);
  });

  it("turns a data URL into an inline image, and ignores anything else", () => {
    expect(toInlineQrImage("data:image/png;base64,QUJD", "Banda")).toEqual([
      { cid: QR_CONTENT_ID, content: "QUJD", mimeType: "image/png", filename: "artist-form-Banda.png" },
    ]);
    expect(toInlineQrImage("https://example.com/qr.png", "Banda")).toEqual([]);
  });
});

describe("blank template", () => {
  const base = {
    name: "Banda",
    stage: 2,
    date: "2026-07-10",
    schedule: { loadIn: "", show: { start: "", end: "" } },
  };

  it("leaves every technical field empty and festival-provided", () => {
    const data = buildBlankArtistPdfData(base);
    expect(data.technical.fohConsole).toEqual({ model: "", providedBy: "festival" });
    expect(data.technical.monitors).toEqual({ enabled: false, quantity: 0 });
    expect(data.infrastructure.providedBy).toBe("festival");
    expect(data.wiredMics).toEqual([]);
    expect(data.notes).toBe("");
  });

  it("only marks the mic kit and rider for a per-artist template", () => {
    expect(buildBlankArtistPdfData(base)).not.toHaveProperty("micKit");
    expect(buildBlankArtistPdfData({ ...base, forArtist: true })).toMatchObject({
      micKit: "festival",
      riderMissing: false,
    });
    expect(buildBlankArtistPdfData({ ...base, forArtist: true })).not.toHaveProperty("forArtist");
  });

  it("carries the public form link and QR into the template", () => {
    expect(
      buildBlankArtistPdfData({ ...base, publicFormUrl: "https://f", publicFormQrDataUrl: "data:image/png;base64,x" }),
    ).toMatchObject({ publicFormUrl: "https://f", publicFormQrDataUrl: "data:image/png;base64,x" });
  });
});
