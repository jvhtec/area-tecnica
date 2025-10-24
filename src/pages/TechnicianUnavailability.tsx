import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { CalendarDays, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

export default function TechnicianUnavailability() {
  const { user } = useOptimizedAuth();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [allDay, setAllDay] = React.useState(true);
  const [start, setStart] = React.useState<string>('');
  const [end, setEnd] = React.useState<string>('');
  const [formErrors, setFormErrors] = React.useState<{ start?: string; end?: string }>({});
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const isMobile = useIsMobile();
  // Reasonless flow; defaults to day_off in DB

  const statusLabels: Record<string, string> = {
    vacation: 'Vacaciones',
    travel: 'Viaje',
    sick: 'Baja médica',
    day_off: 'Día libre',
  };

  const statusStyles: Record<string, string> = {
    vacation: 'border-transparent bg-amber-100 text-amber-800',
    travel: 'border-transparent bg-sky-100 text-sky-800',
    sick: 'border-transparent bg-rose-100 text-rose-800',
    day_off: 'border-transparent bg-emerald-100 text-emerald-800',
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
      setFormErrors({});
    },
    onError: (e: any) => toast.error(e?.message || 'No se pudo crear el bloqueo'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('technician_availability').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: (id) => {
      setDeletingId(id);
    },
    onSuccess: () => {
      toast.success('Bloqueo eliminado');
      qc.invalidateQueries({ queryKey: ['my-unavailability'] });
    },
    onError: (e: any) => toast.error(e?.message || 'No se pudo eliminar el bloqueo'),
    onSettled: () => {
      setDeletingId(null);
    },
  });

  const pendingCreate = createMutation.isPending;

  const handleSubmit = (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const errors: { start?: string; end?: string } = {};

    if (!start) {
      errors.start = 'La fecha de inicio es obligatoria.';
    }
    if (!end) {
      errors.end = 'La fecha de fin es obligatoria.';
    }

    const normalize = (value: string) => (value.includes('T') ? value.slice(0, 10) : value);
    const normalizedStart = start ? normalize(start) : '';
    const normalizedEnd = end ? normalize(end) : '';

    if (normalizedStart && normalizedEnd && normalizedStart > normalizedEnd) {
      errors.end = 'La fecha de fin debe ser posterior o igual a la fecha de inicio.';
    }

    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    createMutation.mutate({ startDate: normalizedStart, endDate: normalizedEnd, status: 'day_off' });
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto pb-6">
        <section className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Rango de fechas</p>
            <p className="text-sm text-muted-foreground">
              Selecciona cuándo estarás ausente. Las fechas se aplicarán a todo el día por defecto.
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="start">Inicio{allDay ? ' (fecha)' : ' (fecha y hora)'}</Label>
              <Input
                id="start"
                type={allDay ? 'date' : 'datetime-local'}
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  if (formErrors.start) setFormErrors((prev) => ({ ...prev, start: undefined }));
                }}
                aria-invalid={!!formErrors.start}
                disabled={pendingCreate}
              />
              {formErrors.start && <p className="text-sm text-destructive">{formErrors.start}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">Fin{allDay ? ' (fecha)' : ' (fecha y hora)'}</Label>
              <Input
                id="end"
                type={allDay ? 'date' : 'datetime-local'}
                value={end}
                onChange={(e) => {
                  setEnd(e.target.value);
                  if (formErrors.end) setFormErrors((prev) => ({ ...prev, end: undefined }));
                }}
                aria-invalid={!!formErrors.end}
                disabled={pendingCreate}
              />
              {formErrors.end && <p className="text-sm text-destructive">{formErrors.end}</p>}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Duración del bloqueo</p>
            <p className="text-sm text-muted-foreground">
              Activa la opción para bloquear días completos o desactívala si solo necesitas unas horas específicas.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 p-4">
            <div className="space-y-1">
              <Label htmlFor="allDay" className="text-base font-medium">
                Todo el día
              </Label>
              <p className="text-sm text-muted-foreground">Tus horarios quedarán marcados como no disponibles las 24 horas.</p>
            </div>
            <Switch
              id="allDay"
              checked={allDay}
              onCheckedChange={(value) => setAllDay(Boolean(value))}
              disabled={pendingCreate}
            />
          </div>
        </section>
      </div>

      <div className="mt-auto flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pendingCreate}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pendingCreate}>
          {pendingCreate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {pendingCreate ? 'Guardando…' : 'Crear'}
        </Button>
      </div>
    </form>
  );

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
          {blocks.map((b: any) => {
            const formattedDate = new Date(b.date).toLocaleDateString('es-ES', { dateStyle: 'long' });
            const badgeClass = statusStyles[b.status as keyof typeof statusStyles] || 'border-transparent bg-muted text-foreground';
            const statusLabel = statusLabels[b.status as keyof typeof statusLabels] || b.status;
            return (
              <div
                key={b.id}
                className="rounded-lg border border-border/70 bg-muted/30 p-4 shadow-sm transition hover:bg-muted/40"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground shadow-inner">
                        <CalendarDays aria-hidden className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Fecha</p>
                        <p className="text-base font-semibold text-foreground">{formattedDate}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={`self-start ${badgeClass}`}>
                      {statusLabel}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full justify-center md:h-9 md:w-auto md:px-3"
                    onClick={() => deleteMutation.mutate(b.id)}
                    disabled={deleteMutation.isPending && deletingId === b.id}
                  >
                    {deleteMutation.isPending && deletingId === b.id ? (
                      <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 aria-hidden className="h-4 w-4" />
                    )}
                    <span>{deleteMutation.isPending && deletingId === b.id ? 'Eliminando…' : 'Eliminar'}</span>
                    <span className="sr-only">Bloqueo del {formattedDate}</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="md:hidden">
        <div className="fixed inset-x-0 bottom-0 z-50 bg-background/95 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <Button className="w-full" onClick={() => setOpen(true)}>
            Añadir bloqueo
          </Button>
        </div>
      </div>

      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="flex h-[94vh] flex-col overflow-hidden rounded-t-2xl bg-background px-6 pb-6 pt-10"
          >
            <SheetHeader className="space-y-1 text-left">
              <SheetTitle>Añadir bloqueo de disponibilidad</SheetTitle>
              <p className="text-sm text-muted-foreground">
                Define cuándo no podrás recibir asignaciones y mantén tu agenda al día.
              </p>
            </SheetHeader>
            <div className="mt-6 flex flex-1 flex-col">
              {formContent}
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Añadir bloqueo de disponibilidad</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Define cuándo no podrás recibir asignaciones y mantén tu agenda al día.
              </p>
            </DialogHeader>
            {formContent}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
