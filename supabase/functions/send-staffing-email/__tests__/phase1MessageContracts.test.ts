import { describe, expect, it } from "vitest";

import {
  buildLegacyStaffingActionUrl,
  buildPathStaffingActionUrl,
  buildWhatsAppStaffingMessage,
  normalizeStaffingConfirmBase,
} from "../messageUtils.ts";

const baseArgs = {
  fullName: "Pat Jones",
  jobTitle: "Main Event",
  roleLabel: "FOH — Responsable",
  normalizedDates: ["sábado, 10 de octubre de 2026"],
  isSingleDayRequest: true,
  targetDateLabel: "sábado, 10 de octubre de 2026",
  startDate: "sábado, 10 de octubre de 2026",
  endDate: "domingo, 11 de octubre de 2026",
  callTime: "08:00",
  location: "Madrid Arena",
  note: "Traer DNI.",
  tourPdfSignedUrl: "https://example.test/tour.pdf",
  confirmUrl: "https://sector-pro.work/staffing/confirm/request/token",
  declineUrl: "https://sector-pro.work/staffing/decline/request/token",
} as const;

describe("send-staffing-email Phase 1 message contracts", () => {
  describe("URL construction", () => {
    it("trims whitespace and all trailing slashes from the confirmation base", () => {
      expect(normalizeStaffingConfirmBase("  https://sector-pro.work/staffing///  ")).toBe(
        "https://sector-pro.work/staffing",
      );
    });

    it("percent-encodes request ids and tokens in path links", () => {
      expect(
        buildPathStaffingActionUrl(
          "https://sector-pro.work/staffing",
          "confirm",
          "request/with slash",
          "token?with=query",
        ),
      ).toBe(
        "https://sector-pro.work/staffing/confirm/request%2Fwith%20slash/token%3Fwith%3Dquery",
      );
    });

    it("preserves the selected action in path links", () => {
      expect(
        buildPathStaffingActionUrl(
          "https://sector-pro.work/staffing/",
          "decline",
          "request-1",
          "token-1",
        ),
      ).toBe(
        "https://sector-pro.work/staffing/decline/request-1/token-1",
      );
    });

    it("encodes expiry, token and channel in legacy links", () => {
      const url = new URL(
        buildLegacyStaffingActionUrl({
          base: "https://project.functions.supabase.co/staffing-click/",
          rid: "request-1",
          action: "confirm",
          exp: "2026-10-10T10:11:12.123Z",
          token: "token+/=",
          channel: "whatsapp",
        }),
      );

      expect(url.pathname).toBe("/staffing-click");
      expect(url.searchParams.get("rid")).toBe("request-1");
      expect(url.searchParams.get("a")).toBe("confirm");
      expect(url.searchParams.get("exp")).toBe("2026-10-10T10:11:12.123Z");
      expect(url.searchParams.get("t")).toBe("token+/=");
      expect(url.searchParams.get("c")).toBe("whatsapp");
    });
  });

  describe("availability copy minimization", () => {
    it("does not disclose role, call time, venue, note or tour PDF during availability", () => {
      const text = buildWhatsAppStaffingMessage({
        phase: "availability",
        ...baseArgs,
      });

      expect(text).toContain("Consulta de disponibilidad.");
      expect(text).toContain("Confirmar disponibilidad:");
      expect(text).toContain("No disponible:");
      expect(text).not.toContain(baseArgs.roleLabel);
      expect(text).not.toContain(baseArgs.callTime);
      expect(text).not.toContain(baseArgs.location);
      expect(text).not.toContain(baseArgs.note);
      expect(text).not.toContain(baseArgs.tourPdfSignedUrl);
      expect(text).not.toContain(baseArgs.jobTitle);
    });

    it("falls back to a generic salutation when the technician name is blank", () => {
      const text = buildWhatsAppStaffingMessage({
        phase: "availability",
        ...baseArgs,
        fullName: "   ",
      });
      expect(text.startsWith("Hola,")).toBe(true);
    });

    it("renders multiple availability dates as individual bullets", () => {
      const text = buildWhatsAppStaffingMessage({
        phase: "availability",
        ...baseArgs,
        normalizedDates: [
          "sábado, 10 de octubre de 2026",
          "domingo, 11 de octubre de 2026",
          "lunes, 12 de octubre de 2026",
        ],
        isSingleDayRequest: false,
        targetDateLabel: null,
      });

      expect(text).toContain("- Fechas:");
      expect(text).toContain("  • sábado, 10 de octubre de 2026");
      expect(text).toContain("  • domingo, 11 de octubre de 2026");
      expect(text).toContain("  • lunes, 12 de octubre de 2026");
    });

    it("uses a single explicit target label for one-day availability", () => {
      const text = buildWhatsAppStaffingMessage({
        phase: "availability",
        ...baseArgs,
      });
      expect(text).toContain("- Fecha: sábado, 10 de octubre de 2026");
      expect(text).not.toContain("domingo, 11 de octubre de 2026");
    });

    it("uses the job span when no normalized date list or single target is supplied", () => {
      const text = buildWhatsAppStaffingMessage({
        phase: "availability",
        ...baseArgs,
        normalizedDates: [],
        isSingleDayRequest: false,
        targetDateLabel: null,
      });
      expect(text).toContain(
        "- Fechas: sábado, 10 de octubre de 2026 — domingo, 11 de octubre de 2026",
      );
    });
  });

  describe("offer copy", () => {
    it("includes the operational details that availability intentionally hides", () => {
      const text = buildWhatsAppStaffingMessage({
        phase: "offer",
        ...baseArgs,
      });

      expect(text).toContain("Tienes una oferta para Main Event.");
      expect(text).toContain("- Rol: FOH — Responsable");
      expect(text).toContain("- Horario: 08:00");
      expect(text).toContain("- Ubicación: Madrid Arena");
      expect(text).toContain("Traer DNI.");
      expect(text).toContain("Calendario del tour (PDF): https://example.test/tour.pdf");
      expect(text).toContain("Aceptar oferta:");
      expect(text).toContain("Rechazar oferta:");
    });

    it("omits optional role, note and PDF sections when they are blank", () => {
      const text = buildWhatsAppStaffingMessage({
        phase: "offer",
        ...baseArgs,
        roleLabel: " ",
        note: " ",
        tourPdfSignedUrl: null,
      });

      expect(text).not.toContain("- Rol:");
      expect(text).not.toContain("Calendario del tour");
      expect(text).not.toContain("Traer DNI.");
      expect(text).toContain("- Horario: 08:00");
      expect(text).toContain("- Ubicación: Madrid Arena");
    });

    it("falls back to generic job copy when the title is blank", () => {
      const text = buildWhatsAppStaffingMessage({
        phase: "offer",
        ...baseArgs,
        jobTitle: "   ",
      });
      expect(text).toContain("Tienes una oferta para el trabajo.");
    });

    it("preserves the supplied response URLs verbatim in message copy", () => {
      const text = buildWhatsAppStaffingMessage({
        phase: "offer",
        ...baseArgs,
        confirmUrl: "https://example.test/a?x=1&y=2",
        declineUrl: "https://example.test/b#fragment",
      });
      expect(text).toContain("Aceptar oferta: https://example.test/a?x=1&y=2");
      expect(text).toContain("Rechazar oferta: https://example.test/b#fragment");
    });
  });
});
