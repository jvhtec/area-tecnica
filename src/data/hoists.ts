// src/data/hoists.ts
import type { HoistType } from "@/calc/rigging";

export const HOIST_CATALOG: HoistType[] = [
  { id: "cm500",  name: "CM 500 kg D8+",  WLL_kg: 500,  selfWeightKg: 50 },
  { id: "cm750",  name: "Chainmaster 750 kg D8+", WLL_kg: 750, selfWeightKg: 69 },
  { id: "cm1000", name: "CM 1000 kg D8+", WLL_kg: 1000, selfWeightKg: 70 },
  { id: "cm2000", name: "CM 2000 kg D8+", WLL_kg: 2000, selfWeightKg: 75 }
];

