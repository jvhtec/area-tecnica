import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { buildTourSchedulePdfBlob } from '@/lib/tourPdfExport';
import { uploadTourPdfWithRecord } from '@/utils/tourDocumentsUpload';

type TourDateLite = { id: string; date: string; location?: { name?: string | null } | null; is_tour_pack_only?: boolean | null };
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
  // Optional: if omitted, dates are fetched
  tourDates?: TourDateLite[];
};

export const RequestTourAvailabilityDialog: React.FC<Props> = ({ open, onOpenChange, tourId, tourDates }) => {
  const { toast } = useToast();
  const [techOptions, setTechOptions] = React.useState<Array<{ id: string; name: string }>>([]);
  const [selectedTechId, setSelectedTechId] = React.useState<string>('');
  const [channel, setChannel] = React.useState<'email' | 'whatsapp'>('email');
  const [loading, setLoading] = React.useState(false);
  const [dates, setDates] = React.useState<TourDateLite[]>(tourDates || []);

  React.useEffect(() => {
    if (!open) return;
    // Load technicians using the same RPC as the matrix to keep consistency
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_profiles_with_skills');
        if (error) throw error;
        const filtered = (data || [])
          .filter((t: any) => ['technician', 'house_tech'].includes(t.role) || (t.role === 'management' && t.assignable_as_tech))
          .map((t: any) => ({ id: t.id, name: `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.email || t.id }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
        setTechOptions(filtered);
      } catch (e) {
        console.error('[RequestTourAvailability] Failed to fetch technicians', e);
        setTechOptions([]);
      }
    })();
    // Load tour dates if not provided
    (async () => {
      try {
        if (tourDates && tourDates.length) { setDates(tourDates); return; }
        const { data, error } = await supabase
          .from('tour_dates')
          .select('id, date, is_tour_pack_only, location:locations(name)')
          .eq('tour_id', tourId)
          .order('date', { ascending: true });
        if (error) throw error;
        setDates((data || []) as TourDateLite[]);
      } catch (e) {
        console.error('[RequestTourAvailability] Failed to fetch tour dates', e);
        setDates([]);
      }
    })();
  }, [open]);

  const handleSend = async () => {
    if (!selectedTechId) {
      toast({ title: 'Select technician', description: 'Please choose a technician to contact.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      // Fetch tour name
      const { data: tourRow, error: tourErr } = await supabase.from('tours').select('id,name').eq('id', tourId).maybeSingle();
      if (tourErr || !tourRow) throw tourErr || new Error('Tour not found');

      // Build PDF blob
      const tourForPdf = { id: tourId, name: tourRow.name, tour_dates: dates };
      const pdfBlob = await buildTourSchedulePdfBlob(tourForPdf);
      const suggestedName = `${tourRow.name}_schedule.pdf`;

      // Upload and record
      const { file_path } = await uploadTourPdfWithRecord(tourId, pdfBlob, suggestedName);

      // Send a single tour‑wide availability inquiry (no per‑date staffing requests)
      const { data, error: fnErr } = await supabase.functions.invoke('send-tour-availability', {
        body: { tour_id: tourId, profile_id: selectedTechId, channel, tour_pdf_path: file_path }
      });
      if (fnErr || (data && (data as any).error)) {
        throw new Error((fnErr as any)?.message || (data as any)?.error || 'Failed to send');
      }
      toast({ title: 'Availability request sent', description: channel === 'whatsapp' ? 'Sent via WhatsApp' : 'Sent via Email' });
      onOpenChange(false);
    } catch (err: any) {
      console.error('[RequestTourAvailability] Failed to send', err);
      toast({ title: 'Failed to send', description: err.message || String(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Availability for Full Tour</DialogTitle>
          <DialogDescription>We will generate the tour schedule PDF and include it in the request.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Technician</Label>
            <Select value={selectedTechId} onValueChange={setSelectedTechId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose technician" />
              </SelectTrigger>
              <SelectContent>
                {techOptions.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Channel</Label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="tour-availability-channel" checked={channel === 'email'} onChange={() => setChannel('email')} />
                <span>Email</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="tour-availability-channel" checked={channel === 'whatsapp'} onChange={() => setChannel('whatsapp')} />
                <span>WhatsApp</span>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleSend} disabled={loading || !selectedTechId}>{loading ? 'Sending…' : 'Send'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
