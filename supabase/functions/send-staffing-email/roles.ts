// Keep the existing import path while using the shared role catalogue.
export { CODE_TO_LABEL, labelForCode } from "../_shared/roles.ts";
import { labelForCode } from "../_shared/roles.ts";

// Descriptions specific to this email and roles absent from the shared base.
const EMAIL_ROLE_LABELS: Record<string, string> = {
  "SND-PA-T": "Tecnico de Escenario — Técnico",
  "SND-MNT-T": "Montador — Técnico",
  "LGT-ASST-R": "Asistente — Responsable",
  "LGT-ASST-E": "Asistente — Especialista",
  "LGT-DIM-R": "Dimmer — Responsable",
  "LGT-DIM-E": "Dimmer — Especialista",
  "LGT-CAN-T": "Cañón — Técnico",
  "LGT-MON-T": "Montador — Técnico",
  "PROD-RESP-R": "Responsable de Producción — Responsable",
  "PROD-AYUD-T": "Ayudante de Producción — Técnico",
  "PROD-COND-T": "Conductor — Técnico",
};

export function labelForRoleCode(value?: string | null): string | null {
  return value ? EMAIL_ROLE_LABELS[value] ?? labelForCode(value) : null;
}
