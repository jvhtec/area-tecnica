import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ExternalLink, Link2, Save, Wand2, ClipboardPaste } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

type Dept = 'sound' | 'lights';

const CREW_CALL_VIEW_ID = '139e2f60-8d20-11e2-b07f-00e08175e43e';

interface Props {
  jobId: string;
  dialogMode?: boolean;
}

interface CrewCallRow {
  id: string;
  job_id: string;
  department: Dept;
  flex_element_id: string;
}

export function CrewCallLinker({ jobId, dialogMode = false }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [url, setUrl] = useState<Record<Dept, string>>({ sound: '', lights: '' });
  const [elementId, setElementId] = useState<Record<Dept, string>>({ sound: '', lights: '' });

  const extractElementId = (raw: string): string | '' => {
    const s = (raw || '').trim();
    if (!s) return '';
    const uuidRe = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/g;
    try {
      // Prefer the segment after 'contact-list/' if present
      const hash = s.split('#')[1] || s; // handle hash-based and raw inputs
      const idx = hash.indexOf('contact-list/');
      if (idx >= 0) {
        const after = hash.slice(idx + 'contact-list/'.length);
        const m = after.match(uuidRe);
        if (m && m.length) return m[0];
      }
      // Fallback: get first UUID that is not the known view id
      const all = Array.from(s.matchAll(uuidRe)).map(m => m[0]);
      const first = all.find(id => id.toLowerCase() !== CREW_CALL_VIEW_ID);
      return first || '';
    } catch {
      return '';
    }
  };

  const loadExisting = async () => {
    if (!jobId) return;
    const { data, error } = await supabase
      .from('flex_crew_calls')
      .select('department, flex_element_id')
      .eq('job_id', jobId);
    if (error) {
      console.error('Load crew calls error:', error);
      return;
    }
    const next: Record<Dept, string> = { sound: '', lights: '' };
    for (const row of (data || []) as any[]) {
      const d = (row.department || '').toLowerCase();
      if (d === 'sound' || d === 'lights' || d === 'video') next[d] = row.flex_element_id || '';
    }
    setElementId(next);
  };

  useEffect(() => { loadExisting(); }, [jobId]);

  const handleExtract = (dept: Dept) => {
    const id = extractElementId(url[dept]);
    if (id) setElementId({ ...elementId, [dept]: id });
  };

  const handlePasteExtract = async (dept: Dept) => {
    try {
      const clip = await navigator.clipboard.readText();
      setUrl({ ...url, [dept]: clip });
      const id = extractElementId(clip);
      if (id) setElementId({ ...elementId, [dept]: id });
    } catch (_) {
      // ignore
    }
  };

  const saveDept = async (dept: Dept) => {
    if (!jobId) return;
    const id = (elementId[dept] || '').trim();
    if (!id) {
      toast({ title: 'Missing ID', description: `No Flex element ID for ${dept}` });
      return;
    }
    try {
      setLoading(true);
      // Check if row exists
      const { data: existing } = await supabase
        .from('flex_crew_calls')
        .select('id')
        .eq('job_id', jobId)
        .eq('department', dept)
        .maybeSingle();
      if (existing?.id) {
        const { error } = await supabase
          .from('flex_crew_calls')
          .update({ flex_element_id: id })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('flex_crew_calls')
          .insert({ job_id: jobId, department: dept, flex_element_id: id });
        if (error) throw error;
      }
      toast({ title: 'Saved', description: `Linked ${dept} crew call` });
    } catch (e: any) {
      console.error('Save crew call error:', e);
      toast({ title: 'Save failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openFlex = (dept: Dept) => {
    const id = (elementId[dept] || '').trim();
    if (!id) return;
    const url = `https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#contact-list/${id}/view/${CREW_CALL_VIEW_ID}/detail`;
    window.open(url, '_blank');
  };

  const Row = ({ label, dept }: { label: string; dept: Dept }) => (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className={`grid ${dialogMode ? 'grid-cols-12' : 'grid-cols-12'} gap-2 items-center`}>
        <Input
          className="col-span-7 h-8 text-sm"
          placeholder="Paste Flex crew call URL"
          value={url[dept]}
          onChange={(e) => setUrl({ ...url, [dept]: e.target.value })}
        />
        <Button type="button" variant="secondary" size="sm" className="col-span-2 gap-1 h-8" onClick={() => handleExtract(dept)}>
          <Wand2 className="h-3 w-3" /> Extract
        </Button>
        <Button type="button" variant="outline" size="sm" className="col-span-2 gap-1 h-8" onClick={() => handlePasteExtract(dept)}>
          <ClipboardPaste className="h-3 w-3" /> Paste
        </Button>
        <Input
          className="col-span-7 h-8 text-sm"
          placeholder="Flex Element ID"
          value={elementId[dept]}
          onChange={(e) => setElementId({ ...elementId, [dept]: e.target.value })}
        />
        <Button type="button" variant="default" size="sm" className="col-span-2 gap-1 h-8" onClick={() => saveDept(dept)} disabled={loading}>
          <Save className="h-3 w-3" /> Save
        </Button>
        <Button type="button" variant="outline" size="sm" className="col-span-2 gap-1 h-8" onClick={() => openFlex(dept)} disabled={!elementId[dept]}>
          <ExternalLink className="h-3 w-3" /> Open
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Example: https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#contact-list/&lt;elementId&gt;/view/{CREW_CALL_VIEW_ID}/detail
      </p>
    </div>
  );

  if (dialogMode) {
    return (
      <div className="space-y-4">
        <Row label="Sound Crew Call" dept="sound" />
        <Row label="Lights Crew Call" dept="lights" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" /> Link Flex Crew Calls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Row label="Sound Crew Call" dept="sound" />
        <Row label="Lights Crew Call" dept="lights" />
      </CardContent>
    </Card>
  );
}

export function CrewCallLinkerDialog({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Link2 className="h-4 w-4" /> Link Crew Calls
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" /> Link Flex Crew Calls
          </DialogTitle>
        </DialogHeader>
        <CrewCallLinker jobId={jobId} dialogMode />
      </DialogContent>
    </Dialog>
  );
}
