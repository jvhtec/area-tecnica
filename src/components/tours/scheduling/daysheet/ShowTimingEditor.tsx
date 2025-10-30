import React from 'react';
import { Clock } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TiemposShow, DEFAULT_TIEMPOS_SHOW } from '@/types/daySheetExtended';

interface ShowTimingEditorProps {
  value: TiemposShow;
  onChange: (value: TiemposShow) => void;
  readOnly?: boolean;
}

export function ShowTimingEditor({ value, onChange, readOnly = false }: ShowTimingEditorProps) {
  const tiempos = { ...DEFAULT_TIEMPOS_SHOW, ...value };

  const handleChange = (field: keyof TiemposShow, newValue: string | number) => {
    onChange({ ...tiempos, [field]: newValue });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-[rgb(125,1,1)]" />
        <h3 className="text-lg font-semibold">Tiempos del Show</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Soundcheck */}
        <div className="space-y-2">
          <Label htmlFor="soundcheck">Soundcheck</Label>
          <Input
            id="soundcheck"
            type="time"
            value={tiempos.soundcheck || ''}
            onChange={(e) => handleChange('soundcheck', e.target.value)}
            disabled={readOnly}
            className="font-mono"
          />
        </div>

        {/* Puertas (Doors) */}
        <div className="space-y-2">
          <Label htmlFor="puertas">Puertas (Doors)</Label>
          <Input
            id="puertas"
            type="time"
            value={tiempos.puertas || ''}
            onChange={(e) => handleChange('puertas', e.target.value)}
            disabled={readOnly}
            className="font-mono"
          />
        </div>

        {/* Soporte inicio (Support On) */}
        <div className="space-y-2">
          <Label htmlFor="soporte_inicio">Soporte Inicio (Support On)</Label>
          <Input
            id="soporte_inicio"
            type="time"
            value={tiempos.soporte_inicio || ''}
            onChange={(e) => handleChange('soporte_inicio', e.target.value)}
            disabled={readOnly}
            className="font-mono"
          />
        </div>

        {/* Cambio escenario (Set Change) */}
        <div className="space-y-2">
          <Label htmlFor="cambio_escenario">Cambio Escenario (Set Change)</Label>
          <Input
            id="cambio_escenario"
            type="time"
            value={tiempos.cambio_escenario || ''}
            onChange={(e) => handleChange('cambio_escenario', e.target.value)}
            disabled={readOnly}
            className="font-mono"
          />
        </div>

        {/* Headliner inicio */}
        <div className="space-y-2">
          <Label htmlFor="headliner_inicio">Headliner Inicio</Label>
          <Input
            id="headliner_inicio"
            type="time"
            value={tiempos.headliner_inicio || ''}
            onChange={(e) => handleChange('headliner_inicio', e.target.value)}
            disabled={readOnly}
            className="font-mono"
          />
        </div>

        {/* Curfew */}
        <div className="space-y-2">
          <Label htmlFor="curfew">Curfew</Label>
          <Input
            id="curfew"
            type="time"
            value={tiempos.curfew || ''}
            onChange={(e) => handleChange('curfew', e.target.value)}
            disabled={readOnly}
            className="font-mono"
          />
        </div>

        {/* Duración show */}
        <div className="space-y-2">
          <Label htmlFor="duracion_show_minutos">Duración Show (minutos)</Label>
          <Input
            id="duracion_show_minutos"
            type="number"
            min="0"
            step="5"
            value={tiempos.duracion_show_minutos || ''}
            onChange={(e) => handleChange('duracion_show_minutos', parseInt(e.target.value) || 0)}
            disabled={readOnly}
          />
        </div>

        {/* Bus call */}
        <div className="space-y-2">
          <Label htmlFor="bus_call">Bus Call</Label>
          <Input
            id="bus_call"
            type="time"
            value={tiempos.bus_call || ''}
            onChange={(e) => handleChange('bus_call', e.target.value)}
            disabled={readOnly}
            className="font-mono"
          />
        </div>

        {/* Carga completa objetivo */}
        <div className="space-y-2">
          <Label htmlFor="carga_completa_objetivo">Carga Completa Objetivo</Label>
          <Input
            id="carga_completa_objetivo"
            type="time"
            value={tiempos.carga_completa_objetivo || ''}
            onChange={(e) => handleChange('carga_completa_objetivo', e.target.value)}
            disabled={readOnly}
            className="font-mono"
          />
        </div>
      </div>

      {/* Notas de curfew estricto */}
      <div className="space-y-2">
        <Label htmlFor="nota_curfew_estricto">Nota Curfew Estricto</Label>
        <Textarea
          id="nota_curfew_estricto"
          value={tiempos.nota_curfew_estricto || ''}
          onChange={(e) => handleChange('nota_curfew_estricto', e.target.value)}
          disabled={readOnly}
          placeholder="Detalles sobre restricciones de curfew..."
          rows={2}
        />
      </div>

      {/* Plan viaje posterior */}
      <div className="space-y-2">
        <Label htmlFor="plan_viaje_posterior">Plan Viaje Posterior</Label>
        <Textarea
          id="plan_viaje_posterior"
          value={tiempos.plan_viaje_posterior || ''}
          onChange={(e) => handleChange('plan_viaje_posterior', e.target.value)}
          disabled={readOnly}
          placeholder="Descripción del viaje después del show..."
          rows={2}
        />
      </div>
    </div>
  );
}
