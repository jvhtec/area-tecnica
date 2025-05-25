import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { exportToPDF } from '@/utils/pdfExport';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface TourDate {
  id: string;
  date: string;
  location_id: string;
  locations: {
    name: string;
  };
}

interface TourDefaultsManagerProps {
  tourId: string;
  tourName: string;
  tourDates: TourDate[];
}

const TourDefaultsManager: React.FC<TourDefaultsManagerProps> = ({
  tourId,
  tourName,
  tourDates
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('defaults');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [totalExports, setTotalExports] = useState(0);

  const exportTourDatePDF = async (tourDate: TourDate) => {
    try {
      // Check for overrides first
      const [powerOverrides, weightOverrides] = await Promise.all([
        supabase
          .from('tour_date_power_overrides')
          .select('*')
          .eq('tour_date_id', tourDate.id),
        supabase
          .from('tour_date_weight_overrides')
          .select('*')
          .eq('tour_date_id', tourDate.id)
      ]);

      const hasOverrides = (powerOverrides.data?.length || 0) > 0 || (weightOverrides.data?.length || 0) > 0;

      let tables: any[] = [];
      let summaryRows: any[] = [];

      if (hasOverrides) {
        // Use only overrides, no defaults
        const powerTables = powerOverrides.data?.map(override => ({
          name: override.table_name,
          rows: override.override_data?.rows || [],
          totalWatts: override.total_watts,
          currentPerPhase: override.current_per_phase,
          pduType: override.pdu_type,
          customPduType: override.custom_pdu_type,
          includesHoist: override.includes_hoist,
          toolType: 'consumos' as const
        })) || [];

        const weightTables = weightOverrides.data?.map(override => ({
          name: override.item_name,
          rows: override.override_data?.tableData?.rows || [{
            quantity: override.quantity.toString(),
            componentName: override.item_name,
            weight: (override.weight_kg / override.quantity).toString(),
            totalWeight: override.weight_kg
          }],
          totalWeight: override.weight_kg,
          toolType: 'pesos' as const
        })) || [];

        tables = [...powerTables, ...weightTables];

        // Generate summary for weight tables
        if (weightTables.length > 0) {
          summaryRows = weightTables.map(table => ({
            clusterName: table.name,
            riggingPoints: 'SX01', // Default rigging point for overrides
            clusterWeight: table.totalWeight || 0
          }));
        }
      } else {
        // Use defaults if no overrides exist
        const defaultTables = await supabase
          .from('tour_default_tables')
          .select(`
            *,
            tour_default_sets!inner(tour_id, department)
          `)
          .eq('tour_default_sets.tour_id', tourId);

        if (defaultTables.data) {
          const powerDefaults = defaultTables.data
            .filter(table => table.table_type === 'power')
            .map(table => ({
              name: table.table_name,
              rows: table.table_data?.rows || [],
              totalWatts: table.total_value,
              currentPerPhase: table.metadata?.currentPerPhase,
              pduType: table.metadata?.pduType,
              customPduType: table.metadata?.customPduType,
              includesHoist: table.metadata?.includesHoist,
              toolType: 'consumos' as const
            }));

          const weightDefaults = defaultTables.data
            .filter(table => table.table_type === 'weight')
            .map(table => ({
              name: table.table_name,
              rows: table.table_data?.rows || [],
              totalWeight: table.total_value,
              toolType: 'pesos' as const
            }));

          tables = [...powerDefaults, ...weightDefaults];

          // Generate summary for weight defaults
          if (weightDefaults.length > 0) {
            summaryRows = weightDefaults.map((table, index) => ({
              clusterName: table.name,
              riggingPoints: `SX${String(index + 1).padStart(2, '0')}`,
              clusterWeight: table.totalWeight || 0
            }));
          }
        }
      }

      if (tables.length === 0) {
        toast({
          title: 'No data available',
          description: 'No tables found for this tour date',
          variant: 'destructive',
        });
        return;
      }

      // Determine report type
      const hasWeightTables = tables.some(t => t.toolType === 'pesos');
      const hasPowerTables = tables.some(t => t.toolType === 'consumos');
      const reportType = hasWeightTables && !hasPowerTables ? 'weight' : 'power';

      // Load tour logo
      let logoUrl: string | undefined;
      try {
        const { fetchTourLogo } = await import('@/utils/pdf/logoUtils');
        logoUrl = await fetchTourLogo(tourId);
      } catch (error) {
        console.error('Error loading tour logo:', error);
      }

      // Generate PDF
      const pdfBlob = await exportToPDF(
        `${tourName} - ${new Date(tourDate.date).toLocaleDateString()}`,
        tables,
        reportType,
        `${tourName} - ${new Date(tourDate.date).toLocaleDateString()}`,
        tourDate.date,
        summaryRows.length > 0 ? summaryRows : undefined,
        undefined,
        0, // Safety margin - could be made configurable
        logoUrl
      );

      // Download the PDF
      const fileName = `${tourName} - ${new Date(tourDate.date).toLocaleDateString()} - Report.pdf`;
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Success',
        description: 'PDF exported successfully',
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to export PDF',
        variant: 'destructive',
      });
    }
  };

  const exportAllPDFs = async () => {
    if (tourDates.length === 0) {
      toast({
        title: 'No tour dates',
        description: 'There are no tour dates to export',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    setTotalExports(tourDates.length);

    try {
      for (let i = 0; i < tourDates.length; i++) {
        await exportTourDatePDF(tourDates[i]);
        setExportProgress(i + 1);
      }

      toast({
        title: 'Export complete',
        description: `Successfully exported ${tourDates.length} PDFs`,
      });
    } catch (error) {
      console.error('Error during bulk export:', error);
      toast({
        title: 'Export error',
        description: 'Some PDFs failed to export',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const deleteTourDefaults = async () => {
    try {
      // First get all default sets for this tour
      const { data: defaultSets, error: setsError } = await supabase
        .from('tour_default_sets')
        .select('id')
        .eq('tour_id', tourId);

      if (setsError) throw setsError;
      if (!defaultSets || defaultSets.length === 0) {
        toast({
          title: 'No defaults',
          description: 'No default sets found for this tour',
        });
        return;
      }

      // Delete all default sets (cascade will delete tables)
      const { error: deleteError } = await supabase
        .from('tour_default_sets')
        .delete()
        .eq('tour_id', tourId);

      if (deleteError) throw deleteError;

      toast({
        title: 'Success',
        description: 'All tour defaults have been deleted',
      });
    } catch (error) {
      console.error('Error deleting tour defaults:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete tour defaults',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Tour Defaults & Overrides</CardTitle>
        <CardDescription>
          Manage default settings and overrides for this tour
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="defaults">Defaults</TabsTrigger>
            <TabsTrigger value="overrides">Date Overrides</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>
          
          <TabsContent value="defaults" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium">Default Settings</h3>
                <p className="text-sm text-muted-foreground">
                  These settings will apply to all tour dates unless overridden
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete All Defaults
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all default settings for this tour.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteTourDefaults}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="h-auto py-6 flex flex-col items-center justify-center"
                onClick={() => window.location.href = `/sound/pesos?tourId=${tourId}&mode=defaults`}
              >
                <div className="text-lg font-medium">Sound Weight Defaults</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Configure default weight settings for sound equipment
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto py-6 flex flex-col items-center justify-center"
                onClick={() => window.location.href = `/sound/consumos?tourId=${tourId}&mode=defaults`}
              >
                <div className="text-lg font-medium">Sound Power Defaults</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Configure default power requirements for sound equipment
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto py-6 flex flex-col items-center justify-center"
                onClick={() => window.location.href = `/lights/pesos?tourId=${tourId}&mode=defaults`}
              >
                <div className="text-lg font-medium">Lights Weight Defaults</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Configure default weight settings for lighting equipment
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto py-6 flex flex-col items-center justify-center"
                onClick={() => window.location.href = `/lights/consumos?tourId=${tourId}&mode=defaults`}
              >
                <div className="text-lg font-medium">Lights Power Defaults</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Configure default power requirements for lighting equipment
                </div>
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="overrides" className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Date-Specific Overrides</h3>
              <p className="text-sm text-muted-foreground">
                Create overrides for specific tour dates when requirements differ from defaults
              </p>
            </div>
            
            <div className="border rounded-md">
              <div className="bg-muted px-4 py-2 border-b">
                <div className="grid grid-cols-3 gap-4 font-medium">
                  <div>Date</div>
                  <div>Location</div>
                  <div>Actions</div>
                </div>
              </div>
              
              <div className="divide-y">
                {tourDates.length > 0 ? (
                  tourDates.map((date) => (
                    <div key={date.id} className="px-4 py-3">
                      <div className="grid grid-cols-3 gap-4">
                        <div>{new Date(date.date).toLocaleDateString()}</div>
                        <div>{date.locations?.name || 'Unknown location'}</div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.location.href = `/sound/pesos?tourId=${tourId}&tourDateId=${date.id}`}
                          >
                            Sound Weight
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.location.href = `/sound/consumos?tourId=${tourId}&tourDateId=${date.id}`}
                          >
                            Sound Power
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-muted-foreground">
                    No tour dates found. Add dates to the tour first.
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="export" className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Export Reports</h3>
              <p className="text-sm text-muted-foreground">
                Generate PDF reports for all tour dates
              </p>
            </div>
            
            <div className="flex flex-col gap-4">
              <Button 
                onClick={exportAllPDFs} 
                disabled={isExporting}
                className="w-full sm:w-auto"
              >
                <FileText className="h-4 w-4 mr-2" />
                {isExporting ? `Exporting (${exportProgress}/${totalExports})` : 'Export All Date Reports'}
              </Button>
              
              <div className="border rounded-md">
                <div className="bg-muted px-4 py-2 border-b">
                  <div className="grid grid-cols-3 gap-4 font-medium">
                    <div>Date</div>
                    <div>Location</div>
                    <div>Actions</div>
                  </div>
                </div>
                
                <div className="divide-y">
                  {tourDates.length > 0 ? (
                    tourDates.map((date) => (
                      <div key={date.id} className="px-4 py-3">
                        <div className="grid grid-cols-3 gap-4">
                          <div>{new Date(date.date).toLocaleDateString()}</div>
                          <div>{date.locations?.name || 'Unknown location'}</div>
                          <div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => exportTourDatePDF(date)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Export PDF
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      No tour dates found. Add dates to the tour first.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default TourDefaultsManager;
