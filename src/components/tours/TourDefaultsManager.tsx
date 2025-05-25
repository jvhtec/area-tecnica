
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useTourDefaultSets } from "@/hooks/useTourDefaultSets";
import { useTourDateOverrides } from "@/hooks/useTourDateOverrides";
import { useToast } from "@/hooks/use-toast";
import { FileText, Weight, Calculator, Trash2, Download, Calendar } from "lucide-react";
import { exportToPDF } from "@/utils/pdfExport";
import { fetchTourLogo } from "@/utils/pdf/tourLogoUtils";
import { supabase } from "@/lib/supabase";

interface TourDefaultsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tour: any;
}

export const TourDefaultsManager = ({
  open,
  onOpenChange,
  tour,
}: TourDefaultsManagerProps) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('sound');
  const [safetyMargin, setSafetyMargin] = useState(0);
  const [tourDates, setTourDates] = useState<any[]>([]);

  // Fetch defaults for each department
  const {
    defaultSets: soundDefaultSets,
    defaultTables: soundDefaultTables,
    deleteSet: deleteSoundSet,
    isLoading: soundLoading
  } = useTourDefaultSets(tour?.id || '', 'sound');

  const {
    defaultSets: lightsDefaultSets,
    defaultTables: lightsDefaultTables,
    deleteSet: deleteLightsSet,
    isLoading: lightsLoading
  } = useTourDefaultSets(tour?.id || '', 'lights');

  const {
    defaultSets: videoDefaultSets,
    defaultTables: videoDefaultTables,
    deleteSet: deleteVideoSet,
    isLoading: videoLoading
  } = useTourDefaultSets(tour?.id || '', 'video');

  // Fetch tour dates
  React.useEffect(() => {
    const fetchTourDates = async () => {
      if (!tour?.id) return;
      
      const { data, error } = await supabase
        .from('tour_dates')
        .select(`
          id,
          date,
          locations (
            name
          )
        `)
        .eq('tour_id', tour.id)
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching tour dates:', error);
        return;
      }

      setTourDates(data || []);
    };

    fetchTourDates();
  }, [tour?.id]);

  const handleBulkPDFExport = async (department: string, type: 'power' | 'weight') => {
    try {
      const relevantTables = department === 'sound' ? soundDefaultTables : 
                            department === 'lights' ? lightsDefaultTables : videoDefaultTables;

      const filteredTables = relevantTables.filter(table => table.table_type === type);

      if (filteredTables.length === 0) {
        toast({
          title: 'No defaults found',
          description: `No ${type} defaults found for ${department} department`,
          variant: 'destructive',
        });
        return;
      }

      let logoUrl: string | undefined;
      try {
        logoUrl = await fetchTourLogo(tour.id);
      } catch (error) {
        console.error('Error fetching tour logo:', error);
      }

      const tables = filteredTables.map(table => ({
        name: table.table_name,
        rows: table.table_data.rows || [],
        totalWeight: type === 'weight' ? table.total_value : undefined,
        totalWatts: type === 'power' ? table.total_value : undefined,
        currentPerPhase: table.metadata?.currentPerPhase,
        pduType: table.metadata?.pduType,
        customPduType: table.metadata?.customPduType,
        includesHoist: table.metadata?.includesHoist,
        toolType: (type === 'power' ? 'consumos' : 'pesos') as 'consumos' | 'pesos',
        id: Date.now()
      }));

      // Calculate power summary for consumos exports
      let powerSummary;
      if (type === 'power') {
        const totalSystemWatts = tables.reduce((sum, table) => sum + (table.totalWatts || 0), 0);
        const totalSystemAmps = tables.reduce((sum, table) => sum + (table.currentPerPhase || 0) * 3, 0);
        powerSummary = { totalSystemWatts, totalSystemAmps };
      }

      const pdfBlob = await exportToPDF(
        `${tour.name} - ${department.toUpperCase()} ${type.toUpperCase()} Defaults`,
        tables,
        type,
        tour.name,
        new Date().toLocaleDateString('en-GB'),
        undefined,
        powerSummary,
        safetyMargin,
        logoUrl
      );

      const fileName = `${tour.name} - ${department} ${type} defaults.pdf`;
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

  const handleBulkTourDateExport = async (department: string, type: 'power' | 'weight') => {
    try {
      if (tourDates.length === 0) {
        toast({
          title: 'No tour dates found',
          description: 'No tour dates available for export',
          variant: 'destructive',
        });
        return;
      }

      let logoUrl: string | undefined;
      try {
        logoUrl = await fetchTourLogo(tour.id);
      } catch (error) {
        console.error('Error fetching tour logo:', error);
      }

      for (const tourDate of tourDates) {
        await exportTourDatePDF(tourDate, department, type, logoUrl);
      }

      toast({
        title: 'Success',
        description: `Exported ${tourDates.length} PDFs for all tour dates`,
      });
    } catch (error) {
      console.error('Error exporting bulk tour date PDFs:', error);
      toast({
        title: 'Error',
        description: 'Failed to export tour date PDFs',
        variant: 'destructive',
      });
    }
  };

  const exportTourDatePDF = async (tourDate: any, department: string, type: 'power' | 'weight', logoUrl?: string) => {
    // Get defaults
    const relevantTables = department === 'sound' ? soundDefaultTables : 
                          department === 'lights' ? lightsDefaultTables : videoDefaultTables;
    const defaultTables = relevantTables.filter(table => table.table_type === type);

    // Get overrides for this tour date
    const overrideTableName = type === 'power' ? 'tour_date_power_overrides' : 'tour_date_weight_overrides';
    const { data: overrides } = await supabase
      .from(overrideTableName)
      .select('*')
      .eq('tour_date_id', tourDate.id)
      .eq('department', department);

    // Create a map of overrides by table name for easy lookup
    const overrideMap = new Map();
    (overrides || []).forEach((override: any) => {
      const tableName = override.table_name || override.item_name;
      overrideMap.set(tableName, override);
    });

    // Build final tables list: prioritize overrides, fallback to defaults
    const finalTables: any[] = [];
    const processedTableNames = new Set();

    // First, add all overrides (these take priority)
    (overrides || []).forEach((override: any) => {
      const tableName = override.table_name || override.item_name;
      processedTableNames.add(tableName);
      
      finalTables.push({
        name: tableName,
        rows: override.override_data?.tableData?.rows || override.override_data?.rows || [],
        totalWeight: type === 'weight' ? override.weight_kg * (override.quantity || 1) : undefined,
        totalWatts: type === 'power' ? override.total_watts : undefined,
        currentPerPhase: type === 'power' ? override.current_per_phase : undefined,
        pduType: type === 'power' ? override.pdu_type : undefined,
        customPduType: type === 'power' ? override.custom_pdu_type : undefined,
        includesHoist: type === 'power' ? override.includes_hoist : undefined,
        toolType: (type === 'power' ? 'consumos' : 'pesos') as 'consumos' | 'pesos',
        id: Date.now() + Math.random()
      });
    });

    // Then, add defaults only if no override exists for that table
    defaultTables.forEach((defaultTable) => {
      if (!processedTableNames.has(defaultTable.table_name)) {
        finalTables.push({
          name: defaultTable.table_name,
          rows: defaultTable.table_data.rows || [],
          totalWeight: type === 'weight' ? defaultTable.total_value : undefined,
          totalWatts: type === 'power' ? defaultTable.total_value : undefined,
          currentPerPhase: defaultTable.metadata?.currentPerPhase,
          pduType: defaultTable.metadata?.pduType,
          customPduType: defaultTable.metadata?.customPduType,
          includesHoist: defaultTable.metadata?.includesHoist,
          toolType: (type === 'power' ? 'consumos' : 'pesos') as 'consumos' | 'pesos',
          id: Date.now() + Math.random()
        });
      }
    });

    if (finalTables.length === 0) return;

    // Calculate power summary for consumos exports
    let powerSummary;
    if (type === 'power') {
      const totalSystemWatts = finalTables.reduce((sum, table) => sum + (table.totalWatts || 0), 0);
      const totalSystemAmps = finalTables.reduce((sum, table) => sum + (table.currentPerPhase || 0) * 3, 0);
      powerSummary = { totalSystemWatts, totalSystemAmps };
    }

    const locationName = (tourDate.locations as any)?.name || 'Unknown Location';
    const dateStr = new Date(tourDate.date).toLocaleDateString('en-GB');

    const pdfBlob = await exportToPDF(
      `${tour.name} - ${locationName} - ${department.toUpperCase()} ${type.toUpperCase()}`,
      finalTables,
      type,
      tour.name,
      dateStr,
      undefined,
      powerSummary,
      safetyMargin,
      logoUrl
    );

    const fileName = `${tour.name} - ${dateStr} - ${locationName} - ${department} ${type}.pdf`;
    const url = window.URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Wrapper functions to handle Promise<string> to Promise<void> conversion
  const handleDeleteSoundSet = async (id: string): Promise<void> => {
    await deleteSoundSet(id);
  };

  const handleDeleteLightsSet = async (id: string): Promise<void> => {
    await deleteLightsSet(id);
  };

  const handleDeleteVideoSet = async (id: string): Promise<void> => {
    await deleteVideoSet(id);
  };

  const renderDepartmentDefaults = (department: string, sets: any[], tables: any[], deleteSet: (id: string) => Promise<void>) => {
    const powerTables = tables.filter(t => t.table_type === 'power');
    const weightTables = tables.filter(t => t.table_type === 'weight');

    return (
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <Label htmlFor="safetyMargin" className="text-sm font-medium">Safety Margin for PDF Exports</Label>
          <Select
            value={safetyMargin.toString()}
            onValueChange={(value) => setSafetyMargin(Number(value))}
          >
            <SelectTrigger className="w-full mt-1">
              <SelectValue placeholder="Select Safety Margin" />
            </SelectTrigger>
            <SelectContent>
              {[0, 10, 20, 30, 40, 50].map((percentage) => (
                <SelectItem key={percentage} value={percentage.toString()}>
                  {percentage}%
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Power Defaults ({powerTables.length})
            </h4>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkPDFExport(department, 'power')}
                disabled={powerTables.length === 0}
              >
                <FileText className="h-4 w-4 mr-1" />
                Export Defaults PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkTourDateExport(department, 'power')}
                disabled={powerTables.length === 0 || tourDates.length === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                Bulk Tour Date PDFs
              </Button>
            </div>
          </div>
          {powerTables.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {powerTables.map((table) => (
                <div key={table.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h5 className="font-medium">{table.table_name}</h5>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSet(table.set_id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {table.total_value.toFixed(2)} W
                  </p>
                  {table.metadata?.currentPerPhase && (
                    <p className="text-xs text-muted-foreground">
                      {table.metadata.currentPerPhase.toFixed(2)} A per phase
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No power defaults configured</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold flex items-center gap-2">
              <Weight className="h-5 w-5" />
              Weight Defaults ({weightTables.length})
            </h4>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkPDFExport(department, 'weight')}
                disabled={weightTables.length === 0}
              >
                <FileText className="h-4 w-4 mr-1" />
                Export Defaults PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkTourDateExport(department, 'weight')}
                disabled={weightTables.length === 0 || tourDates.length === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                Bulk Tour Date PDFs
              </Button>
            </div>
          </div>
          {weightTables.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {weightTables.map((table) => (
                <div key={table.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h5 className="font-medium">{table.table_name}</h5>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSet(table.set_id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {table.total_value.toFixed(2)} kg
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No weight defaults configured</p>
          )}
        </div>
      </div>
    );
  };

  const renderTourDatesTab = () => {
    return (
      <div className="space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Calendar className="h-5 w-5" />
            Tour Dates ({tourDates.length})
          </h3>
          <p className="text-sm text-green-700 mb-4">
            Export individual PDFs for each tour date, including both defaults and overrides.
          </p>
          
          <div className="mb-4">
            <Label htmlFor="tourDateSafetyMargin" className="text-sm font-medium">Safety Margin for Tour Date PDFs</Label>
            <Select
              value={safetyMargin.toString()}
              onValueChange={(value) => setSafetyMargin(Number(value))}
            >
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder="Select Safety Margin" />
              </SelectTrigger>
              <SelectContent>
                {[0, 10, 20, 30, 40, 50].map((percentage) => (
                  <SelectItem key={percentage} value={percentage.toString()}>
                    {percentage}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {tourDates.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {tourDates.map((tourDate) => (
              <div key={tourDate.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium">
                      {new Date(tourDate.date).toLocaleDateString('en-GB')}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {(tourDate.locations as any)?.name || 'Unknown Location'}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {['sound', 'lights', 'video'].map((dept) => (
                    <div key={dept} className="space-y-2">
                      <h5 className="text-sm font-medium capitalize">{dept}</h5>
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportTourDatePDF(tourDate, dept, 'power')}
                          className="text-xs"
                        >
                          Power PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportTourDatePDF(tourDate, dept, 'weight')}
                          className="text-xs"
                        >
                          Weight PDF
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No tour dates configured</p>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tour Defaults: {tour?.name}</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sound">Sound</TabsTrigger>
            <TabsTrigger value="lights">Lights</TabsTrigger>
            <TabsTrigger value="video">Video</TabsTrigger>
            <TabsTrigger value="tour-dates">Tour Dates</TabsTrigger>
          </TabsList>
          
          <TabsContent value="sound" className="mt-6">
            {soundLoading ? (
              <p>Loading sound defaults...</p>
            ) : (
              renderDepartmentDefaults('sound', soundDefaultSets, soundDefaultTables, handleDeleteSoundSet)
            )}
          </TabsContent>
          
          <TabsContent value="lights" className="mt-6">
            {lightsLoading ? (
              <p>Loading lights defaults...</p>
            ) : (
              renderDepartmentDefaults('lights', lightsDefaultSets, lightsDefaultTables, handleDeleteLightsSet)
            )}
          </TabsContent>
          
          <TabsContent value="video" className="mt-6">
            {videoLoading ? (
              <p>Loading video defaults...</p>
            ) : (
              renderDepartmentDefaults('video', videoDefaultSets, videoDefaultTables, handleDeleteVideoSet)
            )}
          </TabsContent>

          <TabsContent value="tour-dates" className="mt-6">
            {renderTourDatesTab()}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
