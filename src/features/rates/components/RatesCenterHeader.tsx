import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RatesOverview } from '@/services/ratesService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';

interface RatesCenterHeaderProps {
  overview?: RatesOverview;
  isLoading: boolean;
}

export function RatesCenterHeader({ overview, isLoading }: RatesCenterHeaderProps) {
  const totals = overview?.totals;
  const pendingTours = overview?.pendingTours ?? [];
  const recentOverrides = overview?.recentOverrides ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Aprobaciones pendientes" value={totals?.pendingTours} isLoading={isLoading} />
        <SummaryCard title="Categorías de tarifa base" value={totals?.baseRates} isLoading={isLoading} />
        <SummaryCard title="Extras configurados" value={totals?.extras} isLoading={isLoading} />
        <SummaryCard title="Tarifas internas" value={totals?.houseOverrides} isLoading={isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Próximas aprobaciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {isLoading && <Skeleton className="h-20 w-full" />}
            {!isLoading && pendingTours.length === 0 && (
              <p className="text-muted-foreground">Todas las giras están aprobadas. ¡Buen trabajo!</p>
            )}
            {!isLoading && pendingTours.map((tour) => (
              <div key={tour.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-1">
                  <div className="font-medium leading-tight">{tour.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {tour.start_date ? format(new Date(tour.start_date), 'PPP', { locale: es }) : 'Sin fecha de inicio'}
                  </div>
                </div>
                <Badge variant="secondary">Se requiere aprobación</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tarifas internas recientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {isLoading && <Skeleton className="h-20 w-full" />}
            {!isLoading && recentOverrides.length === 0 && (
              <p className="text-muted-foreground">Sin tarifas internas registradas.</p>
            )}
            {!isLoading && recentOverrides.map((override) => (
              <div key={`${override.profileId}-${override.updatedAt}`} className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-1">
                  <div className="font-medium leading-tight">{override.profileName}</div>
                  <div className="text-xs text-muted-foreground">
                    {override.updatedAt ? format(new Date(override.updatedAt), 'PPP p', { locale: es }) : 'Fecha desconocida'}
                  </div>
                </div>
                <Badge variant="outline">
                  {override.baseDayEur != null ? formatCurrency(override.baseDayEur) : '—'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value?: number;
  isLoading: boolean;
}

function SummaryCard({ title, value, isLoading }: SummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-3xl font-semibold">{value ?? '—'}</div>
        )}
      </CardContent>
    </Card>
  );
}
