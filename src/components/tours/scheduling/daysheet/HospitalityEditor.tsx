import React from 'react';
import { Utensils } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Hospitalidad, DEFAULT_HOSPITALIDAD } from '@/types/daySheetExtended';

interface HospitalityEditorProps {
  value: Hospitalidad;
  onChange: (value: Hospitalidad) => void;
  readOnly?: boolean;
}

export function HospitalityEditor({ value, onChange, readOnly = false }: HospitalityEditorProps) {
  const hospitalidad = {
    catering: { ...DEFAULT_HOSPITALIDAD.catering, ...value.catering },
    dieta: { ...DEFAULT_HOSPITALIDAD.dieta, ...value.dieta },
    amenidades: { ...DEFAULT_HOSPITALIDAD.amenidades, ...value.amenidades },
  };

  const handleCateringChange = (field: string, newValue: string | number) => {
    onChange({
      ...hospitalidad,
      catering: { ...hospitalidad.catering, [field]: newValue },
    });
  };

  const handleDietaChange = (field: string, newValue: string | string[]) => {
    onChange({
      ...hospitalidad,
      dieta: { ...hospitalidad.dieta, [field]: newValue },
    });
  };

  const handleAmenidadesChange = (field: string, newValue: boolean | number | string) => {
    onChange({
      ...hospitalidad,
      amenidades: { ...hospitalidad.amenidades, [field]: newValue },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Utensils className="h-5 w-5 text-[rgb(125,1,1)]" />
        <h3 className="text-lg font-semibold">Hospitalidad y Catering</h3>
      </div>

      {/* Sección Catering */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground">Catering</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Desayuno */}
          <div className="space-y-2">
            <Label htmlFor="desayuno_personas">Desayuno (personas)</Label>
            <Input
              id="desayuno_personas"
              type="number"
              min="0"
              value={hospitalidad.catering?.desayuno_personas || ''}
              onChange={(e) => handleCateringChange('desayuno_personas', parseInt(e.target.value) || 0)}
              disabled={readOnly}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="desayuno_hora">Hora Desayuno</Label>
            <Input
              id="desayuno_hora"
              type="time"
              value={hospitalidad.catering?.desayuno_hora || ''}
              onChange={(e) => handleCateringChange('desayuno_hora', e.target.value)}
              disabled={readOnly}
              className="font-mono"
            />
          </div>

          {/* Almuerzo */}
          <div className="space-y-2">
            <Label htmlFor="almuerzo_personas">Almuerzo (personas)</Label>
            <Input
              id="almuerzo_personas"
              type="number"
              min="0"
              value={hospitalidad.catering?.almuerzo_personas || ''}
              onChange={(e) => handleCateringChange('almuerzo_personas', parseInt(e.target.value) || 0)}
              disabled={readOnly}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="almuerzo_hora">Hora Almuerzo</Label>
            <Input
              id="almuerzo_hora"
              type="time"
              value={hospitalidad.catering?.almuerzo_hora || ''}
              onChange={(e) => handleCateringChange('almuerzo_hora', e.target.value)}
              disabled={readOnly}
              className="font-mono"
            />
          </div>

          {/* Cena */}
          <div className="space-y-2">
            <Label htmlFor="cena_personas">Cena (personas)</Label>
            <Input
              id="cena_personas"
              type="number"
              min="0"
              value={hospitalidad.catering?.cena_personas || ''}
              onChange={(e) => handleCateringChange('cena_personas', parseInt(e.target.value) || 0)}
              disabled={readOnly}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cena_hora">Hora Cena</Label>
            <Input
              id="cena_hora"
              type="time"
              value={hospitalidad.catering?.cena_hora || ''}
              onChange={(e) => handleCateringChange('cena_hora', e.target.value)}
              disabled={readOnly}
              className="font-mono"
            />
          </div>

          {/* Buyout */}
          <div className="space-y-2">
            <Label htmlFor="buyout_cantidad">Buyout (€)</Label>
            <Input
              id="buyout_cantidad"
              type="number"
              min="0"
              step="0.01"
              value={hospitalidad.catering?.buyout_cantidad || ''}
              onChange={(e) => handleCateringChange('buyout_cantidad', parseFloat(e.target.value) || 0)}
              disabled={readOnly}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="buyout_notas">Notas Buyout</Label>
            <Input
              id="buyout_notas"
              value={hospitalidad.catering?.buyout_notas || ''}
              onChange={(e) => handleCateringChange('buyout_notas', e.target.value)}
              disabled={readOnly}
              placeholder="Detalles del buyout..."
            />
          </div>
        </div>
      </div>

      {/* Sección Dieta */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground">Requisitos Dietéticos</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="alergias">Alergias (separadas por comas)</Label>
            <Input
              id="alergias"
              value={hospitalidad.dieta?.alergias?.join(', ') || ''}
              onChange={(e) => handleDietaChange('alergias', e.target.value.split(',').map(a => a.trim()).filter(Boolean))}
              disabled={readOnly}
              placeholder="Nueces, lácteos, gluten..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="requisitos_dieteticos">Requisitos Dietéticos (separados por comas)</Label>
            <Input
              id="requisitos_dieteticos"
              value={hospitalidad.dieta?.requisitos_dieteticos?.join(', ') || ''}
              onChange={(e) => handleDietaChange('requisitos_dieteticos', e.target.value.split(',').map(r => r.trim()).filter(Boolean))}
              disabled={readOnly}
              placeholder="Vegetariano, vegano, sin gluten..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="especificacion_cafe">Especificación Café</Label>
            <Input
              id="especificacion_cafe"
              value={hospitalidad.dieta?.especificacion_cafe || ''}
              onChange={(e) => handleDietaChange('especificacion_cafe', e.target.value)}
              disabled={readOnly}
              placeholder="Marca, tipo, cantidad..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="especificacion_agua">Especificación Agua</Label>
            <Input
              id="especificacion_agua"
              value={hospitalidad.dieta?.especificacion_agua || ''}
              onChange={(e) => handleDietaChange('especificacion_agua', e.target.value)}
              disabled={readOnly}
              placeholder="Marca, tipo, cantidad..."
            />
          </div>
        </div>
      </div>

      {/* Sección Amenidades */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground">Amenidades</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="duchas"
              checked={hospitalidad.amenidades?.duchas || false}
              onCheckedChange={(checked) => handleAmenidadesChange('duchas', checked as boolean)}
              disabled={readOnly}
            />
            <Label htmlFor="duchas" className="cursor-pointer">Duchas</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="toallas"
              checked={hospitalidad.amenidades?.toallas || false}
              onCheckedChange={(checked) => handleAmenidadesChange('toallas', checked as boolean)}
              disabled={readOnly}
            />
            <Label htmlFor="toallas" className="cursor-pointer">Toallas</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="lavanderia"
              checked={hospitalidad.amenidades?.lavanderia || false}
              onCheckedChange={(checked) => handleAmenidadesChange('lavanderia', checked as boolean)}
              disabled={readOnly}
            />
            <Label htmlFor="lavanderia" className="cursor-pointer">Lavandería</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="camerinos">Número de Camerinos</Label>
            <Input
              id="camerinos"
              type="number"
              min="0"
              value={hospitalidad.amenidades?.camerinos || ''}
              onChange={(e) => handleAmenidadesChange('camerinos', parseInt(e.target.value) || 0)}
              disabled={readOnly}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wifi_ssid">WiFi SSID</Label>
            <Input
              id="wifi_ssid"
              value={hospitalidad.amenidades?.wifi_ssid || ''}
              onChange={(e) => handleAmenidadesChange('wifi_ssid', e.target.value)}
              disabled={readOnly}
              placeholder="Nombre de la red..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wifi_password">WiFi Password</Label>
            <Input
              id="wifi_password"
              type="password"
              value={hospitalidad.amenidades?.wifi_password || ''}
              onChange={(e) => handleAmenidadesChange('wifi_password', e.target.value)}
              disabled={readOnly}
              placeholder="Contraseña WiFi..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
