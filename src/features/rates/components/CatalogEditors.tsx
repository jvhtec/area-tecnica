import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Euro, Wrench } from 'lucide-react';
import { useRateExtrasCatalog, useSaveRateExtra } from '@/hooks/useRateExtrasCatalog';
import { useTourBaseRates, useSaveTourBaseRate } from '@/hooks/useTourBaseRates';
import { cn } from '@/lib/utils';

type CatalogEditorProps = {
  className?: string;
};

export function ExtrasCatalogEditor({ className }: CatalogEditorProps) {
  const { data: rows = [], isLoading } = useRateExtrasCatalog();
  const save = useSaveRateExtra();

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wrench className="h-4 w-4" /> Extras Catalog (2025)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Alert>
          <AlertDescription>
            Define unit amounts for travel and rest day extras. Managers can adjust these at any time.
          </AlertDescription>
        </Alert>
        {isLoading && (
          <div className="text-sm text-muted-foreground">Loading extras catalog…</div>
        )}
        {!isLoading && rows.map((r) => (
          <div key={r.extra_type} className="flex items-center gap-3">
            <Label className="w-40 capitalize">{r.extra_type.replace('_', ' ')}</Label>
            <Input
              type="number"
              defaultValue={r.amount_eur}
              className="w-40"
              onBlur={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v !== r.amount_eur) {
                  save.mutate({ extra_type: r.extra_type as any, amount_eur: v });
                }
              }}
              aria-label={`Amount for ${r.extra_type}`}
            />
            <span className="text-xs text-muted-foreground">EUR</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function BaseRatesEditor({ className }: CatalogEditorProps) {
  const { data: rows = [], isLoading } = useTourBaseRates();
  const save = useSaveTourBaseRate();
  const categories: Array<{ key: 'tecnico' | 'especialista' | 'responsable'; label: string }> = [
    { key: 'tecnico', label: 'Técnico' },
    { key: 'especialista', label: 'Especialista' },
    { key: 'responsable', label: 'Responsable' },
  ];

  const map = useMemo(
    () => Object.fromEntries(rows.map(r => [r.category, r.base_day_eur])) as Record<string, number>,
    [rows]
  );

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Euro className="h-4 w-4" /> Tour Base Rates (2025)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Alert>
          <AlertDescription>
            Set daily base amounts per category. Weekly multipliers apply when technicians are on the tour team.
          </AlertDescription>
        </Alert>
        {isLoading && (
          <div className="text-sm text-muted-foreground">Loading base rates…</div>
        )}
        {!isLoading && categories.map(c => (
          <div key={c.key} className="flex items-center gap-3">
            <Label className="w-40">{c.label}</Label>
            <Input
              type="number"
              defaultValue={map[c.key] ?? ''}
              className="w-40"
              onBlur={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) {
                  save.mutate({ category: c.key, base_day_eur: v });
                }
              }}
              aria-label={`Base rate for ${c.label}`}
            />
            <span className="text-xs text-muted-foreground">EUR</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
