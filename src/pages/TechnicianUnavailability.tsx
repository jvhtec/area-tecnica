import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function TechnicianUnavailability() {
  const { user } = useOptimizedAuth();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [allDay, setAllDay] = React.useState(true);
  const [start, setStart] = React.useState<string>('');
  const [end, setEnd] = React.useState<string>('');
  const [fieldErrors, setFieldErrors] = React.useState<{ start?: string; end?: string }>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const isMobile = useIsMobile();

  React.useEffect(() => {
    if (!open) {
      setFieldErrors({});
      setFormError(null);
      setStart('');
      setEnd('');
      setAllDay(true);
    }
  }, [open]);

  const normalizeToDate = React.useCallback((value: string) => {
    if (!value) return '';
    if (value.includes('T')) {
      return value.slice(0, 10);
    }
    return value;
  }, []);

  const handleSubmit = React.useCallback(() => {
    const nextErrors: { start?: string; end?: string } = {};
    const normalizedStart = normalizeToDate(start);
    const normalizedEnd = normalizeToDate(end);

    if (!start) {
      nextErrors.start = 'La fecha de inicio es obligatoria.';
    } else if (normalizedStart.length !== 10 || Number.isNaN(new Date(`${normalizedStart}T00:00:00`).getTime())) {
      nextErrors.start = 'Introduce una fecha de inicio válida.';
    }

    if (!end) {
      nextErrors.end = 'La fecha de fin es obligatoria.';
    } else if (normalizedEnd.length !== 10 || Number.isNaN(new Date(`${normalizedEnd}T00:00:00`).getTime())) {
      nextErrors.end = 'Introduce una fecha de fin válida.';
    }

    if (!nextErrors.start && !nextErrors.end) {
      const startDate = new Date(`${normalizedStart}T00:00:00`);
      const endDate = new Date(`${normalizedEnd}T00:00:00`);
      if (startDate > endDate) {
        nextErrors.end = 'La fecha de fin debe ser igual o posterior a la de inicio.';
      }
    }

    if (nextErrors.start || nextErrors.end) {
      setFieldErrors(nextErrors);
      setFormError('Revisa los campos marcados antes de continuar.');
      return;
    }

    setFieldErrors({});
    setFormError(null);
    createMutation.mutate({ startDate: normalizedStart, endDate: normalizedEnd, status: 'day_off' });
  }, [createMutation, end, normalizeToDate, start]);
  // Reasonless flow; defaults to day_off in DB

  const statusLabels: Record<string, string> = {
    vacation: 'Vacaciones',
    travel: 'Viaje',
    sick: 'Baja médica',
    day_off: 'Día libre',
  };

  const { data: blocks = [], isLoading } = useQuery({
    queryKey: ['my-unavailability', user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as any[];
      const { data, error } = await supabase
        .from('technician_availability')
        .select('id, technician_id, date, status, created_at, updated_at')
        .eq('technician_id', user.id)
        .order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { startDate: string; endDate: string; status: 'vacation'|'travel'|'sick'|'day_off' }) => {
      if (!user?.id) return;
      // Build per-day rows inclusive
      const rows: Array<{ technician_id: string; date: string; status: string }> = [];
      const s = new Date(payload.startDate + 'T00:00');
      const e = new Date(payload.endDate + 'T00:00');
      if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) throw new Error('Invalid date range');
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        rows.push({ technician_id: user.id, date: d.toISOString().slice(0,10), status: payload.status });
      }
      const { error } = await supabase
        .from('technician_availability')
        .upsert(rows, { onConflict: 'technician_id,date' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Bloqueo de disponibilidad creado');
      qc.invalidateQueries({ queryKey: ['my-unavailability'] });
      setOpen(false);
      setStart('');
      setEnd('');
      setAllDay(true);
      setFieldErrors({});
      setFormError(null);
    },
    onError: (e: any) => {
      const message = e?.message || 'No se pudo crear el bloqueo';
      setFormError(message);
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('technician_availability').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Bloqueo eliminado');
      qc.invalidateQueries({ queryKey: ['my-unavailability'] });
    },
    onError: (e: any) => toast.error(e?.message || 'No se pudo eliminar el bloqueo'),
  });

  return (
    <div className="relative mx-auto max-w-3xl p-4 pb-24 md:pb-6">
      <div className="mb-6 flex flex-col gap-y-2 md:mb-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Mis bloqueos de disponibilidad</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona y revisa los días en los que no estarás disponible para asignaciones.
          </p>
        </div>
        <Button className="hidden md:inline-flex" onClick={() => setOpen(true)}>
          Añadir bloqueo
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Cargando…</div>
      ) : (
        <div className="space-y-3">
          {blocks.length === 0 && (
            <div className="text-muted-foreground">Todavía no tienes bloqueos de disponibilidad. Añade uno para evitar asignaciones durante esas fechas.</div>
          )}
          {blocks.map((b: any) => (
            <div key={b.id} className="flex items-center justify-between border rounded-md p-3">
              <div>
                <div className="font-medium">{new Date(b.date).toLocaleDateString('es-ES', { dateStyle: 'long' })}</div>
                <div className="text-sm text-muted-foreground">{statusLabels[b.status as keyof typeof statusLabels] || b.status}</div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(b.id)}>Eliminar</Button>
            </div>
          ))}
        </div>
      )}

      <div className="md:hidden">
        <div className="fixed inset-x-0 bottom-0 z-20 bg-background/95 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <Button className="w-full" onClick={() => setOpen(true)}>
            Añadir bloqueo
          </Button>
        </div>
      </div>

      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="flex h-[95vh] flex-col overflow-hidden rounded-t-3xl px-4 pb-6 pt-8 sm:h-auto"
          >
            <SheetHeader className="mb-4">
              <SheetTitle className="text-left text-xl font-semibold">
                Añadir bloqueo de disponibilidad
              </SheetTitle>
            </SheetHeader>
            <FormContent
              allDay={allDay}
              end={end}
              fieldErrors={fieldErrors}
              formError={formError}
              isPending={createMutation.isPending}
              isSubmitDisabled={createMutation.isPending || !start || !end}
              onCancel={() => setOpen(false)}
              onChangeAllDay={(value) => setAllDay(value)}
              onChangeEnd={(value) => {
                setEnd(value);
                setFieldErrors((prev) => ({ ...prev, end: undefined }));
                setFormError(null);
              }}
              onChangeStart={(value) => {
                setStart(value);
                setFieldErrors((prev) => ({ ...prev, start: undefined }));
                setFormError(null);
              }}
              onSubmit={handleSubmit}
              start={start}
            />
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader className="mb-2">
              <DialogTitle>Añadir bloqueo de disponibilidad</DialogTitle>
            </DialogHeader>
            <FormContent
              allDay={allDay}
              end={end}
              fieldErrors={fieldErrors}
              formError={formError}
              isPending={createMutation.isPending}
              isSubmitDisabled={createMutation.isPending || !start || !end}
              onCancel={() => setOpen(false)}
              onChangeAllDay={(value) => setAllDay(value)}
              onChangeEnd={(value) => {
                setEnd(value);
                setFieldErrors((prev) => ({ ...prev, end: undefined }));
                setFormError(null);
              }}
              onChangeStart={(value) => {
                setStart(value);
                setFieldErrors((prev) => ({ ...prev, start: undefined }));
                setFormError(null);
              }}
              onSubmit={handleSubmit}
              start={start}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function FormContent({
  allDay,
  end,
  fieldErrors,
  formError,
  isPending,
  isSubmitDisabled,
  onCancel,
  onChangeAllDay,
  onChangeEnd,
  onChangeStart,
  onSubmit,
  start,
}: {
  allDay: boolean;
  end: string;
  fieldErrors: { start?: string; end?: string };
  formError: string | null;
  isPending: boolean;
  isSubmitDisabled: boolean;
  onCancel: () => void;
  onChangeAllDay: (value: boolean) => void;
  onChangeEnd: (value: string) => void;
  onChangeStart: (value: string) => void;
  onSubmit: () => void;
  start: string;
}) {
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col gap-6 overflow-hidden">
      <div className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-4">
          <div className="space-y-1">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Duración
            </h2>
            <p className="text-sm text-muted-foreground">
              Ajusta cómo se registrará el bloqueo según la disponibilidad del técnico.
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg bg-background px-4 py-3 shadow-sm">
            <div className="space-y-1">
              <Label htmlFor="allDay" className="text-base font-medium">
                Todo el día
              </Label>
              <p className="text-sm text-muted-foreground">
                Activa esta opción para bloquear la jornada completa. Desactívala si necesitas horarios concretos.
              </p>
            </div>
            <Switch
              id="allDay"
              checked={allDay}
              onCheckedChange={(value) => onChangeAllDay(Boolean(value))}
              disabled={isPending}
            />
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-border/60 bg-muted/10 p-4">
          <div className="space-y-1">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Rango de fechas
            </h2>
            <p className="text-sm text-muted-foreground">
              Indica cuándo no estarás disponible. Puedes seleccionar un único día o un rango completo.
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="start">
                Inicio{allDay ? ' (fecha)' : ' (fecha y hora)'}
              </Label>
              <Input
                id="start"
                type={allDay ? 'date' : 'datetime-local'}
                value={start}
                onChange={(event) => onChangeStart(event.target.value)}
                disabled={isPending}
                aria-invalid={Boolean(fieldErrors.start)}
              />
              {fieldErrors.start ? (
                <p className="text-sm text-destructive">{fieldErrors.start}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">
                Fin{allDay ? ' (fecha)' : ' (fecha y hora)'}
              </Label>
              <Input
                id="end"
                type={allDay ? 'date' : 'datetime-local'}
                value={end}
                onChange={(event) => onChangeEnd(event.target.value)}
                disabled={isPending}
                aria-invalid={Boolean(fieldErrors.end)}
              />
              {fieldErrors.end ? (
                <p className="text-sm text-destructive">{fieldErrors.end}</p>
              ) : null}
            </div>
          </div>
        </section>

        {formError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {formError}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
          className="h-12 w-full rounded-lg text-base sm:h-10 sm:w-auto"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isSubmitDisabled}
          className="h-12 w-full rounded-lg text-base sm:h-10 sm:w-auto"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}Crear
        </Button>
      </div>
    </form>
  );
}
