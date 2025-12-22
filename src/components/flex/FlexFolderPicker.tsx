import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CreateFoldersOptions,
  DepartmentDefaultSelector,
  DepartmentKey,
  DepartmentSelectionOptions,
  SubfolderKey,
  cloneDepartmentSelectionOptions,
  getSubfolderSelectionSummary,
  sanitizeCustomPullsheetSettings,
  sanitizeExtrasPresupuestoSettings,
} from "@/utils/flex-folders";

type DepartmentSection = {
  label: string;
  items: { key: SubfolderKey; label: string; description?: string }[];
};

const DEPARTMENT_SECTIONS: Record<DepartmentKey, DepartmentSection> = {
  sound: {
    label: "Sonido",
    items: [
      // { key: "hojaInfo", label: "Hoja de Información (SIP)" }, // DEPRECATED - not used anymore
      { key: "documentacionTecnica", label: "Documentación Técnica" },
      { key: "presupuestosRecibidos", label: "Presupuestos Recibidos" },
      { key: "hojaGastos", label: "Hoja de Gastos" },
      { key: "pullSheetTP", label: "Pull Sheet Tour Pack" },
      { key: "pullSheetPA", label: "Pull Sheet PA" },
    ],
  },
  lights: {
    label: "Luces",
    items: [
      // { key: "hojaInfo", label: "Hoja de Información (LIP)" }, // DEPRECATED - not used anymore
      { key: "documentacionTecnica", label: "Documentación Técnica" },
      { key: "presupuestosRecibidos", label: "Presupuestos Recibidos" },
      { key: "hojaGastos", label: "Hoja de Gastos" },
    ],
  },
  video: {
    label: "Video",
    items: [
      // { key: "hojaInfo", label: "Hoja de Información (VIP)" }, // DEPRECATED - not used anymore
      { key: "documentacionTecnica", label: "Documentación Técnica" },
      { key: "presupuestosRecibidos", label: "Presupuestos Recibidos" },
      { key: "hojaGastos", label: "Hoja de Gastos" },
    ],
  },
  production: {
    label: "Producción",
    items: [
      { key: "documentacionTecnica", label: "Documentación Técnica" },
      { key: "presupuestosRecibidos", label: "Presupuestos Recibidos" },
      { key: "hojaGastos", label: "Hoja de Gastos" },
    ],
  },
  personnel: {
    label: "Personal",
    items: [
      { key: "workOrder", label: "Orden de Trabajo" },
      { key: "gastosDePersonal", label: "Gastos de Personal" },
      { key: "crewCallSound", label: "Crew Call Sonido" },
      { key: "crewCallLights", label: "Crew Call Luces" },
    ],
  },
  comercial: {
    label: "Comercial",
    items: [
      {
        key: "extrasSound",
        label: "Extras Sonido",
        description: "Genera la carpeta de extras para el equipo de sonido.",
      },
      {
        key: "extrasLights",
        label: "Extras Luces",
        description: "Genera la carpeta de extras para el equipo de luces.",
      },
      {
        key: "presupuestoSound",
        label: "Presupuesto Sonido",
        description:
          "Crea el presupuesto principal para sonido usando el nombre del departamento/fecha en lugar de Comercial.",
      },
      {
        key: "presupuestoLights",
        label: "Presupuesto Luces",
        description:
          "Crea el presupuesto principal para luces usando el nombre del departamento/fecha en lugar de Comercial.",
      },
    ],
  },
};

// Default selections changed to empty - user must explicitly select what they want
const DEFAULT_SELECTIONS: Record<DepartmentKey, SubfolderKey[]> = {
  sound: [],
  lights: [],
  video: [],
  production: [],
  personnel: [],
  comercial: [],
};

const departmentEntries = Object.entries(DEPARTMENT_SECTIONS) as [
  DepartmentKey,
  DepartmentSection,
][];

const hasItems = (dept: DepartmentKey) => DEPARTMENT_SECTIONS[dept]?.items.length > 0;

const sortKeysForDepartment = (dept: DepartmentKey, keys: SubfolderKey[]) => {
  const order = DEPARTMENT_SECTIONS[dept]?.items.map(item => item.key) ?? [];
  return [...keys].sort((a, b) => {
    const indexA = order.indexOf(a);
    const indexB = order.indexOf(b);
    const safeIndexA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
    const safeIndexB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;
    return safeIndexA - safeIndexB;
  });
};

type TechnicalDepartmentKey = "sound" | "lights" | "video";

