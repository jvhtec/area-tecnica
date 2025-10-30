import React, { useState, useEffect } from 'react';
import { FileText, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  HojaDeRutaCompleta,
  TiemposShow,
  Hospitalidad,
  DetallesProduccion,
  Merchandising,
  PoliticaAcceso,
  Seguridad,
  Liquidacion,
  NotasEspeciales,
} from '@/types/daySheetExtended';
import { ShowTimingEditor } from './daysheet/ShowTimingEditor';
import { HospitalityEditor } from './daysheet/HospitalityEditor';
import { ProductionDetailsEditor } from './daysheet/ProductionDetailsEditor';
import { MerchandiseEditor } from './daysheet/MerchandiseEditor';
import { AccessPolicyEditor } from './daysheet/AccessPolicyEditor';
import { SafetyEditor } from './daysheet/SafetyEditor';
import { SettlementEditor } from './daysheet/SettlementEditor';
import { SpecialNotesEditor } from './daysheet/SpecialNotesEditor';

interface ComprehensiveDaySheetEditorProps {
  tourDateId: string;
  hojaDeRutaId?: string;
  readOnly?: boolean;
  onSave?: () => void;
}

export function ComprehensiveDaySheetEditor({
  tourDateId,
  hojaDeRutaId,
  readOnly = false,
  onSave,
}: ComprehensiveDaySheetEditorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<HojaDeRutaCompleta>({
    tour_date_id: tourDateId,
  });

  // Cargar datos existentes
  useEffect(() => {
    const loadData = async () => {
      if (!hojaDeRutaId) {
        setLoading(false);
        return;
      }

      try {
        const { data: hojaData, error } = await supabase
          .from('hoja_de_ruta')
          .select('*')
          .eq('id', hojaDeRutaId)
          .single();

        if (error) throw error;

        if (hojaData) {
          setData({
            id: hojaData.id,
            tour_date_id: hojaData.tour_date_id,
            encabezado_info: hojaData.encabezado_info || {},
            tiempos_show: hojaData.tiempos_show || {},
            hospitalidad: hojaData.hospitalidad || {},
            detalles_produccion: hojaData.detalles_produccion || {},
            merchandising: hojaData.merchandising || {},
            politica_acceso: hojaData.politica_acceso || {},
            seguridad: hojaData.seguridad || {},
            liquidacion: hojaData.liquidacion || {},
            notas_especiales: hojaData.notas_especiales || {},
            hotel_info: hojaData.hotel_info || {},
            local_contacts: hojaData.local_contacts || [],
            program_schedule_json: hojaData.program_schedule_json || [],
            crew_calls: hojaData.crew_calls || [],
          });
        }
      } catch (error) {
        console.error('Error loading day sheet:', error);
        toast({
          title: 'Error',
          description: 'No se pudo cargar la hoja de ruta',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [hojaDeRutaId, toast]);

  // Guardar datos
  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData = {
        tour_date_id: tourDateId,
        encabezado_info: data.encabezado_info || {},
        tiempos_show: data.tiempos_show || {},
        hospitalidad: data.hospitalidad || {},
        detalles_produccion: data.detalles_produccion || {},
        merchandising: data.merchandising || {},
        politica_acceso: data.politica_acceso || {},
        seguridad: data.seguridad || {},
        liquidacion: data.liquidacion || {},
        notas_especiales: data.notas_especiales || {},
        updated_at: new Date().toISOString(),
      };

      let error;
      if (hojaDeRutaId) {
        // Actualizar existente
        ({ error } = await supabase
          .from('hoja_de_ruta')
          .update(updateData)
          .eq('id', hojaDeRutaId));
      } else {
        // Crear nuevo
        ({ error } = await supabase
          .from('hoja_de_ruta')
          .insert(updateData));
      }

      if (error) throw error;

      toast({
        title: 'Guardado',
        description: 'La hoja de ruta se ha guardado correctamente',
      });

      if (onSave) onSave();
    } catch (error) {
      console.error('Error saving day sheet:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la hoja de ruta',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-[rgb(125,1,1)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-[rgb(125,1,1)]" />
              <div>
                <CardTitle>Hoja de Ruta Completa</CardTitle>
                <CardDescription>
                  Edita todos los detalles de la hoja de ruta del día
                </CardDescription>
              </div>
            </div>
            {!readOnly && (
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-[rgb(125,1,1)] hover:bg-[rgb(100,1,1)]"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tiempos" className="w-full">
            <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
              <TabsTrigger value="tiempos">Tiempos</TabsTrigger>
              <TabsTrigger value="hospitalidad">Hospitalidad</TabsTrigger>
              <TabsTrigger value="produccion">Producción</TabsTrigger>
              <TabsTrigger value="merchandising">Merch</TabsTrigger>
              <TabsTrigger value="acceso">Acceso</TabsTrigger>
              <TabsTrigger value="seguridad">Seguridad</TabsTrigger>
              <TabsTrigger value="liquidacion">Liquidación</TabsTrigger>
              <TabsTrigger value="notas">Notas</TabsTrigger>
            </TabsList>

            <div className="mt-6">
              <TabsContent value="tiempos">
                <ShowTimingEditor
                  value={data.tiempos_show || {}}
                  onChange={(tiempos_show: TiemposShow) =>
                    setData({ ...data, tiempos_show })
                  }
                  readOnly={readOnly}
                />
              </TabsContent>

              <TabsContent value="hospitalidad">
                <HospitalityEditor
                  value={data.hospitalidad || {}}
                  onChange={(hospitalidad: Hospitalidad) =>
                    setData({ ...data, hospitalidad })
                  }
                  readOnly={readOnly}
                />
              </TabsContent>

              <TabsContent value="produccion">
                <ProductionDetailsEditor
                  value={data.detalles_produccion || {}}
                  onChange={(detalles_produccion: DetallesProduccion) =>
                    setData({ ...data, detalles_produccion })
                  }
                  readOnly={readOnly}
                />
              </TabsContent>

              <TabsContent value="merchandising">
                <MerchandiseEditor
                  value={data.merchandising || {}}
                  onChange={(merchandising: Merchandising) =>
                    setData({ ...data, merchandising })
                  }
                  readOnly={readOnly}
                />
              </TabsContent>

              <TabsContent value="acceso">
                <AccessPolicyEditor
                  value={data.politica_acceso || {}}
                  onChange={(politica_acceso: PoliticaAcceso) =>
                    setData({ ...data, politica_acceso })
                  }
                  readOnly={readOnly}
                />
              </TabsContent>

              <TabsContent value="seguridad">
                <SafetyEditor
                  value={data.seguridad || {}}
                  onChange={(seguridad: Seguridad) =>
                    setData({ ...data, seguridad })
                  }
                  readOnly={readOnly}
                />
              </TabsContent>

              <TabsContent value="liquidacion">
                <SettlementEditor
                  value={data.liquidacion || {}}
                  onChange={(liquidacion: Liquidacion) =>
                    setData({ ...data, liquidacion })
                  }
                  readOnly={readOnly}
                />
              </TabsContent>

              <TabsContent value="notas">
                <SpecialNotesEditor
                  value={data.notas_especiales || {}}
                  onChange={(notas_especiales: NotasEspeciales) =>
                    setData({ ...data, notas_especiales })
                  }
                  readOnly={readOnly}
                />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
