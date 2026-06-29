import { describe, expect, it } from "vitest";

import {
  buildLegacyStaffingActionUrl,
  buildPathStaffingActionUrl,
  buildWhatsAppStaffingMessage,
} from "../messageUtils.ts";

describe("messageUtils", () => {
  it("builds branded path links without query parameters", () => {
    expect(
      buildPathStaffingActionUrl(
        "https://sector-pro.work/staffing/",
        "confirm",
        "request-1",
        "tok_en-123",
      ),
    ).toBe("https://sector-pro.work/staffing/confirm/request-1/tok_en-123");
  });

  it("builds legacy query links for email compatibility", () => {
    expect(
      buildLegacyStaffingActionUrl({
        base: "https://project.functions.supabase.co/staffing-click",
        rid: "request-1",
        action: "decline",
        exp: "2026-04-12T08:58:46.807Z",
        token: "token-1",
        channel: "email",
      }),
    ).toContain("a=decline");
  });

  it("renders availability WhatsApp copy without job details", () => {
    const text = buildWhatsAppStaffingMessage({
      phase: "availability",
      fullName: "Marco Arancibia Sanchez",
      jobTitle: "Operación Triunfo Tour 2026",
      roleLabel: "Montador — Técnico",
      normalizedDates: ["jueves, 16 de abril de 2026", "sábado, 18 de abril de 2026"],
      isSingleDayRequest: false,
      targetDateLabel: null,
      startDate: "jueves, 16 de abril de 2026",
      endDate: "sábado, 18 de abril de 2026",
      callTime: "08:00",
      location: "Bilbao Exhibition Centre (BEC)",
      note: null,
      tourPdfSignedUrl: null,
      confirmUrl: "https://sector-pro.work/staffing/confirm/request-1/token-1",
      declineUrl: "https://sector-pro.work/staffing/decline/request-1/token-1",
    });

    expect(text).toContain("Consulta de disponibilidad.");
    expect(text).toContain("jueves, 16 de abril de 2026");
    expect(text).toContain("sábado, 18 de abril de 2026");
    expect(text).toContain("Confirmar disponibilidad: https://sector-pro.work/staffing/confirm/request-1/token-1");
    expect(text).toContain("No disponible: https://sector-pro.work/staffing/decline/request-1/token-1");
    expect(text).not.toContain("Operación Triunfo Tour 2026");
    expect(text).not.toContain("Montador");
    expect(text).not.toContain("08:00");
    expect(text).not.toContain("Bilbao Exhibition Centre");
    expect(text).not.toContain("Este email");
  });

  it("keeps formal offer WhatsApp copy detailed", () => {
    const text = buildWhatsAppStaffingMessage({
      phase: "offer",
      fullName: "Marco Arancibia Sanchez",
      jobTitle: "Operación Triunfo Tour 2026",
      roleLabel: "Montador — Técnico",
      normalizedDates: ["jueves, 16 de abril de 2026"],
      isSingleDayRequest: true,
      targetDateLabel: "jueves, 16 de abril de 2026",
      startDate: "jueves, 16 de abril de 2026",
      endDate: "sábado, 18 de abril de 2026",
      callTime: "08:00",
      location: "Bilbao Exhibition Centre (BEC)",
      note: "Oferta formal con condiciones cerradas.",
      tourPdfSignedUrl: "https://example.test/tour.pdf",
      confirmUrl: "https://sector-pro.work/staffing/confirm/request-1/token-1",
      declineUrl: "https://sector-pro.work/staffing/decline/request-1/token-1",
    });

    expect(text).toContain("Tienes una oferta para Operación Triunfo Tour 2026.");
    expect(text).toContain("- Rol: Montador — Técnico");
    expect(text).toContain("- Horario: 08:00");
    expect(text).toContain("- Ubicación: Bilbao Exhibition Centre (BEC)");
    expect(text).toContain("Oferta formal con condiciones cerradas.");
    expect(text).toContain("Calendario del tour (PDF): https://example.test/tour.pdf");
    expect(text).toContain("Aceptar oferta: https://sector-pro.work/staffing/confirm/request-1/token-1");
  });
});
