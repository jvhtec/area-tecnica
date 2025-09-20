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
            House Tech Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            Loading...
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
          House Tech Rates
          <Badge variant="secondary">Management Only</Badge>
        </CardTitle>
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            These values are hidden from technicians and override category defaults in timesheet calculations.
            Effective immediately on recalculation.
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Category defaults for context */}
        {categoryDefaults && (
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="text-sm font-medium mb-2">Current Category Defaults ({category})</h4>
            <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
              <div>Base day: €{categoryDefaults.base_day_eur}</div>
              <div>10-12h plus: €{categoryDefaults.plus_10_12_eur}</div>
              <div>Overtime: €{categoryDefaults.overtime_hour_eur}/h</div>
            </div>
          </div>
        )}

        <Separator />

        {/* Rate override form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="base-day">Base Day Rate (€) *</Label>
            <Input
              id="base-day"
              type="number"
              step="0.01"
              min="0"
              value={baseDayEur}
              onChange={(e) => setBaseDayEur(e.target.value)}
              placeholder="Enter base day rate"
            />
            <p className="text-xs text-muted-foreground">
              Used for shifts up to 10 hours
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plus-1012">10-12h Plus (€)</Label>
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
              Additional amount for 10-12 hour shifts (default: €30)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="overtime">Overtime Rate (€/hour)</Label>
            <Input
              id="overtime"
              type="number"
              step="0.01"
              min="0"
              value={overtimeHourEur}
              onChange={(e) => setOvertimeHourEur(e.target.value)}
              placeholder={`Default: €${categoryDefaults?.overtime_hour_eur || '20'}/h`}
            />
            <p className="text-xs text-muted-foreground">
              Per hour rate for hours above 12 (leave empty to use category default)
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
            {saveRateMutation.isPending ? 'Saving...' : 'Save Rate'}
          </Button>
        </div>

        {/* Rate calculation tiers explanation */}
        <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Rate Calculation Tiers</h4>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div>• Up to 10h: Base day rate</div>
            <div>• 10-12h: Base day rate + 10-12h plus</div>
            <div>• Over 12h: Base day rate + 10-12h plus + (overtime × hours over 12)</div>
            <div>• 30-minute rounding: Next hour starts at ≥ 30 minutes</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}