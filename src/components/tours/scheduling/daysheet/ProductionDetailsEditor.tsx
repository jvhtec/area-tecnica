import React from 'react';
import { Settings } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { DetallesProduccion, DEFAULT_DETALLES_PRODUCCION } from '@/types/daySheetExtended';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ProductionDetailsEditorProps {
  value: DetallesProduccion;
  onChange: (value: DetallesProduccion) => void;
  readOnly?: boolean;
}

export function ProductionDetailsEditor({ value, onChange, readOnly = false }: ProductionDetailsEditorProps) {
  const detalles = {
    escenario: { ...DEFAULT_DETALLES_PRODUCCION.escenario, ...value.escenario },
    rigging: { ...DEFAULT_DETALLES_PRODUCCION.rigging, ...value.rigging },
    energia: { ...DEFAULT_DETALLES_PRODUCCION.energia, ...value.energia },
    audio: { ...DEFAULT_DETALLES_PRODUCCION.audio, ...value.audio },
    backline: { ...DEFAULT_DETALLES_PRODUCCION.backline, ...value.backline },
  };

  const handleEscenarioChange = (field: string, newValue: string | number | boolean) => {
    onChange({
      ...detalles,
      escenario: { ...detalles.escenario, [field]: newValue },
    });
  };

  const handleRiggingChange = (field: string, newValue: string | number) => {
    onChange({
      ...detalles,
      rigging: { ...detalles.rigging, [field]: newValue },
    });
  };

  const handleEnergiaChange = (field: string, newValue: string | boolean) => {
    onChange({
      ...detalles,
      energia: { ...detalles.energia, [field]: newValue },
    });
  };

  const handleAudioChange = (field: string, newValue: string | number) => {
    onChange({
      ...detalles,
      audio: { ...detalles.audio, [field]: newValue },
    });
  };

  const handleBacklineChange = (field: string, newValue: string) => {
    onChange({
      ...detalles,
      backline: { ...detalles.backline, [field]: newValue },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="h-5 w-5 text-[rgb(125,1,1)]" />
        <h3 className="text-lg font-semibold">Detalles de Producción</h3>
      </div>

      <Tabs defaultValue="escenario" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="escenario">Escenario</TabsTrigger>
          <TabsTrigger value="rigging">Rigging</TabsTrigger>
          <TabsTrigger value="energia">Energía</TabsTrigger>
          <TabsTrigger value="audio">Audio</TabsTrigger>
          <TabsTrigger value="backline">Backline</TabsTrigger>
        </TabsList>

        {/* Tab Escenario */}
        <TabsContent value="escenario" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ancho_m">Ancho (m)</Label>
              <Input
                id="ancho_m"
                type="number"
                min="0"
                step="0.1"
                value={detalles.escenario?.ancho_m || ''}
                onChange={(e) => handleEscenarioChange('ancho_m', parseFloat(e.target.value) || 0)}
                disabled={readOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profundidad_m">Profundidad (m)</Label>
              <Input
                id="profundidad_m"
                type="number"
                min="0"
                step="0.1"
                value={detalles.escenario?.profundidad_m || ''}
                onChange={(e) => handleEscenarioChange('profundidad_m', parseFloat(e.target.value) || 0)}
                disabled={readOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="altura_m">Altura (m)</Label>
              <Input
                id="altura_m"
                type="number"
                min="0"
                step="0.1"
                value={detalles.escenario?.altura_m || ''}
                onChange={(e) => handleEscenarioChange('altura_m', parseFloat(e.target.value) || 0)}
                disabled={readOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ala_izquierda_m">Ala Izquierda (m)</Label>
              <Input
                id="ala_izquierda_m"
                type="number"
                min="0"
                step="0.1"
                value={detalles.escenario?.ala_izquierda_m || ''}
                onChange={(e) => handleEscenarioChange('ala_izquierda_m', parseFloat(e.target.value) || 0)}
                disabled={readOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ala_derecha_m">Ala Derecha (m)</Label>
              <Input
                id="ala_derecha_m"
                type="number"
                min="0"
                step="0.1"
                value={detalles.escenario?.ala_derecha_m || ''}
                onChange={(e) => handleEscenarioChange('ala_derecha_m', parseFloat(e.target.value) || 0)}
                disabled={readOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="altura_muelle_carga_m">Altura Muelle Carga (m)</Label>
              <Input
                id="altura_muelle_carga_m"
                type="number"
                min="0"
                step="0.1"
                value={detalles.escenario?.altura_muelle_carga_m || ''}
                onChange={(e) => handleEscenarioChange('altura_muelle_carga_m', parseFloat(e.target.value) || 0)}
                disabled={readOnly}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="ascensor_carga"
                checked={detalles.escenario?.ascensor_carga || false}
                onCheckedChange={(checked) => handleEscenarioChange('ascensor_carga', checked as boolean)}
                disabled={readOnly}
              />
              <Label htmlFor="ascensor_carga" className="cursor-pointer">Ascensor de Carga</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacidad_ascensor_kg">Capacidad Ascensor (kg)</Label>
              <Input
                id="capacidad_ascensor_kg"
                type="number"
                min="0"
                value={detalles.escenario?.capacidad_ascensor_kg || ''}
                onChange={(e) => handleEscenarioChange('capacidad_ascensor_kg', parseFloat(e.target.value) || 0)}
                disabled={readOnly}
              />
            </div>
          </div>
        </TabsContent>

        {/* Tab Rigging */}
        <TabsContent value="rigging" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="altura_grid_m">Altura Grid (m)</Label>
              <Input
                id="altura_grid_m"
                type="number"
                min="0"
                step="0.1"
                value={detalles.rigging?.altura_grid_m || ''}
                onChange={(e) => handleRiggingChange('altura_grid_m', parseFloat(e.target.value) || 0)}
                disabled={readOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="puntos_rigging">Puntos de Rigging</Label>
              <Input
                id="puntos_rigging"
                type="number"
                min="0"
                value={detalles.rigging?.puntos_rigging || ''}
                onChange={(e) => handleRiggingChange('puntos_rigging', parseInt(e.target.value) || 0)}
                disabled={readOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="carga_maxima_kg">Carga Máxima (kg)</Label>
              <Input
                id="carga_maxima_kg"
                type="number"
                min="0"
                value={detalles.rigging?.carga_maxima_kg || ''}
                onChange={(e) => handleRiggingChange('carga_maxima_kg', parseFloat(e.target.value) || 0)}
                disabled={readOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hora_steel_listo">Hora Steel Listo</Label>
              <Input
                id="hora_steel_listo"
                type="time"
                value={detalles.rigging?.hora_steel_listo || ''}
                onChange={(e) => handleRiggingChange('hora_steel_listo', e.target.value)}
                disabled={readOnly}
                className="font-mono"
              />
            </div>
          </div>
        </TabsContent>

        {/* Tab Energía */}
        <TabsContent value="energia" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="shore_power_buses"
                checked={detalles.energia?.shore_power_buses || false}
                onCheckedChange={(checked) => handleEnergiaChange('shore_power_buses', checked as boolean)}
                disabled={readOnly}
              />
              <Label htmlFor="shore_power_buses" className="cursor-pointer">Shore Power para Buses</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ubicacion_shore_power">Ubicación Shore Power</Label>
              <Input
                id="ubicacion_shore_power"
                value={detalles.energia?.ubicacion_shore_power || ''}
                onChange={(e) => handleEnergiaChange('ubicacion_shore_power', e.target.value)}
                disabled={readOnly}
                placeholder="Ubicación del shore power..."
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="servicios_energia">Servicios de Energía</Label>
              <Textarea
                id="servicios_energia"
                value={detalles.energia?.servicios_energia || ''}
                onChange={(e) => handleEnergiaChange('servicios_energia', e.target.value)}
                disabled={readOnly}
                placeholder="Descripción de servicios eléctricos disponibles..."
                rows={3}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="tie_ins">Tie-ins</Label>
              <Textarea
                id="tie_ins"
                value={detalles.energia?.tie_ins || ''}
                onChange={(e) => handleEnergiaChange('tie_ins', e.target.value)}
                disabled={readOnly}
                placeholder="Puntos de conexión eléctrica..."
                rows={3}
              />
            </div>
          </div>
        </TabsContent>

        {/* Tab Audio */}
        <TabsContent value="audio" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="foh_distancia_m">FOH Distancia (m)</Label>
              <Input
                id="foh_distancia_m"
                type="number"
                min="0"
                step="0.1"
                value={detalles.audio?.foh_distancia_m || ''}
                onChange={(e) => handleAudioChange('foh_distancia_m', parseFloat(e.target.value) || 0)}
                disabled={readOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="posicion_mezcla">Posición Mezcla</Label>
              <Input
                id="posicion_mezcla"
                value={detalles.audio?.posicion_mezcla || ''}
                onChange={(e) => handleAudioChange('posicion_mezcla', e.target.value)}
                disabled={readOnly}
                placeholder="Ubicación del mix..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="limite_spl_db">Límite SPL (dB)</Label>
              <Input
                id="limite_spl_db"
                type="number"
                min="0"
                value={detalles.audio?.limite_spl_db || ''}
                onChange={(e) => handleAudioChange('limite_spl_db', parseFloat(e.target.value) || 0)}
                disabled={readOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ordenanza_ruido">Ordenanza de Ruido</Label>
              <Input
                id="ordenanza_ruido"
                value={detalles.audio?.ordenanza_ruido || ''}
                onChange={(e) => handleAudioChange('ordenanza_ruido', e.target.value)}
                disabled={readOnly}
                placeholder="Restricciones de ruido..."
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notas_patch">Notas Patch</Label>
              <Textarea
                id="notas_patch"
                value={detalles.audio?.notas_patch || ''}
                onChange={(e) => handleAudioChange('notas_patch', e.target.value)}
                disabled={readOnly}
                placeholder="Notas sobre patch..."
                rows={3}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="enlaces_rf">Enlaces RF</Label>
              <Textarea
                id="enlaces_rf"
                value={detalles.audio?.enlaces_rf || ''}
                onChange={(e) => handleAudioChange('enlaces_rf', e.target.value)}
                disabled={readOnly}
                placeholder="Información sobre enlaces RF..."
                rows={3}
              />
            </div>
          </div>
        </TabsContent>

        {/* Tab Backline */}
        <TabsContent value="backline" className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notas_backline">Notas Backline</Label>
              <Textarea
                id="notas_backline"
                value={detalles.backline?.notas_backline || ''}
                onChange={(e) => handleBacklineChange('notas_backline', e.target.value)}
                disabled={readOnly}
                placeholder="Detalles sobre backline..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="alquileres_locales">Alquileres Locales</Label>
              <Textarea
                id="alquileres_locales"
                value={detalles.backline?.alquileres_locales || ''}
                onChange={(e) => handleBacklineChange('alquileres_locales', e.target.value)}
                disabled={readOnly}
                placeholder="Equipos alquilados localmente..."
                rows={4}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
