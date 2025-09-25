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
  const [reason, setReason] = React.useState<string>('');

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
      toast.success('Unavailability created');
      qc.invalidateQueries({ queryKey: ['my-unavailability'] });
      setOpen(false);
      setReason('');
      setStart('');
      setEnd('');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to create block'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('technician_availability').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Unavailability removed');
      qc.invalidateQueries({ queryKey: ['my-unavailability'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to delete block'),
  });

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">My Unavailability</h1>
        <Button onClick={() => setOpen(true)}>Add Block</Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-3">
          {blocks.length === 0 && (
            <div className="text-muted-foreground">No unavailability blocks yet. Add one to block assignments during that time.</div>
          )}
          {blocks.map((b: any) => (
            <div key={b.id} className="flex items-center justify-between border rounded-md p-3">
              <div>
                <div className="font-medium">{new Date(b.date).toLocaleDateString()}</div>
                <div className="text-sm text-muted-foreground">{b.status}</div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(b.id)}>Delete</Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Unavailability</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch checked={allDay} onCheckedChange={(v) => setAllDay(Boolean(v))} id="allDay" />
              <Label htmlFor="allDay">All day</Label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Start{allDay ? ' (date)' : ' (datetime)'}</Label>
                <Input type={allDay ? 'date' : 'datetime-local'} value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div>
                <Label>End{allDay ? ' (date)' : ' (datetime)'}</Label>
                <Input type={allDay ? 'date' : 'datetime-local'} value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="vacation, travel, sick, day_off" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              try {
                if (!start || !end) { toast.error('Start and end required'); return; }
                if (!['vacation','travel','sick','day_off'].includes(reason)) { toast.error('Pick a valid reason'); return; }
                createMutation.mutate({ startDate: start, endDate: end, status: reason as any });
              } catch (e) {
                toast.error('Invalid date');
              }
            }} disabled={createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
