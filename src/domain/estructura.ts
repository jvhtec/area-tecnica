export const ESTRUCTURA_DEPARTMENT = "estructura" as const;

export const ESTRUCTURA_SOURCE_DEPARTMENTS = ["sound", "lights"] as const;

export type EstructuraSourceDepartment =
  (typeof ESTRUCTURA_SOURCE_DEPARTMENTS)[number];

export function isEstructuraSourceDepartment(
  value: string | null | undefined,
): value is EstructuraSourceDepartment {
  return value === "sound" || value === "lights";
}

export const ESTRUCTURA_PULL_SHEETS: Record<
  EstructuraSourceDepartment,
  { label: string; nameSuffix: string; documentSuffix: string }
> = {
  sound: {
    label: "Sonido",
    nameSuffix: "Estructura Sonido",
    documentSuffix: "ES",
  },
  lights: {
    label: "Luces",
    nameSuffix: "Estructura Luces",
    documentSuffix: "EL",
  },
};

export type EstructuraMotorModel = {
  id: string;
  name: string;
  manufacturer?: string | null;
};

/** Approved serialized MOTOR inventory models used by preparation and certificates. */
export const ESTRUCTURA_MOTOR_MODELS: readonly EstructuraMotorModel[] = [
  { id: "1eea69e0-5b37-11eb-966a-2a0a4490a7fb", name: "Motor eléctrico de elevación 250 kg - 20 m" },
  { id: "1eecb3d0-5b37-11eb-966a-2a0a4490a7fb", name: "Motor eléctrico de elevación 500 kg - 25 m" },
  { id: "6278f01b-ee56-4454-b6c9-3706edcbe61c", name: "Motor eléctrico de elevación ChainMaster D8 1000 kg - 30 m" },
  { id: "396fa837-0b0d-4283-85d6-6ddfdf2bd25d", name: "Motor de elevación 2000 kg - 18 m" },
  { id: "a6433316-f446-494c-a3d7-91e9c06cc9bc", name: "Motor de elevación 2000 kg 2 m/min - 25 m" },
  { id: "4c73bf4d-ec97-42db-8fb2-439fb37843ac", name: "Motor de elevación 2000 kg 4 m/min - 25 m" },
  { id: "83f6c04b-1835-48fd-9f75-f02181ca362b", name: "Motor de elevación 2000 kg D8+ - 24 m" },
  { id: "eb81f94a-55b9-4b52-b47b-05744093add5", name: "Motor de elevación ChainMaster D8+ 750 kg - 24 m" },
  { id: "39b21045-09f6-49ac-9c02-c24342caa70e", name: "Motor de velocidad variable 750 kg" },
  { id: "db804d32-3d5d-4a8e-9796-e886a00d34a2", name: "ChainMaster 1Tn D8+" },
] as const;

/** Approved non-serialized controller models available only during preparation. */
export const ESTRUCTURA_MOTOR_CONTROL_MODELS: readonly EstructuraMotorModel[] = [
  { id: "1ef2f560-5b37-11eb-966a-2a0a4490a7fb", name: "Control De Motor 1 Unds CEE32/CEE16 Motor" },
  { id: "1efd2e90-5b37-11eb-966a-2a0a4490a7fb", name: "Control De Motor 12 Unds CEE32/CEE16 Motor" },
  { id: "1ef6c5f0-5b37-11eb-966a-2a0a4490a7fb", name: "Control De Motor 2 Unds CEE32/CEE16 Motor" },
  { id: "1ef8e8d0-5b37-11eb-966a-2a0a4490a7fb", name: "Control De Motor 6 Unds CEE32/CEE16 Motor" },
  { id: "1efb0bb0-5b37-11eb-966a-2a0a4490a7fb", name: "Control De Motor 8 Unds CEE32/CEE16 Motor" },
  { id: "c1612b7e-651c-4757-aaff-aa1d1e3de8fe", name: "Control Motor 12 Uni. SRS AHD12-DV" },
  { id: "d6d1b03e-c5cf-494d-ae14-b53227832df8", name: "Control Motor 4Uni." },
  { id: "1b01d36c-e779-483e-a52c-ab7a22a809c1", name: "Control Motor 8 Uni. SRS AHD8-DV" },
  { id: "e9259aaf-4f8f-4e79-9640-50fe9a81dfc2", name: "Control Motor Briteq 4uni" },
  { id: "4f801c32-9584-442a-a5c0-b5a6727432d3", name: "Control Motor Briteq 8uni" },
] as const;

/** Complete approved inventory-model catalog for the Estructura preparation dialog. */
export const ESTRUCTURA_PREPARATION_MODELS: readonly EstructuraMotorModel[] = [
  ...ESTRUCTURA_MOTOR_MODELS,
  ...ESTRUCTURA_MOTOR_CONTROL_MODELS,
] as const;
