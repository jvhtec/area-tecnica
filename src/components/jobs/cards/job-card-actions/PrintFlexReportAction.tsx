import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Loader2, Printer } from "lucide-react";

import type { JobCardJob } from "@/components/jobs/cards/job-card-actions/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/react-query";
import { getElementTree } from "@/utils/flex-folders";
import {
  fetchFlexMaterialReport,
  type FlexMaterialReportDepartment,
  type FlexMaterialReportType,
} from "@/utils/flexMaterialReport";
import {
  getFlexPresupuestoOptionLabel,
  getFlexPresupuestoOptions,
  getFlexReportRootElementId,
  type FlexPresupuestoOption,
} from "@/utils/flexReportPresupuestos";

type PrintableDepartment = Extract<FlexMaterialReportDepartment, "sound" | "lights">;

type PrintFlexReportActionProps = {
  job: JobCardJob;
  department?: PrintableDepartment;
  reportType?: FlexMaterialReportType;
};

const REPORT_COPY: Record<FlexMaterialReportType, {
  buttonLabel: string;
  dropdownTitle: string;
  errorTitle: string;
  fallbackError: string;
  loadingLabel: string;
  successDescription: (label: string) => string;
  successTitle: string;
  unavailableTitle: string;
}> = {
  "material-list": {
    buttonLabel: "Lista Material",
    dropdownTitle: "Elegir presupuesto para imprimir la lista de material de Flex",
    errorTitle: "No se pudo imprimir la lista",
    fallbackError: "No se pudo obtener la lista de material de Flex.",
    loadingLabel: "Generando lista",
    successDescription: (label) => `Se ha abierto la lista de material de ${label}.`,
    successTitle: "Lista de material generada",
    unavailableTitle: "No hay presupuestos disponibles en Flex",
  },
  quote: {
    buttonLabel: "Presupuesto",
    dropdownTitle: "Elegir presupuesto de Flex para imprimir",
    errorTitle: "No se pudo imprimir el presupuesto",
    fallbackError: "No se pudo obtener el presupuesto de Flex.",
    loadingLabel: "Generando presupuesto",
    successDescription: (label) => `Se ha abierto ${label}.`,
    successTitle: "Presupuesto generado",
    unavailableTitle: "No hay presupuestos disponibles en Flex",
  },
};

const ReportAvailabilityLight = ({ available }: { available: boolean }) => (
  <span
    aria-hidden="true"
    className={[
      "h-2.5 w-2.5 shrink-0 rounded-full border ring-2",
      available
        ? "border-emerald-500 bg-emerald-400 ring-emerald-400/25"
        : "border-slate-300 bg-slate-300 ring-slate-300/20",
    ].join(" ")}
  />
);

export const PrintFlexReportAction = ({
  job,
  department,
  reportType = "material-list",
}: PrintFlexReportActionProps) => {
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [loadingElementId, setLoadingElementId] = React.useState<string | null>(null);
  const copy = REPORT_COPY[reportType];
  const mainElementId = React.useMemo(
    () => getFlexReportRootElementId(job.flex_folders),
    [job.flex_folders],
  );

  const {
    data: tree,
    isError: treeError,
    isLoading: treeLoading,
  } = useQuery({
    queryKey: queryKeys.scope("flexElementTree", mainElementId || "missing"),
    queryFn: () => getElementTree(mainElementId!),
    enabled: menuOpen && Boolean(mainElementId),
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const presupuestoOptions = React.useMemo(() => {
    const options = getFlexPresupuestoOptions(tree, job.flex_folders);
    return department
      ? options.filter((option) => option.department === department)
      : options;
  }, [department, job.flex_folders, tree]);

  const canDiscoverPresupuestos = Boolean(mainElementId);
  const hasKnownPresupuestos = presupuestoOptions.length > 0;
  const canOpenMenu = canDiscoverPresupuestos || hasKnownPresupuestos;

  const handlePrintReport = React.useCallback(async (option: FlexPresupuestoOption) => {
    if (!job.id || loadingElementId) return;

    const selectedDepartment = option.department || department || "production";
    const optionLabel = getFlexPresupuestoOptionLabel(option);
    setLoadingElementId(option.elementId);
    setMenuOpen(false);

    // Open the tab synchronously (still within the click's user-gesture window) so
    // popup blockers don't drop the navigation once the async fetch resolves later.
    const reportWindow = window.open("", "_blank");
    try {
      const result = await fetchFlexMaterialReport(
        job.id,
        selectedDepartment,
        option.elementId,
        null,
        reportType,
        {
          displayName: option.displayName,
          documentNumber: option.documentNumber,
        },
      );

      if (reportWindow) {
        reportWindow.opener = null;
        reportWindow.location.href = result.url;
      } else {
        window.open(result.url, "_blank", "noopener,noreferrer");
      }
      toast({
        title: copy.successTitle,
        description: copy.successDescription(optionLabel),
      });
    } catch (error: unknown) {
      reportWindow?.close();
      toast({
        title: copy.errorTitle,
        description: error instanceof Error ? error.message : copy.fallbackError,
        variant: "destructive",
      });
    } finally {
      setLoadingElementId(null);
    }
  }, [copy, department, job.id, loadingElementId, reportType, toast]);

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={Boolean(loadingElementId) || !canOpenMenu}
          title={canOpenMenu ? copy.dropdownTitle : copy.unavailableTitle}
        >
          <ReportAvailabilityLight available={hasKnownPresupuestos} />
          {loadingElementId ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Printer className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {loadingElementId ? copy.loadingLabel : copy.buttonLabel}
          </span>
          {!loadingElementId && <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(event) => event.stopPropagation()}>
        {treeLoading && (
          <DropdownMenuItem disabled className="gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Buscando presupuestos en Flex…
          </DropdownMenuItem>
        )}
        {!treeLoading && presupuestoOptions.map((option) => (
          <DropdownMenuItem
            key={option.elementId}
            className="gap-2"
            onSelect={(event) => {
              event.preventDefault();
              void handlePrintReport(option);
            }}
          >
            <ReportAvailabilityLight available />
            <span>{getFlexPresupuestoOptionLabel(option)}</span>
          </DropdownMenuItem>
        ))}
        {!treeLoading && presupuestoOptions.length === 0 && (
          <DropdownMenuItem disabled>
            {treeError
              ? "No se pudo consultar el árbol de Flex"
              : copy.unavailableTitle}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