const TECHNICAL_DEPARTMENTS: TechnicalDepartmentKey[] = [
  "sound",
  "lights",
  "video",
];
const technicalDepartments = new Set<DepartmentKey>(TECHNICAL_DEPARTMENTS);

const getDefaultSubfolders = (dept: DepartmentKey) =>
  sortKeysForDepartment(dept, [...DEFAULT_SELECTIONS[dept]]);

const cloneDepartmentSelection = (
  dept: DepartmentKey,
  selection?: DepartmentSelectionOptions
): DepartmentSelectionOptions => {
  const base: DepartmentSelectionOptions =
    cloneDepartmentSelectionOptions(selection) ?? {};
  const hasProvidedSubfolders = base.subfolders !== undefined;
  const sourceSubfolders = hasProvidedSubfolders
    ? base.subfolders!
    : getDefaultSubfolders(dept);
  const validSubfolders = sourceSubfolders.filter(key =>
    DEPARTMENT_SECTIONS[dept].items.some(item => item.key === key)
  );
  const subfolders = sortKeysForDepartment(dept, validSubfolders);

  return {
    ...base,
    subfolders,
  };
};

const buildDefaultOptions = (): CreateFoldersOptions => {
  const result: CreateFoldersOptions = {};
  for (const [dept] of departmentEntries) {
    if (!hasItems(dept)) continue;
    result[dept] = {
      subfolders: getDefaultSubfolders(dept),
    };
  }
  return result;
};

const mergeWithDefaults = (options?: CreateFoldersOptions): CreateFoldersOptions => {
  const defaults = buildDefaultOptions();
  if (!options) return defaults;
  const result: CreateFoldersOptions = { ...defaults };

  for (const [dept, provided] of Object.entries(options) as [
    DepartmentKey,
    DepartmentSelectionOptions | undefined,
  ][]) {
    if (!hasItems(dept) || !provided) continue;
    result[dept] = cloneDepartmentSelection(dept, provided);
  }

  return result;
};

const prepareOptionsForSubmit = (
  options: CreateFoldersOptions
): CreateFoldersOptions | undefined => {
  const defaults = buildDefaultOptions();
  const result: CreateFoldersOptions = {};
  let hasAny = false;

  for (const [dept, values] of Object.entries(options) as [
    DepartmentKey,
    DepartmentSelectionOptions,
  ][]) {
    if (!hasItems(dept)) continue;
    const sanitized = cloneDepartmentSelection(dept, values);
    const defaultEntry = defaults[dept];
    const defaultSubfolders = defaultEntry?.subfolders ?? [];
    const { keys: subfolders } = getSubfolderSelectionSummary(sanitized);

    const subfoldersDiffer =
      subfolders.length !== defaultSubfolders.length ||
      subfolders.some((value, index) => value !== defaultSubfolders[index]);

    const customPullsheet = sanitizeCustomPullsheetSettings(
      sanitized.customPullsheet
    );

    const extrasPresupuestoSanitized = sanitizeExtrasPresupuestoSettings(
      sanitized.extrasPresupuesto
    );
    const extrasSelected =
      subfolders.includes("extrasSound") || subfolders.includes("extrasLights");
    const extrasHasDetails = Boolean(
      extrasPresupuestoSanitized &&
        ((extrasPresupuestoSanitized.entries?.length ?? 0) > 0 ||
          extrasPresupuestoSanitized.startDate ||
          extrasPresupuestoSanitized.endDate)
    );
    const includeExtras = extrasSelected || extrasHasDetails;

    if (subfoldersDiffer || customPullsheet || (includeExtras && extrasPresupuestoSanitized)) {
      result[dept] = {
        subfolders,
        ...(customPullsheet ? { customPullsheet } : {}),
        ...(includeExtras && extrasPresupuestoSanitized
          ? { extrasPresupuesto: extrasPresupuestoSanitized }
          : {}),
      };
      hasAny = true;
    }
  }

  // If nothing is selected, return explicit empty selections for all departments
  // This prevents createAllFoldersForJob from treating undefined as "create everything"
  if (!hasAny) {
    const emptyResult: CreateFoldersOptions = {};
    for (const [dept] of Object.entries(options) as [
      DepartmentKey,
      DepartmentSelectionOptions,
    ][]) {
      if (hasItems(dept)) {
        emptyResult[dept] = { subfolders: [] };
      }
    }
    return emptyResult;
  }

  return result;
};

export const getFlexFolderDefaultSelection: DepartmentDefaultSelector = dept =>
  [...DEFAULT_SELECTIONS[dept]];

