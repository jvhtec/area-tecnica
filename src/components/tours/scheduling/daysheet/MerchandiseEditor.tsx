import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Merchandising, DEFAULT_MERCHANDISING } from '@/types/daySheetExtended';

interface MerchandiseEditorProps {
  value: Merchandising;
  onChange: (value: Merchandising) => void;
  readOnly?: boolean;
}

export function MerchandiseEditor({ value, onChange, readOnly = false }: MerchandiseEditorProps) {
  const merch = { ...DEFAULT_MERCHANDISING, ...value };

  const handleChange = (field: keyof Merchandising, newValue: string | number) => {
    onChange({ ...merch, [field]: newValue });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <ShoppingBag className="h-5 w-5 text-[rgb(125,1,1)]" />
        <h3 className="text-lg font-semibold">Merchandising</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="porcentaje_venta">% Venta (Comisión Venue)</Label>
          <Input
            id="porcentaje_venta"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={merch.porcentaje_venta || ''}
            onChange={(e) => handleChange('porcentaje_venta', parseFloat(e.target.value) || 0)}
            disabled={readOnly}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="porcentaje_impuesto">% Impuesto</Label>
          <Input
            id="porcentaje_impuesto"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={merch.porcentaje_impuesto || ''}
            onChange={(e) => handleChange('porcentaje_impuesto', parseFloat(e.target.value) || 0)}
            disabled={readOnly}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="porcentaje_tarjeta">% Fee Tarjeta Crédito</Label>
          <Input
            id="porcentaje_tarjeta"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={merch.porcentaje_tarjeta || ''}
            onChange={(e) => handleChange('porcentaje_tarjeta', parseFloat(e.target.value) || 0)}
            disabled={readOnly}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nombre_vendedor">Nombre Vendedor</Label>
          <Input
            id="nombre_vendedor"
            value={merch.nombre_vendedor || ''}
            onChange={(e) => handleChange('nombre_vendedor', e.target.value)}
            disabled={readOnly}
            placeholder="Nombre del vendedor..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ubicacion_mesa">Ubicación Mesa</Label>
          <Input
            id="ubicacion_mesa"
            value={merch.ubicacion_mesa || ''}
            onChange={(e) => handleChange('ubicacion_mesa', e.target.value)}
            disabled={readOnly}
            placeholder="Ubicación de la mesa de merch..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hora_recuento">Hora Recuento</Label>
          <Input
            id="hora_recuento"
            type="time"
            value={merch.hora_recuento || ''}
            onChange={(e) => handleChange('hora_recuento', e.target.value)}
            disabled={readOnly}
            className="font-mono"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="lugar_settlement">Lugar Settlement</Label>
          <Input
            id="lugar_settlement"
            value={merch.lugar_settlement || ''}
            onChange={(e) => handleChange('lugar_settlement', e.target.value)}
            disabled={readOnly}
            placeholder="Dónde se hace la liquidación..."
          />
        </div>
      </div>
    </div>
  );
}
