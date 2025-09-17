import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";
import { REQUEST_TRANSPORT_OPTIONS } from "@/constants/transportOptions";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface TransportRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  department: string; // 'sound' | 'lights' | 'video'
  requestId?: string | null;
  onSubmitted?: () => void;
}

export function TransportRequestDialog({
  open,
  onOpenChange,
  jobId,
  department,
  requestId,
  onSubmitted,
}: TransportRequestDialogProps) {
  const [items, setItems] = useState<{ transport_type: string; leftover_space_meters?: number | '' }[]>([
    { transport_type: 'trailer', leftover_space_meters: '' },
  ]);
  const [note, setNote] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    const loadExisting = async () => {
      if (!requestId) return;
      const { data, error } = await supabase
        .from('transport_requests')
        .select('id, note, items:transport_request_items(id, transport_type, leftover_space_meters)')
        .eq('id', requestId)
        .single();
      if (!error && data) {
        setNote(data.note || '');
        if (Array.isArray((data as any).items) && (data as any).items.length > 0) {
          const mapped = (data as any).items.map((it: any) => ({
            transport_type: it.transport_type,
            leftover_space_meters: it.leftover_space_meters ?? '',
          }));
          setItems(mapped);
        } else {
          setItems([{ transport_type: 'trailer', leftover_space_meters: '' }]);
        }
      }
    };
    loadExisting();
  }, [requestId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const payload = {
        job_id: jobId,
        department,
        note: note || null,
        status: 'requested' as const,
        created_by: user.id,
      };

      if (requestId) {
        const { error } = await supabase
          .from('transport_requests')
          .update(payload)
          .eq('id', requestId);
        if (error) throw error;
        // Replace items
        await supabase.from('transport_request_items').delete().eq('request_id', requestId);
        const toInsert = items
          .filter((it) => !!it.transport_type)
          .map((it) => ({
            request_id: requestId,
            transport_type: it.transport_type,
            leftover_space_meters: it.leftover_space_meters === '' ? null : it.leftover_space_meters,
          }));
        if (toInsert.length > 0) {
          const { error: itemsErr } = await supabase.from('transport_request_items').insert(toInsert);
          if (itemsErr) throw itemsErr;
        }
      } else {
        const { data: inserted, error } = await supabase
          .from('transport_requests')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        const request_id = inserted.id;
        const toInsert = items
          .filter((it) => !!it.transport_type)
          .map((it) => ({
            request_id,
            transport_type: it.transport_type,
            leftover_space_meters: it.leftover_space_meters === '' ? null : it.leftover_space_meters,
          }));
        if (toInsert.length > 0) {
          const { error: itemsErr } = await supabase.from('transport_request_items').insert(toInsert);
          if (itemsErr) throw itemsErr;
        }
      }

      toast({ title: 'Transport request saved' });
      onSubmitted?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save request', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{requestId ? 'Edit Transport Request' : 'Request Transport'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Vehicles</Label>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Select
                    value={it.transport_type}
                    onValueChange={(val) => {
                      const next = items.slice();
                      next[idx] = { ...next[idx], transport_type: val };
                      setItems(next);
                    }}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REQUEST_TRANSPORT_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt.replace('_',' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    className="w-52"
                    placeholder="Leftover space (m) - optional"
                    value={it.leftover_space_meters === '' ? '' : it.leftover_space_meters}
                    onChange={(e) => {
                      const val = e.target.value;
                      const num = val === '' ? '' : Math.max(0, Number(val));
                      const next = items.slice();
                      next[idx] = { ...next[idx], leftover_space_meters: num as any };
                      setItems(next);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const next = items.slice();
                      next.splice(idx, 1);
                      setItems(next.length ? next : [{ transport_type: 'trailer', leftover_space_meters: '' }]);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setItems([...items, { transport_type: 'trailer', leftover_space_meters: '' }])}
                >
                  Add Vehicle
                </Button>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional details" />
          </div>
          <div className="flex justify-end">
            <Button type="submit">{requestId ? 'Update' : 'Submit'} Request</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
