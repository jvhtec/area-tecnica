import React from 'react';
import { DollarSign } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Liquidacion } from '@/types/daySheetExtended';

interface SettlementEditorProps {
  value: Liquidacion;
  onChange: (value: Liquidacion) => void;
  readOnly?: boolean;
}

export function SettlementEditor({ value, onChange, readOnly = false }: SettlementEditorProps) {
  const handleChange = (field: keyof Liquidacion, newValue: string | number | string[]) => {
    onChange({ ...value, [field]: newValue });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="h-5 w-5 text-[rgb(125,1,1)]" />
        <h3 className="text-lg font-semibold">Liquidación</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="garantia_eur">Garantía (€)</Label>
          <Input
            id="garantia_eur"
            type="number"
            min="0"
            step="0.01"
            value={value.garantia_eur || ''}
            onChange={(e) => handleChange('garantia_eur', parseFloat(e.target.value) || 0)}
            disabled={readOnly}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="triggers_bonus">Triggers Bonus</Label>
          <Input
            id="triggers_bonus"
            value={value.triggers_bonus || ''}
            onChange={(e) => handleChange('triggers_bonus', e.target.value)}
            disabled={readOnly}
            placeholder="Cuándo se activan los bonos..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hora_settlement">Hora Settlement</Label>
          <Input
            id="hora_settlement"
            type="time"
            value={value.hora_settlement || ''}
            onChange={(e) => handleChange('hora_settlement', e.target.value)}
            disabled={readOnly}
            className="font-mono"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lugar_settlement">Lugar Settlement</Label>
          <Input
            id="lugar_settlement"
            value={value.lugar_settlement || ''}
            onChange={(e) => handleChange('lugar_settlement', e.target.value)}
            disabled={readOnly}
            placeholder="Ubicación del settlement..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="oficina_settlement">Oficina Settlement</Label>
          <Input
            id="oficina_settlement"
            value={value.oficina_settlement || ''}
            onChange={(e) => handleChange('oficina_settlement', e.target.value)}
            disabled={readOnly}
            placeholder="Oficina o sala..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="quien_asiste">Quién Asiste (separado por comas)</Label>
          <Input
            id="quien_asiste"
            value={value.quien_asiste?.join(', ') || ''}
            onChange={(e) => handleChange('quien_asiste', e.target.value.split(',').map(a => a.trim()).filter(Boolean))}
            disabled={readOnly}
            placeholder="Tour Manager, Promoter, etc..."
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="facturar_a">Facturar A</Label>
          <Input
            id="facturar_a"
            value={value.facturar_a || ''}
            onChange={(e) => handleChange('facturar_a', e.target.value)}
            disabled={readOnly}
            placeholder="A quién facturar..."
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="nota_retencion_fiscal">Nota Retención Fiscal</Label>
          <Textarea
            id="nota_retencion_fiscal"
            value={value.nota_retencion_fiscal || ''}
            onChange={(e) => handleChange('nota_retencion_fiscal', e.target.value)}
            disabled={readOnly}
            placeholder="Notas sobre retenciones fiscales..."
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}
