import { describe, expect, it } from "vitest";

import {
  buildStaffingClickWhatsappFollowupMessage,
  shouldSendStaffingClickWhatsappFollowup,
} from "../followupUtils.ts";

describe("staffing click follow-up messages", () => {
  it("builds availability follow-up WhatsApp copy", () => {
    expect(buildStaffingClickWhatsappFollowupMessage("availability", "confirmed")).toBe(
      "Gracias por confirmar tu disponibilidad, recibirás otro mensaje con una oferta formal y más detalles de confirmarse el trabajo.",
    );
    expect(buildStaffingClickWhatsappFollowupMessage("availability", "declined")).toBe(
      "Lamentamos que no estés disponible, en otra ocasión será, gracias igualmente.",
    );
  });

  it("builds offer follow-up WhatsApp copy", () => {
    expect(buildStaffingClickWhatsappFollowupMessage("offer", "confirmed")).toBe(
      "Gracias por confirmar este trabajo con nosotros, la oferta queda cerrada y has sido añadido al equipo para este bolo, el departamento de producción te contactará más adelante con más detalles, saludos!",
    );
    expect(buildStaffingClickWhatsappFollowupMessage("offer", "declined")).toBe(
      "Lamentamos que no estés disponible, en otra ocasión será. Gracias igualmente.",
    );
  });

  it("sends follow-up when the request used WhatsApp even if another send event is newer", () => {
    expect(shouldSendStaffingClickWhatsappFollowup("whatsapp", null)).toBe(true);
    expect(shouldSendStaffingClickWhatsappFollowup("", { event: "whatsapp_sent" })).toBe(true);
    expect(shouldSendStaffingClickWhatsappFollowup("email", null)).toBe(false);
  });
});
