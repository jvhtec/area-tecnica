import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { HouseTechRateEditor } from '@/components/settings/HouseTechRateEditor';
import { useRatesHouseTechList } from '@/features/rates/hooks/useRatesHouseTechList';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';

export function HouseTechOverridesPanel() {
  const { data: technicians = [], isLoading } = useRatesHouseTechList();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return technicians;
    return technicians.filter((tech) =>
      tech.profileName.toLowerCase().includes(term)
    );
  }, [technicians, search]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col gap-2 text-base sm:flex-row sm:items-end sm:justify-between">
          <span>Tarifas internas</span>
          <Input
            placeholder="Buscar técnicos en plantilla"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="sm:w-64"
          />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-32 w-full" />}
        {!isLoading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">No se encontraron técnicos en plantilla con ese nombre.</p>
        )}
        {!isLoading && filtered.length > 0 && (
          <Accordion type="single" collapsible className="space-y-2">
            {filtered.map((tech) => (
              <AccordionItem key={tech.profileId} value={tech.profileId} className="border rounded-lg">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex flex-col items-start gap-2 text-left sm:flex-row sm:items-center sm:justify-between sm:w-full">
                    <div>
                      <div className="font-medium leading-tight">{tech.profileName}</div>
                      <div className="text-xs text-muted-foreground">
                        Categoría por defecto: {tech.defaultCategory ?? '—'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {tech.overrideBaseDay ? (
                        <Badge variant="secondary">Tarifa interna: {formatCurrency(tech.overrideBaseDay)}</Badge>
                      ) : (
                        <Badge variant="outline">Usando valor por defecto</Badge>
                      )}
                      {tech.overrideUpdatedAt && (
                        <span className="text-xs text-muted-foreground">
                          Actualizado {format(new Date(tech.overrideUpdatedAt), 'PPP', { locale: es })}
                        </span>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <HouseTechRateEditor
                    profileId={tech.profileId}
                    profileName={tech.profileName}
                    category={tech.defaultCategory ?? undefined}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
