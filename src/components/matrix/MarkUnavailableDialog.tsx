
import React, { useState } from 'react';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
// Reason selection removed per request
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SHEET_BODY, SHEET_FOOTER, SHEET_HEADER } from '@/components/matrix/staffing/sheetLayout';
// import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar } from 'lucide-react';
import { es } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import { MADRID_TIMEZONE, formatMadridDateKey } from '@/utils/timezoneUtils';
import { dataLayerClient } from '@/services/dataLayerClient';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';


import { queryKeys } from "@/lib/react-query";
interface MarkUnavailableDialogProps {
  open: boolean;
  onClose: () => void;
  technicianId: string;
  selectedDate: Date;
  selectedCells: string[];
}

export const MarkUnavailableDialog = ({
  open,
  onClose,
  technicianId,
  selectedDate,
  selectedCells
}: MarkUnavailableDialogProps) => {
  // Reason removed; default to day_off
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get technician details
  const { data: technician } = useQuery({
    queryKey: queryKeys.scope('technician', technicianId),
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from('profiles')
        .select('first_name, last_name, department')
        .eq('id', technicianId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: open && !!technicianId
  });

  // No reason list

  const handleSubmit = async () => {
    // Reasonless flow; default handled below

    setIsSubmitting(true);

    try {
      const finalStatus = 'day_off';

      // Determine target dates: selectedDate + any additional selectedCells for this technician
      const selectedDates = new Set<string>();
      // Always include the primary selectedDate
      selectedDates.add(formatMadridDateKey(selectedDate));
      // Include additional dates from multi-select matching this technician
      for (const key of selectedCells) {
        // Keys are formatted as `${technicianId}-yyyy-MM-dd`
        const prefix = `${technicianId}-`;
        if (!key.startsWith(prefix)) continue;

        const datePortion = key.slice(prefix.length);
        const isValidDateKey = /^\d{4}-\d{2}-\d{2}$/.test(datePortion);

        if (isValidDateKey) {
          selectedDates.add(datePortion);
        }
      }

      // Upsert rows into existing per-day table
      const rows = Array.from(selectedDates).map(d => ({
        technician_id: technicianId,
        date: d,
        status: finalStatus,
      }));

      const { error: upsertError } = await dataLayerClient.from('technician_availability')
        .upsert(rows, { onConflict: 'technician_id,date' });

      if (upsertError) throw upsertError;

      const count = selectedDates.size;
      toast.success(`Marcado ${technician?.first_name} ${technician?.last_name} como no disponible por ${count} día${count > 1 ? 's' : ''}`);
      // Hint consumers to refresh matrix
      window.dispatchEvent(new CustomEvent('assignment-updated'));
      onClose();
    } catch (error) {
      console.error('Error marking unavailable:', error);
      toast.error('Error al marcar como no disponible');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader className={SHEET_HEADER}>
          <ResponsiveDialogTitle>Marcar como no disponible</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="first-letter:uppercase">
            Marcar a {technician?.first_name} {technician?.last_name} como no disponible el{' '}
            {formatInTimeZone(selectedDate, MADRID_TIMEZONE, 'EEEE, d MMMM, yyyy', { locale: es })}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className={cn(SHEET_BODY, "space-y-4")}>
          {technician && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Técnico:</span>
              <span>{technician.first_name} {technician.last_name}</span>
              <Badge variant="outline">{technician.department}</Badge>
            </div>
          )}

          <div className="bg-muted p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">Fecha</span>
            </div>
            <div className="text-sm">
              {formatInTimeZone(selectedDate, MADRID_TIMEZONE, 'EEEE, d MMMM, yyyy', { locale: es })}
            </div>
            {selectedCells.length > 1 && (
              <div className="text-xs text-muted-foreground mt-1">
                {selectedCells.length} fechas seleccionadas para actualización masiva
              </div>
            )}
          </div>

          {/* Reason removed; defaulting to day_off */}
        </div>

        <ResponsiveDialogFooter className={SHEET_FOOTER}>
          <Button variant="outline" className="min-h-11" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="min-h-11 flex-1 sm:flex-none"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Marcando...
              </>
            ) : (
              'Marcar no disponible'
            )}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
};
