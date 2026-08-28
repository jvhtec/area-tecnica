import { useMemo, useState, type MouseEventHandler } from "react";
import { Boxes, Loader2, Minus, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import {
  ESTRUCTURA_MOTOR_MODELS,
  ESTRUCTURA_PULL_SHEETS,
  ESTRUCTURA_SOURCE_DEPARTMENTS,
  type EstructuraSourceDepartment,
} from "@/domain/estructura";
import {
  pushEstructuraMotorQuantities,
  resolveEstructuraPullSheetTargets,
  type EstructuraMotorPushResult,
} from "@/services/estructuraMotorPreparation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type QuantityState = Record<EstructuraSourceDepartment, Record<string, number>>;

const emptyQuantities = (): QuantityState => ({
  sound: Object.fromEntries(ESTRUCTURA_MOTOR_MODELS.map((model) => [model.id, 0])),
  lights: Object.fromEntries(ESTRUCTURA_MOTOR_MODELS.map((model) => [model.id, 0])),
});

const sourceLabel = (source: EstructuraSourceDepartment) =>
  ESTRUCTURA_PULL_SHEETS[source].label;

export function PrepareMotorsAction({
  jobId,
  onCreateFlexFolders,
}: {
  jobId: string;
  onCreateFlexFolders?: MouseEventHandler<HTMLButtonElement>;
}) {
  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState<QuantityState>(emptyQuantities);
  const [isPushing, setIsPushing] = useState(false);
  const [pushResult, setPushResult] = useState<EstructuraMotorPushResult | null>(null);
  const targetsQuery = useQuery({
    queryKey: ["estructura-pull-sheet-targets", jobId],
    queryFn: () => resolveEstructuraPullSheetTargets(jobId),
    enabled: open,
    staleTime: 0,
  });

  const totals = useMemo(() => {
    const bySource = Object.fromEntries(
      ESTRUCTURA_SOURCE_DEPARTMENTS.map((source) => [
        source,
        Object.values(quantities[source]).reduce((total, quantity) => total + quantity, 0),
      ]),
    ) as Record<EstructuraSourceDepartment, number>;
    return { bySource, total: bySource.sound + bySource.lights };
  }, [quantities]);

  const updateQuantity = (
    source: EstructuraSourceDepartment,
    modelId: string,
    value: number,
  ) => {
    const normalized = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
    setQuantities((current) => ({
      ...current,
      [source]: { ...current[source], [modelId]: normalized },
    }));
    setPushResult(null);
  };

  const handlePush = async () => {
    if (totals.total === 0 || isPushing) return;
    setIsPushing(true);
    setPushResult(null);
    try {
      const selections: Parameters<typeof pushEstructuraMotorQuantities>[1] = {
        sound: ESTRUCTURA_MOTOR_MODELS.map((model) => ({
          modelId: model.id,
          modelName: model.name,
          quantity: quantities.sound[model.id] ?? 0,
        })),
        lights: ESTRUCTURA_MOTOR_MODELS.map((model) => ({
            modelId: model.id,
            modelName: model.name,
          quantity: quantities.lights[model.id] ?? 0,
        })),
      };
      const result = await pushEstructuraMotorQuantities(jobId, selections);
      setPushResult(result);
      await targetsQuery.refetch();
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        title="Añadir motores a los Pull Sheets de Estructura"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <Boxes className="h-4 w-4" />
        <span className="hidden sm:inline">Motores</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="flex max-h-[92vh] max-w-5xl flex-col"
          onClick={(event) => event.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>Preparar motores</DialogTitle>
            <DialogDescription>
              Indica cantidades de modelos de inventario. La asignación de números de serie se realiza después en Flex.
            </DialogDescription>
          </DialogHeader>

          {targetsQuery.isError ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {targetsQuery.error instanceof Error
                ? targetsQuery.error.message
                : "No se pudieron resolver los Pull Sheets de Estructura."}
            </p>
          ) : null}

          {targetsQuery.data?.missing.length ? (
            <div className="rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
              <p>
                Faltan los Pull Sheets de Estructura de {targetsQuery.data.missing.map(sourceLabel).join(" y ")}.
              </p>
              {onCreateFlexFolders ? (
                <Button type="button" variant="link" className="h-auto p-0" onClick={onCreateFlexFolders}>
                  Crear o reconciliar carpetas Flex
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="grid gap-4 lg:grid-cols-2">
              {ESTRUCTURA_SOURCE_DEPARTMENTS.map((source) => (
                <section key={source} className="rounded-lg border p-3" aria-label={`Motores para ${sourceLabel(source)}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold uppercase tracking-wide">{sourceLabel(source)}</h3>
                    <span className="text-sm text-muted-foreground">{totals.bySource[source]} motores</span>
                  </div>
                  <div className="space-y-2">
                    {ESTRUCTURA_MOTOR_MODELS.map((model) => {
                      const quantity = quantities[source][model.id] ?? 0;
                      return (
                        <div key={model.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md bg-muted/40 p-2">
                          <label className="text-sm leading-tight" htmlFor={`motor-${source}-${model.id}`}>
                            {model.name}
                          </label>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-9 w-9"
                              aria-label={`Restar ${model.name} de ${sourceLabel(source)}`}
                              onClick={() => updateQuantity(source, model.id, quantity - 1)}
                              disabled={quantity === 0 || isPushing}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                              id={`motor-${source}-${model.id}`}
                              type="number"
                              inputMode="numeric"
                              min={0}
                              step={1}
                              value={quantity}
                              className="h-9 w-16 px-2 text-center"
                              aria-label={`Cantidad de ${model.name} para ${sourceLabel(source)}`}
                              onChange={(event) => updateQuantity(source, model.id, Number(event.target.value))}
                              disabled={isPushing}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-9 w-9"
                              aria-label={`Sumar ${model.name} a ${sourceLabel(source)}`}
                              onClick={() => updateQuantity(source, model.id, quantity + 1)}
                              disabled={isPushing}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
            <p className="font-medium">Este envío añadirá material a los Pull Sheets existentes.</p>
            <p>El material ya presente no se modificará ni eliminará. Repetir el envío puede duplicar cantidades.</p>
          </div>

          {pushResult ? (
            <div className="grid gap-2 sm:grid-cols-2" aria-live="polite">
              {ESTRUCTURA_SOURCE_DEPARTMENTS.map((source) => (
                <p
                  key={source}
                  className={pushResult[source].status === "success"
                    ? "rounded-md border border-emerald-500/40 p-2 text-sm text-emerald-700"
                    : pushResult[source].status === "error"
                      ? "rounded-md border border-destructive/40 p-2 text-sm text-destructive"
                      : "rounded-md border p-2 text-sm text-muted-foreground"}
                >
                  <strong>{sourceLabel(source)}:</strong> {pushResult[source].message}
                </p>
              ))}
            </div>
          ) : null}

          <DialogFooter className="items-center sm:justify-between">
            <span className="text-sm text-muted-foreground">
              Sonido: {totals.bySource.sound} · Luces: {totals.bySource.lights} · Total: {totals.total}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPushing}>
                Cerrar
              </Button>
              <Button
                type="button"
                onClick={() => void handlePush()}
                disabled={totals.total === 0 || isPushing || targetsQuery.isLoading || targetsQuery.isError}
              >
                {isPushing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Añadir {totals.total} {totals.total === 1 ? "motor" : "motores"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
