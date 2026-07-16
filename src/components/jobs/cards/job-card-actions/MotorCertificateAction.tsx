import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, ClipboardList, Loader2, Search, SlidersHorizontal, TriangleAlert } from "lucide-react";

import type { JobCardJob } from "@/components/jobs/cards/job-card-actions/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/react-query";
import {
  fetchFlexMotorUnits,
  type FlexMotorUnit,
} from "@/services/flexMotorUnits";
import {
  generateMotorInspectionCertificates,
  MOTOR_CERTIFICATE_SOURCE,
} from "@/utils/pdf/motorInspectionCertificates";

type MotorCertificateActionProps = {
  job: JobCardJob;
};

type SelectionMode = "manifest" | "manual";

const formatCertificateDate = (isoDate: string): string => {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
};

const getJobName = (job: JobCardJob): string =>
  job.job_name || job.name || job.title || "Trabajo";

const normalizeSearch = (value: string): string =>
  value.trim().toLocaleLowerCase("es");

export const MotorCertificateAction = ({ job }: MotorCertificateActionProps) => {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [selectionMode, setSelectionMode] = React.useState<SelectionMode>("manifest");
  const [search, setSearch] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [isGenerating, setIsGenerating] = React.useState(false);
  const selectionInitialized = React.useRef(false);

  const query = useQuery({
    queryKey: queryKeys.scope("flex-motor-units", job.id),
    queryFn: () => fetchFlexMotorUnits(job.id),
    enabled: open,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const units = React.useMemo(() => query.data?.units ?? [], [query.data?.units]);
  const manifest = query.data?.manifest;
  const manifestUnitIds = React.useMemo(
    () => new Set(manifest?.unitIds ?? []),
    [manifest?.unitIds],
  );
  const manifestUnits = React.useMemo(
    () => units.filter((unit) => manifestUnitIds.has(unit.id)),
    [manifestUnitIds, units],
  );
  const availableUnits = selectionMode === "manifest" ? manifestUnits : units;
  const filteredUnits = React.useMemo(() => {
    const term = normalizeSearch(search);
    if (!term) return availableUnits;

    return availableUnits.filter((unit) => [
      unit.serial,
      unit.barcode,
      unit.stencil,
      unit.modelNumber,
      unit.modelName,
      unit.currentLocation,
    ].some((value) => value?.toLocaleLowerCase("es").includes(term)));
  }, [availableUnits, search]);

  React.useEffect(() => {
    if (!open || !query.data || selectionInitialized.current) return;
    setSelectedIds(new Set(query.data.manifest.unitIds));
    selectionInitialized.current = true;
  }, [open, query.data]);

  const groupedUnits = React.useMemo(() => {
    const groups = new Map<string, FlexMotorUnit[]>();
    filteredUnits.forEach((unit) => {
      const existing = groups.get(unit.modelName) ?? [];
      existing.push(unit);
      groups.set(unit.modelName, existing);
    });
    return Array.from(groups.entries());
  }, [filteredUnits]);

  const selectedUnits = React.useMemo(
    () => units.filter((unit) => selectedIds.has(unit.id)),
    [selectedIds, units],
  );
  const visibleSelectedCount = filteredUnits.filter((unit) => selectedIds.has(unit.id)).length;
  const allVisibleSelected = filteredUnits.length > 0 && visibleSelectedCount === filteredUnits.length;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen && !isGenerating) {
      setSearch("");
      setSelectedIds(new Set());
      setSelectionMode("manifest");
      selectionInitialized.current = false;
    }
  };

  const handleSelectionModeChange = (value: string) => {
    const nextMode = value === "manual" ? "manual" : "manifest";
    setSelectionMode(nextMode);
    setSearch("");
    if (nextMode === "manifest") {
      setSelectedIds(new Set(manifest?.unitIds ?? []));
    }
  };

  const toggleUnit = (unitId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  const toggleVisibleUnits = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) filteredUnits.forEach((unit) => next.delete(unit.id));
      else filteredUnits.forEach((unit) => next.add(unit.id));
      return next;
    });
  };

  const handleGenerate = async () => {
    if (selectedUnits.length === 0 || isGenerating) return;

    setIsGenerating(true);

    try {
      const result = await generateMotorInspectionCertificates({
        units: selectedUnits,
        jobName: getJobName(job),
      });
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      globalThis.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast({
        title: selectedUnits.length === 1 ? "Certificado descargado" : "Certificados descargados",
        description: `${selectedUnits.length} ${selectedUnits.length === 1 ? "motor preparado" : "motores preparados"} en PDF para imprimir.`,
      });
      setOpen(false);
      setSearch("");
      setSelectedIds(new Set());
      setSelectionMode("manifest");
      selectionInitialized.current = false;
    } catch (error) {
      toast({
        title: "No se pudieron generar los certificados",
        description: error instanceof Error ? error.message : "Se produjo un error inesperado.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedLabel = selectedUnits.length === 1
    ? "1 motor seleccionado"
    : `${selectedUnits.length} motores seleccionados`;
  const generateLabel = selectedUnits.length === 1
    ? "Generar 1 certificado"
    : `Generar ${selectedUnits.length} certificados`;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        title="Generar certificados individuales de motores"
        aria-label="Certificados de motores"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <BadgeCheck className="h-4 w-4" />
        <span className="hidden sm:inline">Cert. motores</span>
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col" onClick={(event) => event.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Certificados de motores</DialogTitle>
            <DialogDescription>
              Los motores escaneados en el manifiesto del trabajo se seleccionan automáticamente. También puedes añadir o elegir números de serie manualmente.
            </DialogDescription>
          </DialogHeader>

          <Alert className="py-3">
            <BadgeCheck className="h-4 w-4" />
            <AlertTitle>Certificado maestro vigente</AlertTitle>
            <AlertDescription>
              Revisión: {formatCertificateDate(MOTOR_CERTIFICATE_SOURCE.inspectionDate)} · Próxima revisión anual: {formatCertificateDate(MOTOR_CERTIFICATE_SOURCE.nextAnnualInspectionDate)} · {MOTOR_CERTIFICATE_SOURCE.inspectionProvider}
            </AlertDescription>
          </Alert>

          <Tabs value={selectionMode} onValueChange={handleSelectionModeChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manifest" className="gap-2">
                <ClipboardList className="h-4 w-4" /> Desde el manifiesto
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-2">
                <SlidersHorizontal className="h-4 w-4" /> Selección manual
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {query.data?.modelErrors.length ? (
            <Alert variant="destructive" className="py-3">
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>Algunos modelos no se han podido cargar</AlertTitle>
              <AlertDescription>
                {query.data.modelErrors.map((model) => model.modelName).join(", ")}
              </AlertDescription>
            </Alert>
          ) : null}

          {!query.isLoading && !query.isError && selectionMode === "manifest" && manifest ? (
            <Alert variant={manifest.status === "error" ? "destructive" : "default"} className="py-3">
              {manifest.status === "found"
                ? <BadgeCheck className="h-4 w-4" />
                : <TriangleAlert className="h-4 w-4" />}
              <AlertTitle>
                {manifest.status === "found"
                  ? `${manifestUnits.length} ${manifestUnits.length === 1 ? "motor escaneado" : "motores escaneados"}`
                  : "Sin motores seleccionados desde Flex"}
              </AlertTitle>
              <AlertDescription className="space-y-1">
                <p>{manifest.message}</p>
                {manifest.sources.length > 0 ? (
                  <p>
                    {manifest.sources.length === 1 ? "Manifiesto consultado" : "Manifiestos consultados"}: {manifest.sources.map((source) => source.equipmentListName).join(", ")}.
                  </p>
                ) : null}
                {manifest.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                {manifest.status !== "found" ? (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0"
                    onClick={() => handleSelectionModeChange("manual")}
                  >
                    Usar selección manual
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          {selectionMode === "manual" ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por número de serie, código Flex o modelo…"
                className="pl-9"
                aria-label="Buscar motores"
              />
            </div>
          ) : null}

          {query.isLoading ? (
            <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Leyendo manifiestos y motores desde Flex…
            </div>
          ) : query.isError ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
              <TriangleAlert className="h-8 w-8 text-destructive" />
              <p className="text-sm text-destructive">
                {query.error instanceof Error ? query.error.message : "No se pudieron cargar los motores de Flex."}
              </p>
              <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
                Reintentar
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b pb-2 text-sm">
                <label className="flex cursor-pointer items-center gap-2 font-medium">
                  <Checkbox
                    checked={
                      allVisibleSelected
                        ? true
                        : visibleSelectedCount > 0
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={toggleVisibleUnits}
                    disabled={filteredUnits.length === 0}
                    aria-label="Seleccionar todos los motores visibles"
                  />
                  Seleccionar visibles
                </label>
                <span className="text-muted-foreground">
                  {filteredUnits.length} de {availableUnits.length}
                </span>
              </div>

              <ScrollArea className="min-h-0 flex-1 pr-3 sm:h-[46vh]">
                {groupedUnits.length === 0 ? (
                  <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
                    {selectionMode === "manifest"
                      ? "El manifiesto no contiene motores certificados. Usa la selección manual para buscar una excepción."
                      : "No hay motores que coincidan con la búsqueda."}
                  </div>
                ) : (
                  <div className="space-y-5 py-2">
                    {groupedUnits.map(([modelName, modelUnits]) => (
                      <section key={modelName} className="space-y-2">
                        <div className="sticky top-0 z-10 flex items-center justify-between bg-background py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <span>{modelName}</span>
                          <span>{modelUnits.length}</span>
                        </div>
                        <div className="divide-y rounded-md border">
                          {modelUnits.map((unit) => (
                            <label
                              key={unit.id}
                              htmlFor={`motor-certificate-${unit.id}`}
                              className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50"
                            >
                              <Checkbox
                                id={`motor-certificate-${unit.id}`}
                                checked={selectedIds.has(unit.id)}
                                onCheckedChange={() => toggleUnit(unit.id)}
                                aria-label={`Seleccionar motor ${unit.serial}`}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block font-mono text-sm font-semibold">{unit.serial}</span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {[unit.barcode && `Flex ${unit.barcode}`, unit.currentLocation]
                                    .filter(Boolean)
                                    .join(" · ") || "Sin datos adicionales"}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </>
          )}

          <DialogFooter className="items-center sm:justify-between">
            <span className="text-sm text-muted-foreground">{selectedLabel}</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isGenerating}>
                Cancelar
              </Button>
              <Button onClick={() => void handleGenerate()} disabled={selectedUnits.length === 0 || isGenerating}>
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {generateLabel}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
