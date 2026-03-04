import type { AuxiliaryMachineryType } from "@/types/hoja-de-ruta";

export const AUXILIARY_MACHINERY_OPTIONS: Array<{
  value: AuxiliaryMachineryType;
  label: string;
}> = [
  { value: "carretilla_elevadora", label: "Carretilla elevadora" },
  { value: "plataforma_elevadora_tijera", label: "Plataforma elevadora de tijera" },
  { value: "plataforma_elevadora_movil", label: "Plataforma elevadora móvil" },
];

export const AUXILIARY_MACHINERY_LABELS: Record<AuxiliaryMachineryType, string> =
  AUXILIARY_MACHINERY_OPTIONS.reduce(
    (acc, option) => {
      acc[option.value] = option.label;
      return acc;
    },
    {} as Record<AuxiliaryMachineryType, string>
  );

const AUXILIARY_MACHINERY_TYPE_SET = new Set<AuxiliaryMachineryType>(
  AUXILIARY_MACHINERY_OPTIONS.map((option) => option.value)
);

export const isAuxiliaryMachineryType = (
  value: unknown
): value is AuxiliaryMachineryType =>
  typeof value === "string" &&
  AUXILIARY_MACHINERY_TYPE_SET.has(value as AuxiliaryMachineryType);
