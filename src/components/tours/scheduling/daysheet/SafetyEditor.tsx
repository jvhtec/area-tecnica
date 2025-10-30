import React from 'react';
import { Shield } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Seguridad, DEFAULT_SEGURIDAD } from '@/types/daySheetExtended';

interface SafetyEditorProps {
  value: Seguridad;
  onChange: (value: Seguridad) => void;
  readOnly?: boolean;
}

export function SafetyEditor({ value, onChange, readOnly = false }: SafetyEditorProps) {
  const seguridad = { ...DEFAULT_SEGURIDAD, ...value };

  const handleChange = (field: keyof Seguridad, newValue: string | boolean) => {
    onChange({ ...seguridad, [field]: newValue });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-[rgb(125,1,1)]" />
        <h3 className="text-lg font-semibold">Seguridad</h3>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="salidas_emergencia">Salidas de Emergencia</Label>
          <Textarea
            id="salidas_emergencia"
            value={seguridad.salidas_emergencia || ''}
            onChange={(e) => handleChange('salidas_emergencia', e.target.value)}
            disabled={readOnly}
            placeholder="Ubicación de salidas de emergencia..."
            rows={2}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="medicos_en_sitio"
              checked={seguridad.medicos_en_sitio || false}
              onCheckedChange={(checked) => handleChange('medicos_en_sitio', checked as boolean)}
              disabled={readOnly}
            />
            <Label htmlFor="medicos_en_sitio" className="cursor-pointer">Médicos en Sitio</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ubicacion_medicos">Ubicación Médicos</Label>
            <Input
              id="ubicacion_medicos"
              value={seguridad.ubicacion_medicos || ''}
              onChange={(e) => handleChange('ubicacion_medicos', e.target.value)}
              disabled={readOnly}
              placeholder="Ubicación del puesto médico..."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="permisos_pirotecnia">Permisos Pirotecnia</Label>
            <Input
              id="permisos_pirotecnia"
              value={seguridad.permisos_pirotecnia || ''}
              onChange={(e) => handleChange('permisos_pirotecnia', e.target.value)}
              disabled={readOnly}
              placeholder="Detalles de permisos de pirotecnia..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="permisos_humo">Permisos Humo / Haze</Label>
            <Input
              id="permisos_humo"
              value={seguridad.permisos_humo || ''}
              onChange={(e) => handleChange('permisos_humo', e.target.value)}
              disabled={readOnly}
              placeholder="Detalles de permisos de humo..."
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="postura_seguridad">Postura de Seguridad</Label>
          <Textarea
            id="postura_seguridad"
            value={seguridad.postura_seguridad || ''}
            onChange={(e) => handleChange('postura_seguridad', e.target.value)}
            disabled={readOnly}
            placeholder="Nivel y postura de seguridad del evento..."
            rows={2}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tipo_barricada">Tipo de Barricada</Label>
            <Input
              id="tipo_barricada"
              value={seguridad.tipo_barricada || ''}
              onChange={(e) => handleChange('tipo_barricada', e.target.value)}
              disabled={readOnly}
              placeholder="Tipo de barricada..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reglas_acceso_foso">Reglas Acceso Foso</Label>
            <Input
              id="reglas_acceso_foso"
              value={seguridad.reglas_acceso_foso || ''}
              onChange={(e) => handleChange('reglas_acceso_foso', e.target.value)}
              disabled={readOnly}
              placeholder="Reglas de acceso al pit..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
