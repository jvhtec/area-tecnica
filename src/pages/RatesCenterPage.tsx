import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RatesCenterHeader } from '@/features/rates/components/RatesCenterHeader';
import { ExtrasCatalogEditor, BaseRatesEditor } from '@/features/rates/components/CatalogEditors';
import { HouseTechOverridesPanel } from '@/features/rates/components/HouseTechOverridesPanel';
import { RatesApprovalsTable } from '@/features/rates/components/RatesApprovalsTable';
import { useRatesOverview } from '@/features/rates/hooks/useRatesOverview';
import { TourRatesManagerDialog } from '@/components/tours/TourRatesManagerDialog';
import Timesheets from '@/pages/Timesheets';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from '@/components/ui/scroll-area';

const TABS = [
  { id: 'catalogs', label: 'Catálogo de tarifas' },
  { id: 'overrides', label: 'Tarifas internas' },
  { id: 'approvals', label: 'Aprobaciones' },
  { id: 'timesheets', label: 'Partes de horas' },
] as const;

export default function RatesCenterPage() {
  const isMobile = useIsMobile();
  const { data: overview, isLoading } = useRatesOverview();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as typeof TABS[number]['id']) || 'catalogs';
  const [activeTab, setActiveTab] = useState<typeof TABS[number]['id']>(initialTab);
  const [dialogTourId, setDialogTourId] = useState<string | null>(null);

  const dialogOpen = useMemo(() => Boolean(dialogTourId), [dialogTourId]);

  // React to external changes to the URL (e.g., links setting tab=timesheets&jobId=...)
  useEffect(() => {
    const urlTab = searchParams.get('tab') as typeof TABS[number]['id'] | null;
    const jobId = searchParams.get('jobId');
    const desiredTab = (urlTab as any) || (jobId ? 'timesheets' : activeTab);
    if (desiredTab !== activeTab) {
      setActiveTab(desiredTab as typeof TABS[number]['id']);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const current = searchParams.get('tab');
    if ((current as any) !== activeTab) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', activeTab);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <div className="space-y-6 px-4 md:px-0">
      <div className="space-y-1">
        <h1 className="text-xl md:text-2xl font-semibold">Centro de Tarifas y Extras</h1>
        <p className="text-sm text-muted-foreground">
          Configura valores por defecto de gira, extras y overrides.
        </p>
      </div>

      <RatesCenterHeader overview={overview} isLoading={isLoading} />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof TABS[number]['id'])}>
        {isMobile ? (
          <ScrollArea className="w-full whitespace-nowrap">
            <TabsList className="inline-flex w-max">
              {TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="text-xs">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>
        ) : (
          <TabsList className="w-full sm:w-auto">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="flex-1 sm:flex-none">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        )}
        <TabsContent value="catalogs" className="mt-4">
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <ExtrasCatalogEditor />
            <BaseRatesEditor />
          </div>
        </TabsContent>
        <TabsContent value="overrides" className="mt-4">
          <HouseTechOverridesPanel />
        </TabsContent>
        <TabsContent value="approvals" className="mt-4">
          <RatesApprovalsTable onManageTour={setDialogTourId} />
        </TabsContent>
        <TabsContent value="timesheets" className="mt-4">
          <Timesheets />
        </TabsContent>
      </Tabs>

      {dialogTourId && (
        <TourRatesManagerDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setDialogTourId(null);
            }
          }}
          tourId={dialogTourId}
        />
      )}
    </div>
  );
}
