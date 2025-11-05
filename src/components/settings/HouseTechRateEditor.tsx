import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Euro, Info, Save } from 'lucide-react';
import { useHouseTechRate, useSaveHouseTechRate, useLogRateActivity } from '@/hooks/useHouseTechRates';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface HouseTechRateEditorProps {
  profileId: string;
  profileName: string;
  category?: string;
}

interface CategoryDefaults {
  base_day_eur: number;
  plus_10_12_eur: number;
  overtime_hour_eur: number;
}

export function HouseTechRateEditor({ profileId, profileName, category = 'tecnico' }: HouseTechRateEditorProps) {
  const { data: currentRate, isLoading } = useHouseTechRate(profileId);
  const saveRateMutation = useSaveHouseTechRate();
  const logActivityMutation = useLogRateActivity();
  
  const [baseDayEur, setBaseDayEur] = useState<string>('');
  const [tourBaseResponsableEur, setTourBaseResponsableEur] = useState<string>('');
  const [tourBaseOtherEur, setTourBaseOtherEur] = useState<string>('');
  const [plus1012Eur, setPlus1012Eur] = useState<string>('30');
  const [overtimeHourEur, setOvertimeHourEur] = useState<string>('');

  // Get category defaults for context
  const { data: categoryDefaults } = useQuery({
    queryKey: ['rate-card-defaults', category],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rate_cards_2025')
        .select('base_day_eur, plus_10_12_eur, overtime_hour_eur')
        .eq('category', category)
        .single();

      if (error) throw error;
      return data as CategoryDefaults;
    },
  });

  useEffect(() => {
    if (currentRate) {
      setBaseDayEur(currentRate.base_day_eur.toString());
      setTourBaseResponsableEur(currentRate.tour_base_responsable_eur?.toString() || '');
      setTourBaseOtherEur(currentRate.tour_base_other_eur?.toString() || '');
      setPlus1012Eur(currentRate.plus_10_12_eur?.toString() || '30');
      setOvertimeHourEur(currentRate.overtime_hour_eur?.toString() || '');
    }
  }, [currentRate]);

  const handleSave = async () => {
    if (!baseDayEur || parseFloat(baseDayEur) <= 0) {
      return;
    }

    await saveRateMutation.mutateAsync({
      profile_id: profileId,
      base_day_eur: parseFloat(baseDayEur),
      tour_base_responsable_eur: tourBaseResponsableEur ? parseFloat(tourBaseResponsableEur) : null,
      tour_base_other_eur: tourBaseOtherEur ? parseFloat(tourBaseOtherEur) : null,
      plus_10_12_eur: plus1012Eur ? parseFloat(plus1012Eur) : null,
      overtime_hour_eur: overtimeHourEur ? parseFloat(overtimeHourEur) : null,
    });

    // Log the activity
    await logActivityMutation.mutateAsync({
      profileId,
      profileName,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5" />
            Tarifas internas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            Cargando...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Euro className="h-5 w-5" />
          Tarifas internas
          <Badge variant="secondary">Solo gestión</Badge>
        </CardTitle>
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            Estos valores están ocultos para los técnicos y sobrescriben los valores por defecto de la categoría en los cálculos de partes.
            Se aplican inmediatamente al recalcular.
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Category defaults for context */}
        {categoryDefaults && (
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="text-sm font-medium mb-2">Valores por defecto de la categoría ({category})</h4>
            <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
              <div>Día base: €{categoryDefaults.base_day_eur}</div>
              <div>Plus 10-12h: €{categoryDefaults.plus_10_12_eur}</div>
              <div>Horas extra: €{categoryDefaults.overtime_hour_eur}/h</div>
            </div>
          </div>
        )}

        <Separator />

        {/* Rate override form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="base-day">Tarifa día base (€) *</Label>
            <Input
              id="base-day"
              type="number"
              step="0.01"
              min="0"
              value={baseDayEur}
              onChange={(e) => setBaseDayEur(e.target.value)}
              placeholder="Introduce la tarifa de día base"
            />
            <p className="text-xs text-muted-foreground">
              Se usa para eventos de house y turnos de hasta 10 horas
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tour-base-responsable">Tarifa día base para tours - Responsable (€)</Label>
            <Input
              id="tour-base-responsable"
              type="number"
              step="0.01"
              min="0"
              value={tourBaseResponsableEur}
              onChange={(e) => setTourBaseResponsableEur(e.target.value)}
              placeholder="Dejar vacío para usar tarifa estándar"
            />
            <p className="text-xs text-muted-foreground">
              Tarifa cuando trabaja como responsable en tours. Si está vacío, se usará la tarifa día base estándar.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tour-base-other">Tarifa día base para tours - Técnico/Especialista (€)</Label>
            <Input
              id="tour-base-other"
              type="number"
              step="0.01"
              min="0"
              value={tourBaseOtherEur}
              onChange={(e) => setTourBaseOtherEur(e.target.value)}
              placeholder="Dejar vacío para usar tarifa estándar"
            />
            <p className="text-xs text-muted-foreground">
              Tarifa cuando trabaja como técnico o especialista en tours. Si está vacío, se usará la tarifa día base estándar.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plus-1012">Plus 10-12h (€)</Label>
            <Input
              id="plus-1012"
              type="number"
              step="0.01"
              min="0"
              value={plus1012Eur}
              onChange={(e) => setPlus1012Eur(e.target.value)}
              placeholder="30"
            />
            <p className="text-xs text-muted-foreground">
              Importe adicional para turnos de 10-12 horas (por defecto: €30)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="overtime">Tarifa horas extra (€/hora)</Label>
            <Input
              id="overtime"
              type="number"
              step="0.01"
              min="0"
              value={overtimeHourEur}
              onChange={(e) => setOvertimeHourEur(e.target.value)}
              placeholder={`Por defecto: €${categoryDefaults?.overtime_hour_eur || '20'}/h`}
            />
            <p className="text-xs text-muted-foreground">
              Precio por hora por encima de 12 (dejar vacío para usar el valor por defecto de la categoría)
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button 
            onClick={handleSave}
            disabled={saveRateMutation.isPending || !baseDayEur || parseFloat(baseDayEur) <= 0}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saveRateMutation.isPending ? 'Guardando...' : 'Guardar tarifa'}
          </Button>
        </div>

        {/* Rate calculation tiers explanation */}
        <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Tramos de cálculo de tarifa</h4>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div>• Hasta 10h: Tarifa día base</div>
            <div>• 10-12h: Tarifa base + plus 10-12h</div>
            <div>• Más de 12h: Tarifa base + plus 10-12h + (horas extra × horas por encima de 12)</div>
            <div>• Redondeo a 30 minutos: La siguiente hora empieza a los ≥ 30 minutos</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
