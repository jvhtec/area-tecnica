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
  
  const [baseDayTecnicoEur, setBaseDayTecnicoEur] = useState<string>('');
  const [baseDayEspecialistaEur, setBaseDayEspecialistaEur] = useState<string>('');
  const [baseDayResponsableEur, setBaseDayResponsableEur] = useState<string>('');

  const [tourBaseResponsableEur, setTourBaseResponsableEur] = useState<string>('');
  const [tourBaseEspecialistaEur, setTourBaseEspecialistaEur] = useState<string>('');
  const [tourBaseTecnicoEur, setTourBaseTecnicoEur] = useState<string>('');
  const [plus1012Eur, setPlus1012Eur] = useState<string>('30');
  const [overtimeHourEur, setOvertimeHourEur] = useState<string>('');

  const RATE_CATEGORIES = ['tecnico', 'especialista', 'responsable'] as const;
  type RateCategory = (typeof RATE_CATEGORIES)[number];

  // Get category defaults for context
  const { data: categoryDefaultsMap } = useQuery({
    queryKey: ['rate-card-defaults', 'tecnico-especialista-responsable'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rate_cards_2025')
        .select('category, base_day_eur, plus_10_12_eur, overtime_hour_eur')
        .in('category', RATE_CATEGORIES);

      if (error) throw error;

      const map: Partial<Record<RateCategory, CategoryDefaults>> = {};
      const rows = (data || []) as Array<{
        category: string;
        base_day_eur: number;
        plus_10_12_eur: number;
        overtime_hour_eur: number;
      }>;

      rows.forEach((row) => {
        if (RATE_CATEGORIES.includes(row.category as RateCategory)) {
          map[row.category as RateCategory] = {
            base_day_eur: row.base_day_eur,
            plus_10_12_eur: row.plus_10_12_eur,
            overtime_hour_eur: row.overtime_hour_eur,
          };
        }
      });
      return map;
    },
  });

  useEffect(() => {
    if (currentRate) {
      setBaseDayTecnicoEur(currentRate.base_day_eur.toString());
      setBaseDayEspecialistaEur(currentRate.base_day_especialista_eur?.toString() || '');
      setBaseDayResponsableEur(currentRate.base_day_responsable_eur?.toString() || '');
      setTourBaseResponsableEur(currentRate.tour_base_responsable_eur?.toString() || '');
      setTourBaseEspecialistaEur(currentRate.tour_base_especialista_eur?.toString() || '');
      setTourBaseTecnicoEur(currentRate.tour_base_other_eur?.toString() || '');
      setPlus1012Eur(currentRate.plus_10_12_eur?.toString() || '30');
      setOvertimeHourEur(currentRate.overtime_hour_eur?.toString() || '');
    }
  }, [currentRate]);

  const handleSave = async () => {
    if (!baseDayTecnicoEur || parseFloat(baseDayTecnicoEur) <= 0) {
      return;
    }

    await saveRateMutation.mutateAsync({
      profile_id: profileId,
      base_day_eur: parseFloat(baseDayTecnicoEur),
      base_day_especialista_eur: baseDayEspecialistaEur ? parseFloat(baseDayEspecialistaEur) : null,
      base_day_responsable_eur: baseDayResponsableEur ? parseFloat(baseDayResponsableEur) : null,
      tour_base_responsable_eur: tourBaseResponsableEur ? parseFloat(tourBaseResponsableEur) : null,
      tour_base_especialista_eur: tourBaseEspecialistaEur ? parseFloat(tourBaseEspecialistaEur) : null,
      tour_base_other_eur: tourBaseTecnicoEur ? parseFloat(tourBaseTecnicoEur) : null,
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
        {categoryDefaultsMap && (
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="text-sm font-medium mb-2">Valores por defecto por categoría</h4>
            <div className="grid gap-4 text-sm text-muted-foreground sm:grid-cols-3">
              <div className={category === 'tecnico' ? 'text-foreground' : undefined}>
                <div className="font-medium">Técnico</div>
                <div>Día base: €{categoryDefaultsMap.tecnico?.base_day_eur ?? '—'}</div>
                <div>Plus 10-12h: €{categoryDefaultsMap.tecnico?.plus_10_12_eur ?? '—'}</div>
                <div>Horas extra: €{categoryDefaultsMap.tecnico?.overtime_hour_eur ?? '—'}/h</div>
              </div>
              <div className={category === 'especialista' ? 'text-foreground' : undefined}>
                <div className="font-medium">Especialista</div>
                <div>Día base: €{categoryDefaultsMap.especialista?.base_day_eur ?? '—'}</div>
                <div>Plus 10-12h: €{categoryDefaultsMap.especialista?.plus_10_12_eur ?? '—'}</div>
                <div>Horas extra: €{categoryDefaultsMap.especialista?.overtime_hour_eur ?? '—'}/h</div>
              </div>
              <div className={category === 'responsable' ? 'text-foreground' : undefined}>
                <div className="font-medium">Responsable</div>
                <div>Día base: €{categoryDefaultsMap.responsable?.base_day_eur ?? '—'}</div>
                <div>Plus 10-12h: €{categoryDefaultsMap.responsable?.plus_10_12_eur ?? '—'}</div>
                <div>Horas extra: €{categoryDefaultsMap.responsable?.overtime_hour_eur ?? '—'}/h</div>
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* Rate override form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="base-day-tecnico">Tarifa día base - Técnico (€) *</Label>
            <Input
              id="base-day-tecnico"
              type="number"
              step="0.01"
              min="0"
              value={baseDayTecnicoEur}
              onChange={(e) => setBaseDayTecnicoEur(e.target.value)}
              placeholder="Introduce la tarifa de día base (técnico)"
            />
            <p className="text-xs text-muted-foreground">
              Se usa para turnos con categoría técnico. Especialista/Responsable pueden sobrescribir este valor.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="base-day-especialista">Tarifa día base - Especialista (€)</Label>
            <Input
              id="base-day-especialista"
              type="number"
              step="0.01"
              min="0"
              value={baseDayEspecialistaEur}
              onChange={(e) => setBaseDayEspecialistaEur(e.target.value)}
              placeholder="Dejar vacío para usar técnico"
            />
            <p className="text-xs text-muted-foreground">
              Si está vacío, se usará la tarifa de técnico.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="base-day-responsable">Tarifa día base - Responsable (€)</Label>
            <Input
              id="base-day-responsable"
              type="number"
              step="0.01"
              min="0"
              value={baseDayResponsableEur}
              onChange={(e) => setBaseDayResponsableEur(e.target.value)}
              placeholder="Dejar vacío para usar especialista/técnico"
            />
            <p className="text-xs text-muted-foreground">
              Si está vacío, se usará la tarifa de especialista (o técnico si especialista está vacío).
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="tour-base-tecnico">Tarifa día base para tours - Técnico (€)</Label>
            <Input
              id="tour-base-tecnico"
              type="number"
              step="0.01"
              min="0"
              value={tourBaseTecnicoEur}
              onChange={(e) => setTourBaseTecnicoEur(e.target.value)}
              placeholder="Dejar vacío para usar día base"
            />
            <p className="text-xs text-muted-foreground">
              Si está vacío, se usará la tarifa día base correspondiente a la categoría.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tour-base-especialista">Tarifa día base para tours - Especialista (€)</Label>
            <Input
              id="tour-base-especialista"
              type="number"
              step="0.01"
              min="0"
              value={tourBaseEspecialistaEur}
              onChange={(e) => setTourBaseEspecialistaEur(e.target.value)}
              placeholder="Dejar vacío para usar tour técnico o día base"
            />
            <p className="text-xs text-muted-foreground">
              Si está vacío, se usará la tarifa de tour técnico; si también está vacío, la tarifa día base de especialista/técnico.
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
              placeholder="Dejar vacío para usar día base"
            />
            <p className="text-xs text-muted-foreground">
              Si está vacío, se usará la tarifa día base de responsable (o especialista/técnico).
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
              placeholder={`Por defecto: €${categoryDefaultsMap?.[category as RateCategory]?.overtime_hour_eur || '20'}/h`}
            />
            <p className="text-xs text-muted-foreground">
              Precio por hora por encima de 12 (dejar vacío para usar el valor por defecto de la categoría)
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button 
            onClick={handleSave}
            disabled={saveRateMutation.isPending || !baseDayTecnicoEur || parseFloat(baseDayTecnicoEur) <= 0}
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
