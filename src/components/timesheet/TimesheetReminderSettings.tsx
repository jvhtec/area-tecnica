import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, BellOff, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ReminderSettings {
  auto_reminders_enabled: boolean;
  reminder_frequency_days: number;
}

const QUERY_KEY = ["timesheet-reminder-settings"];

async function fetchSettings(): Promise<ReminderSettings> {
  const { data, error } = await supabase
    .from("timesheet_reminder_settings")
    .select("auto_reminders_enabled, reminder_frequency_days")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data as ReminderSettings;
}

async function updateSettings(patch: Partial<ReminderSettings>): Promise<void> {
  const { error } = await supabase
    .from("timesheet_reminder_settings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw error;
}

async function triggerManualBatch(): Promise<{ sent: number; failed: number }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sin sesión activa");

  const { data, error } = await supabase.functions.invoke("auto-send-timesheet-reminders", {
    body: { triggered_by: "manual" },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error ?? "Error desconocido");
  return { sent: data.sent ?? 0, failed: data.failed ?? 0 };
}

interface TimesheetReminderSettingsProps {
  className?: string;
}

export function TimesheetReminderSettings({ className }: TimesheetReminderSettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isTriggeringManual, setIsTriggeringManual] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchSettings,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (err: Error) => {
      toast({
        title: "Error al guardar ajustes",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleToggle = (checked: boolean) => {
    mutation.mutate({ auto_reminders_enabled: checked });
    toast({
      title: checked ? "Recordatorios automáticos activados" : "Recordatorios automáticos desactivados",
      description: checked
        ? "Se enviará un recordatorio diario a los técnicos con partes pendientes."
        : "No se enviarán recordatorios automáticos.",
    });
  };

  const handleFrequencyChange = (value: string) => {
    mutation.mutate({ reminder_frequency_days: parseInt(value, 10) });
    toast({
      title: "Frecuencia actualizada",
      description: `Recordatorios cada ${value} día(s).`,
    });
  };

  const handleManualTrigger = async () => {
    setIsTriggeringManual(true);
    try {
      const { sent, failed } = await triggerManualBatch();
      toast({
        title: "Envío completado",
        description: `${sent} recordatorio(s) enviado(s)${failed > 0 ? `, ${failed} fallo(s)` : ""}.`,
      });
    } catch (err: any) {
      toast({
        title: "Error al enviar recordatorios",
        description: err.message ?? "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setIsTriggeringManual(false);
    }
  };

  if (isLoading || !settings) {
    return null;
  }

  const enabled = settings.auto_reminders_enabled;
  const frequencyDays = settings.reminder_frequency_days ?? 1;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {enabled ? (
            <Bell className="h-4 w-4 text-indigo-500" />
          ) : (
            <BellOff className="h-4 w-4 text-muted-foreground" />
          )}
          Recordatorios automáticos de partes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Toggle */}
          <div className="flex items-center gap-3">
            <Switch
              id="auto-reminders-toggle"
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={mutation.isPending}
            />
            <Label htmlFor="auto-reminders-toggle" className="cursor-pointer text-sm">
              {enabled ? "Activados" : "Desactivados"}
            </Label>
          </div>

          {/* Frequency */}
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">Frecuencia:</Label>
            <Select
              value={String(frequencyDays)}
              onValueChange={handleFrequencyChange}
              disabled={!enabled || mutation.isPending}
            >
              <SelectTrigger className="w-40">
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

          {/* Manual trigger */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualTrigger}
            disabled={isTriggeringManual || mutation.isPending}
            className="flex items-center gap-2 ml-auto"
          >
            <RefreshCw className={`h-4 w-4 ${isTriggeringManual ? "animate-spin" : ""}`} />
            {isTriggeringManual ? "Enviando..." : "Enviar ahora"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          {enabled
            ? `Se envía un recordatorio por email a cada técnico con partes en borrador de trabajos ya finalizados. Frecuencia mínima entre recordatorios: ${frequencyDays} día(s). Los recordatorios se detienen automáticamente cuando el técnico envía el parte.`
            : "Los recordatorios automáticos están desactivados. Puedes enviar recordatorios individuales desde cada parte."}
        </p>
      </CardContent>
    </Card>
  );
}
