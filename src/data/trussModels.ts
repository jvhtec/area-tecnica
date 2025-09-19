// src/data/trussModels.ts
import type { TrussModel } from "@/calc/rigging";

// TODO: Fill real values from manufacturer datasheets (EI, self weight, allowables).
export const TRUSS_MODELS: TrussModel[] = [
  {
    id: "H30V-8",
    name: "Prolyte H30V (8 m)",
    lengthM: 8,
    selfWeightKgPerM: 8.2,     // <-- update
    EI: 3.2e9,                 // <-- update (N·m²)
    allowableM_Nm: 9.5e3,      // <-- update
    allowableDeflectionM: 8/200
  },
  {
    id: "52x52-10",
    name: "52x52 (10 m)",
    lengthM: 10,
    selfWeightKgPerM: 7.5,     // <-- update
    EI: 4.6e9,                 // <-- update
    allowableM_Nm: 12e3,       // <-- update
    allowableDeflectionM: 10/200
  }
];

