import React from 'react';
import { Key } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PoliticaAcceso } from '@/types/daySheetExtended';

interface AccessPolicyEditorProps {
  value: PoliticaAcceso;
  onChange: (value: PoliticaAcceso) => void;
  readOnly?: boolean;
}

export function AccessPolicyEditor({ value, onChange, readOnly = false }: AccessPolicyEditorProps) {
  const handleChange = (field: keyof PoliticaAcceso, newValue: string) => {
    onChange({ ...value, [field]: newValue });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Key className="h-5 w-5 text-[rgb(125,1,1)]" />
        <h3 className="text-lg font-semibold">Política de Acceso</h3>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="politica_pases">Política de Pases</Label>
          <Textarea
            id="politica_pases"
            value={value.politica_pases || ''}
            onChange={(e) => handleChange('politica_pases', e.target.value)}
            disabled={readOnly}
            placeholder="Detalles sobre política de pases..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pulseras">Pulseras / Wristbands</Label>
          <Textarea
            id="pulseras"
            value={value.pulseras || ''}
            onChange={(e) => handleChange('pulseras', e.target.value)}
            disabled={readOnly}
            placeholder="Tipos de pulseras y códigos de colores..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reglas_fotos">Reglas de Fotografía</Label>
          <Textarea
            id="reglas_fotos"
            value={value.reglas_fotos || ''}
            onChange={(e) => handleChange('reglas_fotos', e.target.value)}
            disabled={readOnly}
            placeholder="Política de fotografía y video..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="restricciones_edad">Restricciones de Edad</Label>
          <Textarea
            id="restricciones_edad"
            value={value.restricciones_edad || ''}
            onChange={(e) => handleChange('restricciones_edad', e.target.value)}
            disabled={readOnly}
            placeholder="Restricciones de edad del evento..."
            rows={2}
          />
        </div>
      </div>
    </div>
  );
}
