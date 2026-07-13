import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ProductionWhatsappState } from "@/components/jobs/cards/job-card-actions/useProductionWhatsapp";

type ProductionWhatsappDialogProps = {
  state: ProductionWhatsappState;
};

export const ProductionWhatsappDialog = ({ state }: ProductionWhatsappDialogProps) => {
  if (!state.waProdOpen) return null;

  return (
    <ResponsiveDialog open={state.waProdOpen} onOpenChange={state.handleProductionDialogOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[640px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Enviar WhatsApp</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Mensaje pre-rellenado (editable). La <b>hora de citación</b> se sugiere desde el inicio del trabajo y está marcada como <b>REVISAR</b>.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Grupo de fechas</Label>
              <RadioGroup
                value={state.waProdDateGroup}
                onValueChange={(value) => {
                  state.setWaProdDateGroup(value);
                  state.setWaProdRecipientIds([]);
                }}
                className="gap-2"
              >
                {state.waProdGroups.map((group) => (
                  <div key={group.key} className="flex items-center space-x-2">
                    <RadioGroupItem value={group.key} id={`wa-date-${group.key}`} />
                    <Label htmlFor={`wa-date-${group.key}`} className="font-normal">{group.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wa-calltime">Hora de citación (REVISAR)</Label>
              <Input
                id="wa-calltime"
                value={state.waProdCallTime}
                onChange={(e) => state.setWaProdCallTime(e.target.value)}
                placeholder="HH:mm"
                inputMode="numeric"
              />
              <p className="text-xs text-muted-foreground">Sugerida desde el inicio del trabajo. Ajusta si es necesario.</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Destinatarios (asignados)</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const ids = Array.from(new Set(
                      state.waProdAssignments
                        .filter((assignment) => state.assignmentMatchesWaGroup(assignment, state.waProdDateGroup))
                        .map((assignment) => assignment.technician_id)
                    ));
                    state.setWaProdRecipientIds(ids);
                  }}
                  disabled={state.waProdAssignmentsLoading}
                >
                  Seleccionar todos
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => state.setWaProdRecipientIds([])}
                >
                  Limpiar
                </Button>
              </div>
            </div>

            <div className="border rounded-md p-2 max-h-[220px] overflow-y-auto space-y-2">
              <div className="text-xs text-muted-foreground px-2">
                Nota: el teléfono puede no ser visible aquí por permisos; el envío valida teléfonos en servidor.
              </div>
              {state.waProdAssignmentsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando asignaciones…
                </div>
              ) : (
                state.waProdAssignments
                  .filter((assignment) => state.assignmentMatchesWaGroup(assignment, state.waProdDateGroup))
                  .map((assignment) => {
                    const full = `${assignment.profile?.first_name ?? ""} ${assignment.profile?.last_name ?? ""}`.trim() || "Sin nombre";
                    const hasPhone = Boolean((assignment.profile?.phone || "").trim());
                    const checked = state.waProdRecipientIds.includes(assignment.technician_id);
                    return (
                      <div key={`${assignment.technician_id}-${assignment.id}`} className={cn("flex items-start gap-2 p-2 rounded")}>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) => {
                            const isChecked = Boolean(next);
                            state.setWaProdRecipientIds((prev) => {
                              if (isChecked) return Array.from(new Set([...prev, assignment.technician_id]));
                              return prev.filter((id) => id !== assignment.technician_id);
                            });
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate" title={full}>{full}</div>
                          <div className="text-xs text-muted-foreground">
                            {hasPhone ? assignment.profile?.phone : "Teléfono no disponible (se intentará enviar igualmente)"}
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}

              {!state.waProdAssignmentsLoading && state.waProdAssignments.filter((assignment) => state.assignmentMatchesWaGroup(assignment, state.waProdDateGroup)).length === 0 && (
                <div className="text-sm text-muted-foreground p-2">No hay asignados en este grupo de fechas.</div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Mensaje</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  state.setWaProdDirty(false);
                  state.setWaProdMessage(state.buildWaProdTemplate({ groupKey: state.waProdDateGroup || "all", callTime: state.waProdCallTime }));
                }}
              >
                Restablecer
              </Button>
            </div>
            <Textarea
              value={state.waProdMessage}
              onChange={(e) => {
                state.setWaProdDirty(true);
                state.setWaProdMessage(e.target.value);
              }}
              className="min-h-[140px]"
            />
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="wa-attach-hoja-de-ruta"
              checked={state.waProdAttachHojaDeRuta}
              onCheckedChange={(next) => state.setWaProdAttachHojaDeRuta(Boolean(next))}
              disabled={state.waProdHojaDeRutaLoading || !state.waProdHojaDeRutaDoc}
            />
            <div className="space-y-1">
              <Label
                htmlFor="wa-attach-hoja-de-ruta"
                className={cn("font-normal", !state.waProdHojaDeRutaLoading && !state.waProdHojaDeRutaDoc && "text-muted-foreground")}
              >
                Enviar Hoja de Ruta (PDF) como seguimiento
              </Label>
              <p className="text-xs text-muted-foreground">
                {state.waProdHojaDeRutaLoading
                  ? "Comprobando si hay Hoja de Ruta disponible…"
                  : state.waProdHojaDeRutaDoc
                    ? `Se enviará "${state.waProdHojaDeRutaDoc.file_name || "Hoja de Ruta.pdf"}" tras el mensaje de citación (como PDF adjunto o enlace de descarga).`
                    : "No hay Hoja de Ruta generada para este trabajo."}
              </p>
            </div>
          </div>
        </div>

        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => state.setWaProdOpen(false)} disabled={state.waProdSending}>Cancelar</Button>
          <Button
            onClick={state.handleWaProdSend}
            disabled={state.waProdSending}
          >
            {state.waProdSending ? "Enviando…" : "Enviar"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
};
