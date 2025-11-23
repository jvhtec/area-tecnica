import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Loader2, Palmtree } from "lucide-react";

interface VacationRequestFormProps {
  onSubmit: (request: { startDate: string; endDate: string; reason: string }) => void;
  isSubmitting?: boolean;
}

export const VacationRequestForm: React.FC<VacationRequestFormProps> = ({ onSubmit, isSubmitting = false }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate || !endDate || !reason.trim()) {
      return;
    }

    onSubmit({ startDate, endDate, reason });

    setStartDate('');
    setEndDate('');
    setReason('');
  };

  const isFormValid = startDate && endDate && reason.trim() && new Date(startDate) <= new Date(endDate);

  return (
    <Card className="border-transparent bg-gradient-to-b from-slate-50 via-white to-slate-100 shadow-sm dark:from-slate-900 dark:via-slate-950 dark:to-slate-900/80">
      <CardHeader className="px-4 py-5 space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/60 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <Palmtree className="h-4 w-4" />
          Solicitud móvil
        </div>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <span>Nueva solicitud de vacaciones</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Elige rango de fechas y motivo para enviar a aprobación.
        </p>
      </CardHeader>
      <CardContent className="px-4 pb-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="startDate" className="text-xs uppercase tracking-wide text-muted-foreground">Fecha de inicio</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                disabled={isSubmitting}
                className="rounded-xl"
              />
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="endDate" className="text-xs uppercase tracking-wide text-muted-foreground">Fecha de fin</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                disabled={isSubmitting}
                min={startDate}
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="reason" className="text-xs uppercase tracking-wide text-muted-foreground">Motivo</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Vacaciones, asuntos personales, viaje, etc."
              required
              disabled={isSubmitting}
              rows={3}
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
              Envía con antelación para evitar conflictos con asignaciones activas.
            </div>
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-3 text-xs text-muted-foreground dark:border-slate-800 dark:bg-slate-900">
              Recibirás confirmación por correo cuando sea aprobada o rechazada.
            </div>
          </div>

          <Button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className="w-full rounded-xl text-base font-semibold"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar solicitud
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