export interface FlexFolderPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (options?: CreateFoldersOptions) => void;
  initialOptions?: CreateFoldersOptions;
}

export function FlexFolderPicker({
  open,
  onOpenChange,
  onConfirm,
  initialOptions,
}: FlexFolderPickerProps) {
  const [selection, setSelection] = React.useState<CreateFoldersOptions>(() =>
    mergeWithDefaults(initialOptions)
  );

  React.useEffect(() => {
    if (open) {
      setSelection(mergeWithDefaults(initialOptions));
    }
  }, [open, initialOptions]);

  const updateDepartmentSelection = React.useCallback(
    (
      dept: DepartmentKey,
      updater: (current: DepartmentSelectionOptions) => DepartmentSelectionOptions
    ) => {
      setSelection(prev => {
        const existing = prev[dept];
        const base = cloneDepartmentSelection(dept, existing);
        const updated = updater(base);
        return { ...prev, [dept]: updated };
      });
    },
    []
  );

  const handleToggle = React.useCallback(
    (dept: DepartmentKey, key: SubfolderKey, checked: boolean) => {
      updateDepartmentSelection(dept, current => {
        const nextSet = new Set(current.subfolders);
        if (checked) {
          nextSet.add(key);
        } else {
          nextSet.delete(key);
        }
        return {
          ...current,
          subfolders: sortKeysForDepartment(dept, Array.from(nextSet)),
        };
      });
    },
    [updateDepartmentSelection]
  );

  const handleCustomPullsheetToggle = React.useCallback(
    (dept: TechnicalDepartmentKey, enabled: boolean) => {
      updateDepartmentSelection(dept, current => {
        const existing = current.customPullsheet;
        if (enabled) {
          return {
            ...current,
            customPullsheet: {
              enabled: true,
              name: existing?.name ?? "",
              startDate: existing?.startDate,
              endDate: existing?.endDate,
            },
          };
        }

        if (!existing) {
          return { ...current };
        }

        return {
          ...current,
          customPullsheet: { ...existing, enabled: false },
        };
      });
    },
    [updateDepartmentSelection]
  );

  const handleCustomPullsheetFieldChange = React.useCallback(
    (
      dept: TechnicalDepartmentKey,
      field: "name" | "startDate" | "endDate",
      value: string
    ) => {
      updateDepartmentSelection(dept, current => {
        const existing = current.customPullsheet ?? {
          enabled: true,
          name: "",
          startDate: undefined as string | undefined,
          endDate: undefined as string | undefined,
        };

        const nextValue =
          field === "name" ? value : value ? value : undefined;

        return {
          ...current,
          customPullsheet: {
            ...existing,
            enabled: true,
            [field]: nextValue,
          },
        };
      });
    },
    [updateDepartmentSelection]
  );

  const handleExtrasDateChange = React.useCallback(
    (field: "startDate" | "endDate", value: string) => {
      updateDepartmentSelection("comercial", current => {
        const base = cloneDepartmentSelectionOptions(current) ?? {};
        const nextValue = value ? value : undefined;
        const nextExtras: DepartmentSelectionOptions["extrasPresupuesto"] = {
          ...(base.extrasPresupuesto ?? {}),
          [field]: nextValue,
        };

        const hasEntries =
          (base.extrasPresupuesto?.entries?.length ?? 0) > 0;

        if (hasEntries) {
          nextExtras.entries = base.extrasPresupuesto?.entries?.map(entry => ({
            ...entry,
          }));
        }

        if (!nextExtras.startDate && !nextExtras.endDate && !hasEntries) {
          const { extrasPresupuesto, ...rest } = base;
          return rest as DepartmentSelectionOptions;
        }

        return {
          ...base,
          extrasPresupuesto: nextExtras,
        };
      });
    },
    [updateDepartmentSelection]
  );

  const handleUsePreset = React.useCallback(() => {
    setSelection(buildDefaultOptions());
  }, []);

  const handleCancel = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleConfirm = React.useCallback(() => {
    onConfirm(prepareOptionsForSubmit(selection));
    onOpenChange(false);
  }, [onConfirm, onOpenChange, selection]);

  const selectableDepartments = departmentEntries.filter(([, section]) =>
    section.items.length > 0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-0">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Seleccionar estructura de Flex</DialogTitle>
          <DialogDescription>
            Marca las carpetas y elementos que deseas crear en Flex.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-shrink-0 items-center justify-between border-b pb-4">
          <span className="text-sm text-muted-foreground">
            Usa las casillas para personalizar cada departamento.
          </span>
          <Button variant="ghost" size="sm" onClick={handleUsePreset}>
            Usar preset
          </Button>
        </div>

        <div className="mt-4 grid max-h-[50vh] flex-1 gap-6 overflow-y-auto pr-2">
          {selectableDepartments.map(([dept, section]) => {
            const departmentSelection = cloneDepartmentSelection(
              dept,
              selection[dept]
            );
            const { keys: checkedItems } = getSubfolderSelectionSummary(
              departmentSelection
            );
            const isTechnical = technicalDepartments.has(dept);
            const customPullsheet = departmentSelection.customPullsheet;
            const showCustomPullsheetFields =
              isTechnical && (customPullsheet?.enabled ?? false);
            const extrasSelected =
              dept === "comercial" &&
              (checkedItems.includes("extrasSound") ||
                checkedItems.includes("extrasLights"));
            const extrasPresupuesto = departmentSelection.extrasPresupuesto ?? {};

            return (
              <section key={dept} className="space-y-3">
                <header>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.label}
                  </h3>
                </header>
                <div className="grid gap-2 sm:grid-cols-2">
                  {section.items.map(item => {
                    const checkboxId = `${dept}-${item.key}`;
                    const isChecked = checkedItems.includes(item.key);
                    return (
                      <div
                        key={item.key}
                        className="flex items-start gap-3 rounded-md border p-3"
                      >
                        <Checkbox
                          id={checkboxId}
                          checked={isChecked}
                          onCheckedChange={value =>
                            handleToggle(dept, item.key, value === true)
                          }
                        />
                        <div className="space-y-1">
                          <Label htmlFor={checkboxId} className="text-sm font-medium">
                            {item.label}
                          </Label>
                          {item.description ? (
                            <p className="text-xs text-muted-foreground">
                              {item.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {isTechnical ? (
                  <div className="rounded-md border p-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`${dept}-custom-pullsheet`}
                        checked={customPullsheet?.enabled ?? false}
                        onCheckedChange={value =>
                          handleCustomPullsheetToggle(dept as TechnicalDepartmentKey, value === true)
                        }
                      />
                      <Label
                        htmlFor={`${dept}-custom-pullsheet`}
                        className="text-sm font-medium"
                      >
                        Pull sheet personalizado
                      </Label>
                    </div>
                    {showCustomPullsheetFields ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2 space-y-1">
                          <Label htmlFor={`${dept}-custom-pullsheet-name`}>
                            Nombre
                          </Label>
                          <Input
                            id={`${dept}-custom-pullsheet-name`}
                            value={customPullsheet?.name ?? ""}
                            placeholder="Nombre del pull sheet"
                            onChange={event =>
                              handleCustomPullsheetFieldChange(
                                dept as TechnicalDepartmentKey,
                                "name",
                                event.target.value
                              )
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`${dept}-custom-pullsheet-start`}>
                            Fecha de inicio
                          </Label>
                          <Input
                            id={`${dept}-custom-pullsheet-start`}
                            type="date"
                            value={customPullsheet?.startDate ?? ""}
                            onChange={event =>
                              handleCustomPullsheetFieldChange(
                                dept as TechnicalDepartmentKey,
                                "startDate",
                                event.target.value
                              )
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`${dept}-custom-pullsheet-end`}>
                            Fecha de fin
                          </Label>
                          <Input
                            id={`${dept}-custom-pullsheet-end`}
                            type="date"
                            value={customPullsheet?.endDate ?? ""}
                            onChange={event =>
                              handleCustomPullsheetFieldChange(
                                dept as TechnicalDepartmentKey,
                                "endDate",
                                event.target.value
                              )
                            }
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {dept === "comercial" && extrasSelected ? (
                  <div className="rounded-md border p-3">
                    <h4 className="text-sm font-semibold">Extras Presupuesto</h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Define fechas específicas para los presupuestos de extras.
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="extras-presupuesto-start">
                          Fecha de inicio
                        </Label>
                        <Input
                          id="extras-presupuesto-start"
                          type="date"
                          value={extrasPresupuesto.startDate ?? ""}
                          onChange={event =>
                            handleExtrasDateChange("startDate", event.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="extras-presupuesto-end">
                          Fecha de fin
                        </Label>
                        <Input
                          id="extras-presupuesto-end"
                          type="date"
                          value={extrasPresupuesto.endDate ?? ""}
                          onChange={event =>
                            handleExtrasDateChange("endDate", event.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>

        <DialogFooter className="mt-4 flex-shrink-0 gap-2 border-t pt-4">
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>Crear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
