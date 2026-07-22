import React from "react";
import { ChevronDown, Loader2, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { JobCardJob } from "@/components/jobs/cards/job-card-actions/types";
import {
  getJobPresupuestoTargets,
  type JobPresupuestoTarget,
} from "@/services/flexPullsheets";
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

// Only real, printable presupuesto elements. `presupuestos_recibidos` is a
// container folder, not a presupuesto, and is intentionally excluded.
const PRESUPUESTO_FOLDER_TYPES = new Set([
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

const targetLabel = (target: JobPresupuestoTarget) =>
  target.document_number ? `${target.display_name} (${target.document_number})` : target.display_name;

export const PrintFlexReportAction = ({
  job,
  department,
  reportType = "material-list",
}: PrintFlexReportActionProps) => {
  const { toast } = useToast();
  const [loadingDepartment, setLoadingDepartment] = React.useState<PrintableDepartment | null>(null);
  const [targets, setTargets] = React.useState<JobPresupuestoTarget[] | null>(null);
  const [isLoadingTargets, setIsLoadingTargets] = React.useState(false);
  const targetsRequestedRef = React.useRef(false);
  const copy = REPORT_COPY[reportType];

  const scopedDepartmentOption = React.useMemo(
    () => MATERIAL_LIST_DEPARTMENTS.find((option) => option.department === department) ?? null,
    [department]
  );

  // Fast, synchronous availability check straight off the job card's folders --
  // drives the enabled state and the "one presupuesto vs. a chooser" decision
  // without waiting on a Flex round-trip. The full labelled list (real Flex names
  // plus presupuestos created directly in Flex) is loaded lazily when the chooser
  // opens.
  const dbCandidatesByDepartment = React.useMemo(() => {
    const map = new Map<PrintableDepartment, string[]>();
    for (const { department: optionDepartment } of MATERIAL_LIST_DEPARTMENTS) {
      const elementIds = (job.flex_folders || [])
        .filter(
          (folder) =>
            folder.department === optionDepartment &&
            typeof folder.folder_type === "string" &&
            PRESUPUESTO_FOLDER_TYPES.has(folder.folder_type) &&
            Boolean(getFolderElementId(folder))
        )
        .map((folder) => getFolderElementId(folder) as string);
      map.set(optionDepartment, elementIds);
    }
    return map;
  }, [job.flex_folders]);

  const isDepartmentAvailable = React.useCallback(
    (optionDepartment: PrintableDepartment) => (dbCandidatesByDepartment.get(optionDepartment)?.length ?? 0) > 0,
    [dbCandidatesByDepartment]
  );

  const hasAnyQuote = MATERIAL_LIST_DEPARTMENTS.some(({ department: optionDepartment }) =>
    isDepartmentAvailable(optionDepartment)
  );

  const ensureTargetsLoaded = React.useCallback(async () => {
    if (targetsRequestedRef.current || !job.id) return;
    targetsRequestedRef.current = true;
    setIsLoadingTargets(true);
    try {
      setTargets(await getJobPresupuestoTargets(job.id));
    } catch (error) {
      console.error("Failed to load Flex presupuesto targets:", error);
      // Fall back to the folders we already know about so the chooser still works.
      const fallback: JobPresupuestoTarget[] = [];
      for (const { department: optionDepartment, label } of MATERIAL_LIST_DEPARTMENTS) {
        (dbCandidatesByDepartment.get(optionDepartment) ?? []).forEach((elementId, index, all) => {
          fallback.push({
            element_id: elementId,
            department: optionDepartment,
            display_name: all.length > 1 ? `Presupuesto ${label} ${index + 1}` : `Presupuesto ${label}`,
            source: "database",
          });
        });
      }
      setTargets(fallback);
    } finally {
      setIsLoadingTargets(false);
    }
  }, [dbCandidatesByDepartment, job.id]);

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (open) void ensureTargetsLoaded();
    },
    [ensureTargetsLoaded]
  );

  const handlePrintReport = React.useCallback(
    async (printDepartment: PrintableDepartment, label: string, overrideElementId?: string) => {
      if (!job.id || loadingDepartment) return;

      setLoadingDepartment(printDepartment);
      // Open the tab synchronously (still within the click's user-gesture window) so
      // popup blockers don't drop the navigation once the async fetch resolves later.
      const reportWindow = window.open("", "_blank");
      try {
        const result = await fetchFlexMaterialReport(
          job.id,
          printDepartment,
          overrideElementId,
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
    },
    [copy, job.id, loadingDepartment, reportType, toast]
  );

  const loadingLabel = MATERIAL_LIST_DEPARTMENTS.find(
    (option) => option.department === loadingDepartment
  )?.label;

  const loadingTargetsItem = isLoadingTargets ? (
    <DropdownMenuItem disabled className="gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      Cargando presupuestos…
    </DropdownMenuItem>
  ) : null;

  if (scopedDepartmentOption) {
    const dbCandidates = dbCandidatesByDepartment.get(scopedDepartmentOption.department) ?? [];
    const isAvailable = dbCandidates.length > 0;

    // Zero or one persisted presupuesto keeps the one-click print button; two or
    // more turn it into a chooser (loaded from the Flex tree so extras and their
    // real names show up).
    if (dbCandidates.length <= 1) {
      return (
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={!!loadingDepartment || !isAvailable}
          onClick={() =>
            void handlePrintReport(
              scopedDepartmentOption.department,
              scopedDepartmentOption.label,
              dbCandidates[0]
            )
          }
          title={
            isAvailable
              ? copy.scopedTitle(scopedDepartmentOption.label)
              : copy.unavailableScopedTitle(scopedDepartmentOption.label)
          }
        >
          <ReportAvailabilityLight available={isAvailable} />
          {loadingDepartment ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Printer className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">{copy.buttonLabel}</span>
        </Button>
      );
    }

    // A scoped chooser shows this department's presupuestos plus any Flex-only ones
    // whose department couldn't be determined from the tree.
    const scopedTargets = (targets ?? []).filter(
      (target) => target.department === scopedDepartmentOption.department || target.department === null
    );

    return (
      <DropdownMenu onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!!loadingDepartment}
            title={copy.scopedTitle(scopedDepartmentOption.label)}
          >
            <ReportAvailabilityLight available />
            {loadingDepartment ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">{copy.buttonLabel}</span>
            {!loadingDepartment && <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" onClick={(event) => event.stopPropagation()}>
          {loadingTargetsItem}
          {scopedTargets.map((target) => (
            <DropdownMenuItem
              key={target.element_id}
              className="gap-2"
              onSelect={(event) => {
                event.preventDefault();
                void handlePrintReport(
                  scopedDepartmentOption.department,
                  scopedDepartmentOption.label,
                  target.element_id
                );
              }}
            >
              <ReportAvailabilityLight available />
              {targetLabel(target)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={!!loadingDepartment || !hasAnyQuote}
          title={hasAnyQuote ? copy.dropdownTitle : copy.unavailableDropdownTitle}
        >
          <ReportAvailabilityLight available={hasAnyQuote} />
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
        {loadingTargetsItem}
        {MATERIAL_LIST_DEPARTMENTS.map(({ department: optionDepartment, label }, index) => {
          const departmentTargets = (targets ?? []).filter(
            (target) => target.department === optionDepartment
          );
          const hasItems = departmentTargets.length > 0;
          // Available if the job card knows of a persisted presupuesto or the Flex
          // tree surfaced one for this department.
          const available = isDepartmentAvailable(optionDepartment) || hasItems;

          return (
            <React.Fragment key={optionDepartment}>
              {index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="flex items-center gap-2 text-xs">
                <ReportAvailabilityLight available={available} />
                {label}
              </DropdownMenuLabel>
              {/* DB says available but the labelled list hasn't resolved a specific
                  element yet -- let the server resolve the department's presupuesto. */}
              {available && !hasItems && !isLoadingTargets && (
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={(event) => {
                    event.preventDefault();
                    void handlePrintReport(optionDepartment, label);
                  }}
                >
                  <ReportAvailabilityLight available />
                  {`Presupuesto ${label}`}
                </DropdownMenuItem>
              )}
              {departmentTargets.map((target) => (
                <DropdownMenuItem
                  key={target.element_id}
                  className="gap-2"
                  onSelect={(event) => {
                    event.preventDefault();
                    void handlePrintReport(optionDepartment, label, target.element_id);
                  }}
                >
                  <ReportAvailabilityLight available />
                  {targetLabel(target)}
                </DropdownMenuItem>
              ))}
              {!available && !isLoadingTargets && (
                <DropdownMenuItem disabled className="gap-2">
                  <ReportAvailabilityLight available={false} />
                  {`Sin presupuesto de ${label}`}
                </DropdownMenuItem>
              )}
            </React.Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
