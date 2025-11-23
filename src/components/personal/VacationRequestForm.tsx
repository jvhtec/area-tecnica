import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, Loader2, Palmtree } from 'lucide-react';

interface VacationRequestFormProps {
  onSubmit: (request: { startDate: string; endDate: string; reason: string }) => void;
  isSubmitting?: boolean;
}

export const VacationRequestForm: React.FC<VacationRequestFormProps> = ({ onSubmit, isSubmitting = false }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate || !endDate || !reason.trim()) {
      return;
    }

    onSubmit({ startDate, endDate, reason });

    setStartDate('');
    setEndDate('');
    setReason('');
  };

  const isFormValid = startDate && endDate && reason.trim() && new Date(startDate) <= new Date(endDate);

  return (
    <Card className="border-muted/60 bg-gradient-to-b from-background to-muted/30 shadow-sm">
      <CardHeader className="px-4 py-5 space-y-1">
        <CardTitle className="flex items-center gap-2 text-lg font-bold">
          <Palmtree className="h-5 w-5 text-amber-500" />
          Nueva solicitud de vacaciones
        </CardTitle>
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Captura fechas y motivo para enviar a aprobación.
        </p>
      </CardHeader>
      <CardContent className="px-4 pb-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="startDate">Fecha de inicio</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="endDate">Fecha de fin</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                disabled={isSubmitting}
                min={startDate}
              />
            </div>
          </div>

          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="reason">Motivo</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Vacaciones, asuntos personales, etc."
              required
              disabled={isSubmitting}
              rows={3}
            />
          </div>

          <Button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className="w-full md:w-auto"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar solicitud
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
