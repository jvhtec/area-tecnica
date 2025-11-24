import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Department } from '@/types/department';
import { roleOptionsForDiscipline, labelForCode } from '@/utils/roles';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

interface OfferDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  technicianName: string;
  jobTitle?: string;
  technicianDepartment: Department | string;
  onSubmit: (details: { role: string; message: string; singleDay?: boolean; dates?: string[] }) => void;
  defaultSingleDay?: boolean;
  jobStartTimeIso?: string;
  jobEndTimeIso?: string;
  defaultDateIso?: string;
}

export const OfferDetailsDialog: React.FC<OfferDetailsDialogProps> = ({ open, onClose, technicianName, jobTitle, technicianDepartment, onSubmit, defaultSingleDay, jobStartTimeIso, jobEndTimeIso, defaultDateIso }) => {
  const [role, setRole] = useState(''); // stores code
  const [message, setMessage] = useState('');
  const [coverageMode, setCoverageMode] = useState<'full' | 'single' | 'multi'>(defaultSingleDay ? 'single' : 'full');
  const [singleDate, setSingleDate] = useState<Date | null>(() => {
    if (defaultDateIso) {
      try { return new Date(`${defaultDateIso}T00:00:00`); } catch { return null; }
    }
    return null;
  });
  const [multiDates, setMultiDates] = useState<Date[]>(() => {
    if (defaultDateIso) {
      try { return [new Date(`${defaultDateIso}T00:00:00`)]; } catch { return []; }
    }
    return [];
  });

  const handleSubmit = () => {
    const trimmedRole = role.trim();
    const trimmedMsg = message.trim();
    if (coverageMode === 'multi') {
      const uniq = Array.from(new Set((multiDates || []).map(d => format(d, 'yyyy-MM-dd'))));
      onSubmit({ role: trimmedRole, message: trimmedMsg, singleDay: true, dates: uniq });
      return;
    }
    if (coverageMode === 'single') {
      const d = singleDate ? format(singleDate, 'yyyy-MM-dd') : (defaultDateIso || null);
      onSubmit({ role: trimmedRole, message: trimmedMsg, singleDay: true, dates: d ? [d] : undefined });
      return;
    }
    onSubmit({ role: trimmedRole, message: trimmedMsg, singleDay: false });
  };

  const roleOptions = roleOptionsForDiscipline(String(technicianDepartment));
  React.useEffect(() => {
    if (open && roleOptions.length && !role) setRole(roleOptions[0].code);
  }, [open, technicianDepartment]);

  React.useEffect(() => {
    if (open) {
      setCoverageMode(defaultSingleDay ? 'single' : 'full');
    }
  }, [open, defaultSingleDay]);

  const jobSpan = useMemo(() => {
    const s = jobStartTimeIso ? new Date(jobStartTimeIso) : null;
    const e = jobEndTimeIso ? new Date(jobEndTimeIso) : s;
    if (s) s.setHours(0, 0, 0, 0);
    if (e) e.setHours(0, 0, 0, 0);
    return { start: s, end: e };
  }, [jobStartTimeIso, jobEndTimeIso]);

  const isAllowedDate = (d: Date) => {
    if (!jobSpan.start || !jobSpan.end) return true;
    const t = new Date(d); t.setHours(0, 0, 0, 0);
    return t >= jobSpan.start && t <= jobSpan.end;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar Oferta {jobTitle ? `- ${jobTitle}` : ''}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Técnico</Label>
            <div className="text-sm text-muted-foreground">{technicianName}</div>
          </div>
          <div>
            <Label htmlFor="role">Rol</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Seleccionar rol" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((opt) => (
                  <SelectItem key={opt.code} value={opt.code}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="message">Mensaje (opcional)</Label>
            <Textarea id="message" placeholder="Detalles adicionales para incluir en el correo" value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Cobertura</Label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="offer-coverage" checked={coverageMode === 'full'} onChange={() => setCoverageMode('full')} />
                <span>Duración completa del trabajo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="offer-coverage" checked={coverageMode === 'single'} onChange={() => setCoverageMode('single')} />
                <span>Día suelto</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="offer-coverage" checked={coverageMode === 'multi'} onChange={() => setCoverageMode('multi')} />
                <span>Varios días</span>
              </label>
            </div>
          </div>
          {coverageMode === 'single' && (
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {singleDate ? format(singleDate, 'PPP') : (defaultDateIso || 'Seleccionar fecha')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={singleDate ?? undefined}
                    onSelect={(d) => { if (d && isAllowedDate(d)) setSingleDate(d); }}
                    disabled={(d) => !isAllowedDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">Crea una oferta de un solo día para la fecha elegida.</p>
            </div>
          )}
          {coverageMode === 'multi' && (
            <div className="space-y-2">
              <CalendarPicker
                mode="multiple"
                selected={multiDates}
                onSelect={(ds) => setMultiDates((ds || []).filter(d => isAllowedDate(d)))}
                disabled={(d) => !isAllowedDate(d)}
                numberOfMonths={2}
              />
              <p className="text-xs text-muted-foreground">Crea una oferta de un solo día por cada fecha seleccionada.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!role.trim()}>Enviar Oferta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
