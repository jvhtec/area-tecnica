import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { HouseTechRateEditor } from '@/components/settings/HouseTechRateEditor';
import { useRatesHouseTechList } from '@/features/rates/hooks/useRatesHouseTechList';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';

function getFormattedDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return format(parsed, 'PPP');
}

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
          <span>House tech overrides</span>
          <Input
            placeholder="Search house techs"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="sm:w-64"
          />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-32 w-full" />}
        {!isLoading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">No house techs found with that name.</p>
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
                        Default category: {tech.defaultCategory ?? '—'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {tech.overrideBaseDay ? (
                        <Badge variant="secondary">Override: {formatCurrency(tech.overrideBaseDay)}</Badge>
                      ) : (
                        <Badge variant="outline">Using default</Badge>
                      )}
                      {getFormattedDate(tech.overrideUpdatedAt) && (
                        <span className="text-xs text-muted-foreground">
                          Updated {getFormattedDate(tech.overrideUpdatedAt)}
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
