// src/data/trussModels.ts
import type { TrussModel } from "@/calc/rigging";

// P0-03 safety gate: these historical constants are not manufacturer-verified.
// Keep allowablesVerified=false so the app can estimate reactions but cannot
// present moment/deflection pass-fail results as safety decisions. Reactivation
// requires replacing these values from manufacturer datasheets and setting the
// affected model to allowablesVerified=true with source references.
export const TRUSS_MODELS: TrussModel[] = [
  {
    id: "H30V-8",
    name: "Prolyte H30V (8 m)",
    lengthM: 8,
    selfWeightKgPerM: 8.2,
    EI: 3.2e9,
    allowableM_Nm: 9.5e3,
    allowableDeflectionM: 8 / 200,
    allowablesVerified: false,
    validationNote: "Unverified legacy placeholder values; pass/fail disabled pending manufacturer datasheet review."
  },
  {
    id: "52x52-10",
    name: "52x52 (10 m)",
    lengthM: 10,
    selfWeightKgPerM: 7.5,
    EI: 4.6e9,
    allowableM_Nm: 12e3,
    allowableDeflectionM: 10 / 200,
    allowablesVerified: false,
    validationNote: "Unverified legacy placeholder values; pass/fail disabled pending manufacturer datasheet review."
  }
];
