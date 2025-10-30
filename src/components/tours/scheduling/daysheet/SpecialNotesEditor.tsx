import React from 'react';
import { StickyNote } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NotasEspeciales } from '@/types/daySheetExtended';

interface SpecialNotesEditorProps {
  value: NotasEspeciales;
  onChange: (value: NotasEspeciales) => void;
  readOnly?: boolean;
}

export function SpecialNotesEditor({ value, onChange, readOnly = false }: SpecialNotesEditorProps) {
  const handleChange = (field: keyof NotasEspeciales, newValue: string) => {
    onChange({ ...value, [field]: newValue });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <StickyNote className="h-5 w-5 text-[rgb(125,1,1)]" />
        <h3 className="text-lg font-semibold">Notas Especiales</h3>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="invitados_especiales">Invitados Especiales</Label>
          <Textarea
            id="invitados_especiales"
            value={value.invitados_especiales || ''}
            onChange={(e) => handleChange('invitados_especiales', e.target.value)}
            disabled={readOnly}
            placeholder="Lista de invitados VIP..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prensa">Prensa</Label>
          <Textarea
            id="prensa"
            value={value.prensa || ''}
            onChange={(e) => handleChange('prensa', e.target.value)}
            disabled={readOnly}
            placeholder="Actividades de prensa programadas..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="peculiaridades_venue">Peculiaridades del Venue</Label>
          <Textarea
            id="peculiaridades_venue"
            value={value.peculiaridades_venue || ''}
            onChange={(e) => handleChange('peculiaridades_venue', e.target.value)}
            disabled={readOnly}
            placeholder="Detalles únicos o peculiaridades del venue..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="no_repetir">No Repetir (Don't Do This Again)</Label>
          <Textarea
            id="no_repetir"
            value={value.no_repetir || ''}
            onChange={(e) => handleChange('no_repetir', e.target.value)}
            disabled={readOnly}
            placeholder="Cosas que no hacer de nuevo..."
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}
