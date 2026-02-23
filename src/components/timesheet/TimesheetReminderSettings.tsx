import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { createQueryKey } from "@/lib/optimized-react-query";

// ─── Types ────────────────────────────────────────────────────────────────────

const DEPARTMENTS = [
  { key: "sound",          label: "Sonido" },
  { key: "lights",         label: "Iluminación" },
  { key: "video",          label: "Vídeo" },
  { key: "logistics",      label: "Logística" },
  { key: "production",     label: "Producción" },
  { key: "administrative", label: "Administración" },
] as const;

type DepartmentKey = (typeof DEPARTMENTS)[number]["key"];

interface DeptSetting {
  department: DepartmentKey;
  auto_reminders_enabled: boolean;
  reminder_frequency_days: number;
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

async function fetchSettings(): Promise<DeptSetting[]> {
  const { data, error } = await supabase
    .from("timesheet_reminder_settings")
    .select("department, auto_reminders_enabled, reminder_frequency_days");
  if (error) throw error;
  return (data ?? []) as DeptSetting[];
}

async function updateDeptSetting(patch: Partial<DeptSetting> & { department: DepartmentKey }): Promise<void> {
  // Use upsert so the call is idempotent: inserts when the row is missing
  // (e.g. a new department added after the seed) and updates otherwise.
  const { error } = await supabase
    .from("timesheet_reminder_settings")
    .upsert({ ...patch, updated_at: new Date().toISOString() }, { onConflict: "department" });
  if (error) throw error;
}

async function triggerManualBatch(): Promise<{ sent: number; failed: number; skipped_dept: number }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sin sesión activa");
  const { data, error } = await supabase.functions.invoke("auto-send-timesheet-reminders", {
    body: { triggered_by: "manual" },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error ?? "Error desconocido");
  return { sent: data.sent ?? 0, failed: data.failed ?? 0, skipped_dept: data.skipped_dept ?? 0 };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TimesheetReminderSettings({ className }: { className?: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isTriggeringManual, setIsTriggeringManual] = useState(false);

  const QUERY_KEY = createQueryKey.timesheetReminderSettings.all;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchSettings,
    staleTime: 30_000,
  });

  // onSuccess invalidates after each individual mutation; no global onError so
  // callers can own their own toasts without risk of double-firing.
  const mutation = useMutation({
    mutationFn: updateDeptSetting,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  // Build a quick lookup from the fetched rows
  const settingsMap = new Map(rows.map((r) => [r.department, r]));

  const ENABLED_BY_DEFAULT = new Set<DepartmentKey>(["sound", "lights"]);
  const getDept = (key: DepartmentKey): DeptSetting =>
    settingsMap.get(key) ?? {
      department: key,
      auto_reminders_enabled: ENABLED_BY_DEFAULT.has(key),
      reminder_frequency_days: 1,
    };

  const handleToggle = async (department: DepartmentKey, checked: boolean) => {
    try {
      await mutation.mutateAsync({ department, auto_reminders_enabled: checked });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Error al guardar", description: msg, variant: "destructive" });
    }
  };

  const handleFrequency = async (department: DepartmentKey, value: string) => {
    try {
      await mutation.mutateAsync({ department, reminder_frequency_days: parseInt(value, 10) });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Error al guardar", description: msg, variant: "destructive" });
    }
  };

  const handleEnableAll = async (enabled: boolean) => {
    try {
      await Promise.all(
        DEPARTMENTS.map(({ key }) =>
          mutation.mutateAsync({ department: key, auto_reminders_enabled: enabled })
        )
      );
      toast({
        title: enabled ? "Todos los departamentos activados" : "Todos los departamentos desactivados",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Error al actualizar departamentos", description: msg, variant: "destructive" });
    }
  };

  const handleManualTrigger = async () => {
    setIsTriggeringManual(true);
    try {
      const { sent, failed } = await triggerManualBatch();
      toast({
        title: "Envío completado",
        description: `${sent} recordatorio(s) enviado(s)${failed > 0 ? `, ${failed} fallo(s)` : ""}.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Error al enviar recordatorios", description: msg, variant: "destructive" });
    } finally {
      setIsTriggeringManual(false);
    }
  };

  if (isLoading) return null;

  const allEnabled = DEPARTMENTS.every((d) => getDept(d.key).auto_reminders_enabled);
  const anyEnabled = DEPARTMENTS.some((d) => getDept(d.key).auto_reminders_enabled);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-indigo-500" />
            Recordatorios automáticos de partes
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => handleEnableAll(!allEnabled)}
              disabled={mutation.isPending}
            >
              {allEnabled ? "Desactivar todos" : "Activar todos"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualTrigger}
              disabled={isTriggeringManual || mutation.isPending || !anyEnabled}
              className="flex items-center gap-1.5 h-7 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isTriggeringManual ? "animate-spin" : ""}`} />
              {isTriggeringManual ? "Enviando..." : "Enviar ahora"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="divide-y">
          {DEPARTMENTS.map(({ key, label }) => {
            const s = getDept(key);
            return (
              <div key={key} className="flex items-center gap-4 py-2.5 first:pt-0 last:pb-0">
                {/* Department name */}
                <span className="w-32 text-sm font-medium shrink-0">{label}</span>

                {/* Toggle */}
                <Switch
                  id={`toggle-${key}`}
                  checked={s.auto_reminders_enabled}
                  onCheckedChange={(checked) => handleToggle(key, checked)}
                  disabled={mutation.isPending}
                />
                <label htmlFor={`toggle-${key}`} className="text-sm text-muted-foreground cursor-pointer w-20 shrink-0">
                  {s.auto_reminders_enabled ? "Activado" : "Desactivado"}
                </label>

                {/* Frequency */}
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-muted-foreground hidden sm:inline">Frecuencia:</span>
                  <Select
                    value={String(s.reminder_frequency_days)}
                    onValueChange={(v) => handleFrequency(key, v)}
                    disabled={!s.auto_reminders_enabled || mutation.isPending}
                  >
                    <SelectTrigger className="w-36 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Cada día</SelectItem>
                      <SelectItem value="2">Cada 2 días</SelectItem>
                      <SelectItem value="3">Cada 3 días</SelectItem>
                      <SelectItem value="7">Cada semana</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
          Se envía un recordatorio diario por email a cada técnico con partes en borrador de trabajos ya finalizados.
          Los recordatorios se detienen automáticamente cuando el técnico envía el parte.
          Ejecutado diariamente a las 10:00 UTC.
        </p>
      </CardContent>
    </Card>
  );
}
