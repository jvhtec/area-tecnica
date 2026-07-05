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
} from "@/utils/flexMaterialReport";

type PrintableDepartment = Extract<FlexMaterialReportDepartment, "sound" | "lights">;

const MATERIAL_LIST_DEPARTMENTS: Array<{ department: PrintableDepartment; label: string }> = [
  { department: "sound", label: "Sonido" },
  { department: "lights", label: "Iluminación" },
];

const QUOTE_FOLDER_TYPES = new Set([
  "comercial_presupuesto",
  "dryhire_presupuesto",
  "presupuestos_recibidos",
]);

type PrintFlexReportActionProps = {
  job: JobCardJob;
};

const getFolderElementId = (folder: NonNullable<JobCardJob["flex_folders"]>[number]) =>
  folder.element_id || folder.elementId || null;

const hasQuoteForDepartment = (job: JobCardJob, department: PrintableDepartment) =>
  (job.flex_folders || []).some((folder) =>
    folder.department === department &&
    typeof folder.folder_type === "string" &&
    QUOTE_FOLDER_TYPES.has(folder.folder_type) &&
    Boolean(getFolderElementId(folder))
  );

export const PrintFlexReportAction = ({ job }: PrintFlexReportActionProps) => {
  const { toast } = useToast();
  const [loadingDepartment, setLoadingDepartment] = React.useState<PrintableDepartment | null>(null);
  const quoteAvailability = React.useMemo(
    () => new Map(
      MATERIAL_LIST_DEPARTMENTS.map(({ department }) => [
        department,
        hasQuoteForDepartment(job, department),
      ])
    ),
    [job]
  );
  const hasAnyQuote = Array.from(quoteAvailability.values()).some(Boolean);

  const handlePrintMaterialList = React.useCallback(async (department: PrintableDepartment, label: string) => {
    if (!job.id || loadingDepartment || !quoteAvailability.get(department)) return;

    setLoadingDepartment(department);
    try {
      const result = await fetchFlexMaterialReport(
        job.id,
        department,
        undefined,
        null,
        "material-list"
      );

      window.open(result.url, "_blank", "noopener,noreferrer");
      toast({
        title: "Lista de material generada",
        description: `Se ha abierto la lista de material de ${label}.`,
      });
    } catch (error: unknown) {
      toast({
        title: "No se pudo imprimir la lista",
        description: error instanceof Error ? error.message : "No se pudo obtener la lista de material de Flex.",
        variant: "destructive",
      });
    } finally {
      setLoadingDepartment(null);
    }
  }, [job.id, loadingDepartment, quoteAvailability, toast]);

  const loadingLabel = MATERIAL_LIST_DEPARTMENTS.find(
    (option) => option.department === loadingDepartment
  )?.label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={!!loadingDepartment || !hasAnyQuote}
          title={hasAnyQuote ? "Imprimir lista de material de Flex" : "No hay presupuesto de sonido o iluminación en Flex"}
        >
          {loadingDepartment ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Printer className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {loadingLabel ? `Lista ${loadingLabel}` : "Lista Material"}
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
              void handlePrintMaterialList(department, label);
            }}
          >
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
