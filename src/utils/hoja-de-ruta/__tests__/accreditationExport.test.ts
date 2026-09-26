import { describe, expect, it } from "vitest";

import { buildAccreditationRows } from "@/utils/hoja-de-ruta/accreditationExport";

describe("accreditation export", () => {
  it("includes only the minimum internal accreditation fields", () => {
    const rows = buildAccreditationRows([{
      id: "staff-1",
      name: "Ana",
      surname1: "Técnica",
      surname2: "Prueba",
      dni: "12345678Z",
      position: "SND-PA",
      department: "sound",
      phone: "+34123456789",
    }]);

    expect(rows[3]).toEqual(["Nombre", "Apellidos", "DNI", "Posición", "Departamento"]);
    expect(rows[4]).toEqual(["Ana", "Técnica Prueba", "12345678Z", "SND-PA", "sound"]);
    expect(JSON.stringify(rows)).not.toContain("+34123456789");
  });
});
