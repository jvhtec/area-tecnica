import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Send } from 'lucide-react';

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Department } from '@/types/department';
import { roleOptionsForDiscipline } from '@/utils/roles';
import { formatMadridDateKey, madridDateKeyToCalendarDate } from '@/utils/timezoneUtils';
import { CoverageSelector, type CoverageMode } from '@/components/matrix/staffing/CoverageSelector';
import { SHEET_BODY, SHEET_FOOTER, SHEET_HEADER } from '@/components/matrix/staffing/sheetLayout';

interface OfferDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  technicianName: string;
  jobTitle?: string;
  jobDescription?: string | null;
  technicianDepartment: Department | string;
  onSubmit: (details: { role: string; message: string; singleDay?: boolean; dates?: string[] }) => void;
  defaultSingleDay?: boolean;
  jobStartTimeIso?: string;
  jobEndTimeIso?: string;
  defaultDateIso?: string;
}

export const OfferDetailsDialog: React.FC<OfferDetailsDialogProps> = ({ open, onClose, technicianName, jobTitle, jobDescription, technicianDepartment, onSubmit, defaultSingleDay, jobStartTimeIso, jobEndTimeIso, defaultDateIso }) => {
  const [role, setRole] = useState(''); // stores code
  const [message, setMessage] = useState('');
  const [coverageMode, setCoverageMode] = useState<CoverageMode>(defaultSingleDay ? 'single' : 'full');
  const defaultDate = defaultDateIso ? madridDateKeyToCalendarDate(defaultDateIso) : null;
  const [singleDate, setSingleDate] = useState<Date | null>(defaultDate);
  const [multiDates, setMultiDates] = useState<Date[]>(defaultDate ? [defaultDate] : []);

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
      setMessage(jobDescription || '');
    }
  }, [open, defaultSingleDay, jobDescription]);

  // Job timestamps are real instants, so their day is the Madrid one. Picker
  // values are local calendar days that round-trip through local format(), so
  // they are compared as such. Normalising the job bounds to local midnights
  // instead widened the allowed span by a day east of Madrid.
  const jobSpan = useMemo(() => ({
    startKey: jobStartTimeIso ? formatMadridDateKey(jobStartTimeIso) : null,
    endKey: jobEndTimeIso ? formatMadridDateKey(jobEndTimeIso) : (jobStartTimeIso ? formatMadridDateKey(jobStartTimeIso) : null),
  }), [jobStartTimeIso, jobEndTimeIso]);

  const isAllowedDate = (d: Date) => {
    if (!jobSpan.startKey || !jobSpan.endKey) return true;
    const dayKey = format(d, 'yyyy-MM-dd');
    return dayKey >= jobSpan.startKey && dayKey <= jobSpan.endKey;
  };

  // The CTA states how many days are going out, so a multi-day send is never a
  // surprise — the count is the thing people get wrong.
  const dayCount = coverageMode === 'multi' ? multiDates.length : coverageMode === 'single' ? 1 : 0;
  const submitLabel = coverageMode === 'full'
    ? 'Enviar oferta'
    : `Enviar oferta (${dayCount} ${dayCount === 1 ? 'día' : 'días'})`;

  return (
    <ResponsiveDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader className={SHEET_HEADER}>
          <ResponsiveDialogTitle>Enviar oferta</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {jobTitle ? `${jobTitle} · ${technicianName}` : technicianName}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className={cn(SHEET_BODY, "space-y-4")}>
          <div className="space-y-1.5">
            <Label htmlFor="role">Rol</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role" className="min-h-11">
                <SelectValue placeholder="Seleccionar rol" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((opt) => (
                  <SelectItem key={opt.code} value={opt.code}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="message">Mensaje (opcional)</Label>
            <Textarea
              id="message"
              rows={3}
              placeholder="Detalles adicionales para incluir en el mensaje"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <CoverageSelector
            value={coverageMode}
            onChange={setCoverageMode}
            singleDate={singleDate}
            onSingleDateChange={setSingleDate}
            multiDates={multiDates}
            onMultiDatesChange={setMultiDates}
            isAllowed={isAllowedDate}
            rangeStart={jobSpan.startKey ? madridDateKeyToCalendarDate(jobSpan.startKey) : null}
            rangeEnd={jobSpan.endKey ? madridDateKeyToCalendarDate(jobSpan.endKey) : null}
            fullHint="Oferta por toda la duración del trabajo."
            singleHint="Crea una oferta de un solo día para la fecha elegida."
            multiHint="Crea una oferta de un día por cada fecha seleccionada."
          />
        </div>

        <ResponsiveDialogFooter className={SHEET_FOOTER}>
          <Button variant="outline" className="min-h-11" onClick={onClose}>Cancelar</Button>
          <Button
            className="min-h-11 flex-1 gap-2 sm:flex-none"
            onClick={handleSubmit}
            disabled={!role.trim() || (coverageMode === 'multi' && !multiDates.length)}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {submitLabel}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
};
