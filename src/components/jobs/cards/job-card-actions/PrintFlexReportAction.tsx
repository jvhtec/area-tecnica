import React from "react";
import { ChevronDown, Loader2, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { JobCardJob } from "@/components/jobs/cards/job-card-actions/types";
import {
  fetchFlexMaterialReport,
  type FlexMaterialReportDepartment,
  type FlexMaterialReportType,
} from "@/utils/flexMaterialReport";

type PrintableDepartment = Extract<FlexMaterialReportDepartment, "sound" | "lights">;

const MATERIAL_LIST_DEPARTMENTS: Array<{ department: PrintableDepartment; label: string }> = [
  { department: "sound", label: "Sonido" },
  { department: "lights", label: "Iluminación" },
];

const MATERIAL_LIST_FOLDER_TYPES = new Set([
  "comercial_presupuesto",
  "dryhire_presupuesto",
  "presupuestos_recibidos",
]);

const PRINTABLE_QUOTE_FOLDER_TYPES = new Set([
  "comercial_presupuesto",
  "dryhire_presupuesto",
]);

type PrintFlexReportActionProps = {
  job: JobCardJob;
  department?: PrintableDepartment;
  reportType?: FlexMaterialReportType;
};

const getFolderElementId = (folder: NonNullable<JobCardJob["flex_folders"]>[number]) =>
  folder.element_id || folder.elementId || null;

const getReportFolderTypes = (reportType: FlexMaterialReportType) =>
  reportType === "quote" ? PRINTABLE_QUOTE_FOLDER_TYPES : MATERIAL_LIST_FOLDER_TYPES;

const hasReportForDepartment = (
  job: JobCardJob,
  department: PrintableDepartment,
  reportType: FlexMaterialReportType
) => {
  const folderTypes = getReportFolderTypes(reportType);
  return (job.flex_folders || []).some((folder) =>
    folder.department === department &&
    typeof folder.folder_type === "string" &&
    folderTypes.has(folder.folder_type) &&
    Boolean(getFolderElementId(folder))
  );
};

const REPORT_COPY: Record<FlexMaterialReportType, {
  buttonLabel: string;
  dropdownTitle: string;
  errorTitle: string;
  fallbackError: string;
  loadingLabel: (label: string) => string;
  scopedTitle: (label: string) => string;
  successDescription: (label: string) => string;
  successTitle: string;
  unavailableDropdownTitle: string;
  unavailableScopedTitle: (label: string) => string;
}> = {
  "material-list": {
    buttonLabel: "Lista Material",
    dropdownTitle: "Imprimir lista de material de Flex",
    errorTitle: "No se pudo imprimir la lista",
    fallbackError: "No se pudo obtener la lista de material de Flex.",
    loadingLabel: (label) => `Lista ${label}`,
    scopedTitle: (label) => `Imprimir lista de material de ${label} desde Flex`,
    successDescription: (label) => `Se ha abierto la lista de material de ${label}.`,
    successTitle: "Lista de material generada",
    unavailableDropdownTitle: "No hay presupuesto de sonido o iluminación en Flex",
    unavailableScopedTitle: (label) => `No hay presupuesto de ${label} en Flex`,
  },
  quote: {
    buttonLabel: "Presupuesto",
    dropdownTitle: "Imprimir presupuesto de Flex",
    errorTitle: "No se pudo imprimir el presupuesto",
    fallbackError: "No se pudo obtener el presupuesto de Flex.",
    loadingLabel: (label) => `Presupuesto ${label}`,
    scopedTitle: (label) => `Imprimir presupuesto de ${label} desde Flex`,
    successDescription: (label) => `Se ha abierto el presupuesto de ${label}.`,
    successTitle: "Presupuesto generado",
    unavailableDropdownTitle: "No hay presupuesto de sonido o iluminación en Flex",
    unavailableScopedTitle: (label) => `No hay presupuesto de ${label} en Flex`,
  },
};

export const PrintFlexReportAction = ({
  job,
  department,
  reportType = "material-list",
}: PrintFlexReportActionProps) => {
  const { toast } = useToast();
  const [loadingDepartment, setLoadingDepartment] = React.useState<PrintableDepartment | null>(null);
  const copy = REPORT_COPY[reportType];
  const scopedDepartmentOption = React.useMemo(
    () => MATERIAL_LIST_DEPARTMENTS.find((option) => option.department === department) ?? null,
    [department]
  );
  const quoteAvailability = React.useMemo(
    () => new Map(
      MATERIAL_LIST_DEPARTMENTS.map(({ department: optionDepartment }) => [
        optionDepartment,
        hasReportForDepartment(job, optionDepartment, reportType),
      ])
    ),
    [job, reportType]
  );
  const hasAnyQuote = Array.from(quoteAvailability.values()).some(Boolean);

  const handlePrintReport = React.useCallback(async (department: PrintableDepartment, label: string) => {
    if (!job.id || loadingDepartment || !quoteAvailability.get(department)) return;

    setLoadingDepartment(department);
    // Open the tab synchronously (still within the click's user-gesture window) so
    // popup blockers don't drop the navigation once the async fetch resolves later.
    const reportWindow = window.open("", "_blank");
    try {
      const result = await fetchFlexMaterialReport(
        job.id,
        department,
        undefined,
        null,
        reportType
      );

      if (reportWindow) {
        reportWindow.opener = null;
        reportWindow.location.href = result.url;
      } else {
        window.open(result.url, "_blank", "noopener,noreferrer");
      }
      toast({
        title: copy.successTitle,
        description: copy.successDescription(label),
      });
    } catch (error: unknown) {
      reportWindow?.close();
      toast({
        title: copy.errorTitle,
        description: error instanceof Error ? error.message : copy.fallbackError,
        variant: "destructive",
      });
    } finally {
      setLoadingDepartment(null);
    }
  }, [copy, job.id, loadingDepartment, quoteAvailability, reportType, toast]);

  const loadingLabel = MATERIAL_LIST_DEPARTMENTS.find(
    (option) => option.department === loadingDepartment
  )?.label;

  if (scopedDepartmentOption) {
    const isAvailable = quoteAvailability.get(scopedDepartmentOption.department) ?? false;
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={!!loadingDepartment || !isAvailable}
        onClick={() => void handlePrintReport(scopedDepartmentOption.department, scopedDepartmentOption.label)}
        title={
          isAvailable
            ? copy.scopedTitle(scopedDepartmentOption.label)
            : copy.unavailableScopedTitle(scopedDepartmentOption.label)
        }
      >
        {loadingDepartment ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Printer className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">{copy.buttonLabel}</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={!!loadingDepartment || !hasAnyQuote}
          title={hasAnyQuote ? copy.dropdownTitle : copy.unavailableDropdownTitle}
        >
          {loadingDepartment ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Printer className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {loadingLabel ? copy.loadingLabel(loadingLabel) : copy.buttonLabel}
          </span>
          {!loadingDepartment && <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(event) => event.stopPropagation()}>
        {MATERIAL_LIST_DEPARTMENTS.map(({ department, label }) => (
          <DropdownMenuItem
            key={department}
            disabled={!quoteAvailability.get(department)}
            onSelect={(event) => {
              event.preventDefault();
              void handlePrintReport(department, label);
            }}
          >
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
