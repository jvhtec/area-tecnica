import { describe, expect, it } from "vitest";
import { CODE_TO_LABEL } from "../_shared/roles.ts";
import { labelForRoleCode } from "./roles.ts";

describe("Etiquetas de roles del correo", () => {
  it("reutiliza las etiquetas comunes y conserva la descripción de escenario", () => {
    for (const [code, label] of Object.entries(CODE_TO_LABEL)) {
      expect(labelForRoleCode(code)).toBe(code === "SND-PA-T" ? "Tecnico de Escenario — Técnico" : label);
    }
  });
  it("conserva roles adicionales y códigos desconocidos", () => {
    expect(labelForRoleCode("PROD-COND-T")).toBe("Conductor — Técnico");
    expect(labelForRoleCode("LGT-DIM-E")).toBe("Dimmer — Especialista");
    expect(labelForRoleCode("SND-MNT-T")).toBe("Montador — Técnico");
    expect(labelForRoleCode("desconocido")).toBe("desconocido");
    expect(labelForRoleCode(null)).toBeNull();
  });
});
