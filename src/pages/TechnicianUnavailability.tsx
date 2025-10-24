import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function TechnicianUnavailability() {
  const { user } = useOptimizedAuth();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [allDay, setAllDay] = React.useState(true);
  const [start, setStart] = React.useState<string>('');
  const [end, setEnd] = React.useState<string>('');
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
    },
    onError: (e: any) => toast.error(e?.message || 'No se pudo crear el bloqueo'),
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir bloqueo de disponibilidad</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch checked={allDay} onCheckedChange={(v) => setAllDay(Boolean(v))} id="allDay" />
              <Label htmlFor="allDay">Todo el día</Label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Inicio{allDay ? ' (fecha)' : ' (fecha y hora)'}</Label>
                <Input type={allDay ? 'date' : 'datetime-local'} value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div>
                <Label>Fin{allDay ? ' (fecha)' : ' (fecha y hora)'}</Label>
                <Input type={allDay ? 'date' : 'datetime-local'} value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            {/* Reason removed; defaults to day_off */}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              try {
                if (!start || !end) { toast.error('Las fechas de inicio y fin son obligatorias'); return; }
                const normalize = (v: string) => (v.includes('T') ? v.slice(0,10) : v);
                const s = normalize(start);
                const e = normalize(end);
                if (s.length !== 10 || e.length !== 10) { toast.error('Fecha no válida'); return; }
                createMutation.mutate({ startDate: s, endDate: e, status: 'day_off' });
              } catch (e) {
                toast.error('Fecha no válida');
              }
            }} disabled={createMutation.isPending || !start || !end}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
