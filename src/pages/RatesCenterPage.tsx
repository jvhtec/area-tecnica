import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RatesCenterHeader } from '@/features/rates/components/RatesCenterHeader';
import { ExtrasCatalogEditor, BaseRatesEditor } from '@/features/rates/components/CatalogEditors';
import { HouseTechOverridesPanel } from '@/features/rates/components/HouseTechOverridesPanel';
import { RatesApprovalsTable } from '@/features/rates/components/RatesApprovalsTable';
import { useRatesOverview } from '@/features/rates/hooks/useRatesOverview';
import { TourRatesManagerDialog } from '@/components/tours/TourRatesManagerDialog';

const TABS = [
  { id: 'catalogs', label: 'Rate catalogs' },
  { id: 'overrides', label: 'House overrides' },
  { id: 'approvals', label: 'Approvals' },
] as const;

export default function RatesCenterPage() {
  const { data: overview, isLoading } = useRatesOverview();
  const [activeTab, setActiveTab] = useState<typeof TABS[number]['id']>('catalogs');
  const [dialogTourId, setDialogTourId] = useState<string | null>(null);

  const dialogOpen = useMemo(() => Boolean(dialogTourId), [dialogTourId]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Rates &amp; Extras Center</h1>
        <p className="text-sm text-muted-foreground">
          Configure tour defaults, extras, and house overrides from a single management hub.
        </p>
      </div>

      <RatesCenterHeader overview={overview} isLoading={isLoading} />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof TABS[number]['id'])}>
        <TabsList className="w-full sm:w-auto">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="flex-1 sm:flex-none">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="catalogs" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
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
