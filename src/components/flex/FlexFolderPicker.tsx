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
import { Label } from "@/components/ui/label";
import {
  CreateFoldersOptions,
  DepartmentDefaultSelector,
  DepartmentKey,
  SubfolderKey,
} from "@/utils/flex-folders";

type DepartmentSection = {
  label: string;
  items: { key: SubfolderKey; label: string; description?: string }[];
};

const DEPARTMENT_SECTIONS: Record<DepartmentKey, DepartmentSection> = {
  sound: {
    label: "Sonido",
    items: [
      { key: "hojaInfo", label: "Hoja de Información (SIP)" },
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
      { key: "hojaInfo", label: "Hoja de Información (LIP)" },
      { key: "documentacionTecnica", label: "Documentación Técnica" },
      { key: "presupuestosRecibidos", label: "Presupuestos Recibidos" },
      { key: "hojaGastos", label: "Hoja de Gastos" },
    ],
  },
  video: {
    label: "Video",
    items: [
      { key: "hojaInfo", label: "Hoja de Información (VIP)" },
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
      { key: "gastosDePersonal", label: "Gastos de Personal" },
      { key: "crewCallSound", label: "Crew Call Sonido" },
      { key: "crewCallLights", label: "Crew Call Luces" },
    ],
  },
  comercial: {
    label: "Comercial",
    items: [],
  },
};

const DEFAULT_SELECTIONS: Record<DepartmentKey, SubfolderKey[]> = {
  sound: [
    "hojaInfo",
    "documentacionTecnica",
    "presupuestosRecibidos",
    "hojaGastos",
    "pullSheetTP",
    "pullSheetPA",
  ],
  lights: ["hojaInfo", "documentacionTecnica", "presupuestosRecibidos", "hojaGastos"],
  video: ["hojaInfo", "documentacionTecnica", "presupuestosRecibidos", "hojaGastos"],
  production: [
    "documentacionTecnica",
    "presupuestosRecibidos",
    "hojaGastos",
  ],
  personnel: ["gastosDePersonal", "crewCallSound", "crewCallLights"],
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

const cloneOptions = (
  options?: CreateFoldersOptions
): CreateFoldersOptions | undefined => {
  if (!options) return undefined;
  const result: CreateFoldersOptions = {};
  let hasAny = false;
  for (const [dept, values] of Object.entries(options) as [
    DepartmentKey,
    SubfolderKey[] | undefined,
  ][]) {
    if (!hasItems(dept) || values === undefined) continue;
    const validKeys = values.filter(key =>
      DEPARTMENT_SECTIONS[dept].items.some(item => item.key === key)
    );
    result[dept] = sortKeysForDepartment(dept, validKeys);
    hasAny = true;
  }
  return hasAny ? result : undefined;
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
  const [selection, setSelection] = React.useState<
    CreateFoldersOptions | undefined
  >(cloneOptions(initialOptions));

  React.useEffect(() => {
    if (open) {
      setSelection(cloneOptions(initialOptions));
    }
  }, [open, initialOptions]);

  const handleToggle = React.useCallback(
    (dept: DepartmentKey, key: SubfolderKey, checked: boolean) => {
      const section = DEPARTMENT_SECTIONS[dept];
      if (!section) return;
      setSelection(prev => {
        const defaultList = getFlexFolderDefaultSelection(dept);
        const currentList =
          prev && Object.prototype.hasOwnProperty.call(prev, dept)
            ? prev[dept] ?? []
            : defaultList;
        const nextSet = new Set(currentList);
        if (checked) {
          nextSet.add(key);
        } else {
          nextSet.delete(key);
        }
        const nextList = sortKeysForDepartment(dept, Array.from(nextSet));
        const defaultSorted = sortKeysForDepartment(dept, defaultList);
        const sameAsDefault =
          nextList.length === defaultSorted.length &&
          nextList.every((value, index) => value === defaultSorted[index]);

        if (sameAsDefault) {
          if (!prev) return undefined;
          const { [dept]: _removed, ...rest } = prev;
          return Object.keys(rest).length ? rest : undefined;
        }

        const nextSelection = { ...(prev ?? {}) } as CreateFoldersOptions;
        nextSelection[dept] = nextList;
        return nextSelection;
      });
    },
    []
  );

  const handleUsePreset = React.useCallback(() => {
    setSelection(undefined);
  }, []);

  const handleCancel = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleConfirm = React.useCallback(() => {
    onConfirm(cloneOptions(selection));
    onOpenChange(false);
  }, [onConfirm, onOpenChange, selection]);

  const selectableDepartments = departmentEntries.filter(([, section]) =>
    section.items.length > 0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-full max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Seleccionar estructura de Flex</DialogTitle>
          <DialogDescription>
            Marca las carpetas y elementos que deseas crear en Flex.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Usa las casillas para personalizar cada departamento.
          </span>
          <Button variant="ghost" size="sm" onClick={handleUsePreset}>
            Usar preset
          </Button>
        </div>

        <div className="mt-4 grid gap-6 overflow-y-auto pr-2">
          {selectableDepartments.map(([dept, section]) => {
            const defaultSelection = getFlexFolderDefaultSelection(dept);
            const checkedItems =
              selection && Object.prototype.hasOwnProperty.call(selection, dept)
                ? selection[dept] ?? []
                : defaultSelection;

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
              </section>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>Crear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
