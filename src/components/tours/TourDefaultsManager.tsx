
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { FileText, Weight, Calculator, Trash2, Download, Calendar } from "lucide-react";
import { exportToPDF } from "@/utils/pdfExport";
import { fetchTourLogo } from "@/utils/pdf/logoUtils";
import { supabase } from "@/lib/supabase";
import { useTourPowerDefaults } from "@/hooks/useTourPowerDefaults";
import { useTourWeightDefaults } from "@/hooks/useTourWeightDefaults";

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
  const [tourDates, setTourDates] = useState<any[]>([]);

  // Fetch defaults for each department using the correct hooks
  const {
    powerDefaults: soundPowerDefaults,
    isLoading: soundPowerLoading,
    deleteDefault: deleteSoundPowerDefault
  } = useTourPowerDefaults(tour?.id || '');

  const {
    weightDefaults: soundWeightDefaults,
    isLoading: soundWeightLoading,
    deleteDefault: deleteSoundWeightDefault
  } = useTourWeightDefaults(tour?.id || '');

  // Filter by department
  const soundPowerTables = soundPowerDefaults.filter(d => d.department === 'sound' || !d.department);
  const soundWeightTables = soundWeightDefaults.filter(d => d.department === 'sound' || !d.department);
  
  const lightsPowerTables = soundPowerDefaults.filter(d => d.department === 'lights');
  const lightsWeightTables = soundWeightDefaults.filter(d => d.department === 'lights');
  
  const videoPowerTables = soundPowerDefaults.filter(d => d.department === 'video');
  const videoWeightTables = soundWeightDefaults.filter(d => d.department === 'video');

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
      let relevantDefaults;
      
      if (type === 'power') {
        relevantDefaults = department === 'sound' ? soundPowerTables : 
                          department === 'lights' ? lightsPowerTables : videoPowerTables;
      } else {
        relevantDefaults = department === 'sound' ? soundWeightTables : 
                          department === 'lights' ? lightsWeightTables : videoWeightTables;
      }

      if (relevantDefaults.length === 0) {
        toast({
          title: 'No defaults found',
          description: `No ${type} defaults found for ${department} department`,
          variant: 'destructive',
        });
        return;
      }

      // Fetch tour logo
      let logoUrl: string | undefined;
      try {
        logoUrl = await fetchTourLogo(tour.id);
      } catch (error) {
        console.error('Error fetching tour logo:', error);
      }

      // Convert to the format expected by exportToPDF
      const tables = relevantDefaults.map(defaultItem => ({
        name: defaultItem.table_name || defaultItem.item_name || 'Unnamed',
        rows: [], // Power and weight defaults don't have detailed rows in this context
        totalWeight: type === 'weight' ? (defaultItem.weight_kg || 0) * (defaultItem.quantity || 1) : undefined,
        totalWatts: type === 'power' ? defaultItem.total_watts || 0 : undefined,
        currentPerPhase: type === 'power' ? defaultItem.current_per_phase : undefined,
        pduType: type === 'power' ? defaultItem.pdu_type || defaultItem.custom_pdu_type : undefined,
        toolType: (type === 'power' ? 'consumos' : 'pesos') as 'consumos' | 'pesos',
        id: Date.now() + Math.random()
      }));

      // Calculate power summary for power exports
      let powerSummary;
      if (type === 'power') {
        const totalSystemWatts = tables.reduce((sum, table) => sum + (table.totalWatts || 0), 0);
        const totalSystemAmps = tables.reduce((sum, table) => {
          const amps = table.currentPerPhase || 0;
          return sum + amps;
        }, 0);
        powerSummary = { totalSystemWatts, totalSystemAmps };
      }

      const safetyMargin = 0; // Default safety margin

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

      // Fetch tour logo once for all exports
      let logoUrl: string | undefined;
      try {
        logoUrl = await fetchTourLogo(tour.id);
      } catch (error) {
        console.error('Error fetching tour logo:', error);
      }

      // Export one PDF per tour date
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
    // Get defaults for this department and type
    let defaultsData;
    if (type === 'power') {
      defaultsData = department === 'sound' ? soundPowerTables : 
                    department === 'lights' ? lightsPowerTables : videoPowerTables;
    } else {
      defaultsData = department === 'sound' ? soundWeightTables : 
                    department === 'lights' ? lightsWeightTables : videoWeightTables;
    }

    // Check for any overrides for this tour date
    const overrideTable = type === 'power' ? 'tour_date_power_overrides' : 'tour_date_weight_overrides';
    const { data: overrides } = await supabase
      .from(overrideTable)
      .select('*')
      .eq('tour_date_id', tourDate.id)
      .eq('department', department);

    let combinedTables;
    let safetyMargin = 0;

    // If overrides exist, use overrides, otherwise use defaults
    if (overrides && overrides.length > 0) {
      combinedTables = overrides.map((override: any) => ({
        name: override.table_name || override.item_name || 'Override',
        rows: override.override_data?.rows || [],
        totalWeight: type === 'weight' ? (override.weight_kg || 0) * (override.quantity || 1) : undefined,
        totalWatts: type === 'power' ? override.total_watts || 0 : undefined,
        currentPerPhase: type === 'power' ? override.current_per_phase : undefined,
        pduType: type === 'power' ? override.pdu_type || override.custom_pdu_type : undefined,
        toolType: (type === 'power' ? 'consumos' : 'pesos') as 'consumos' | 'pesos',
        id: Date.now() + Math.random()
      }));
      safetyMargin = overrides[0]?.override_data?.safetyMargin || 0;
    } else {
      combinedTables = defaultsData.map(defaultItem => ({
        name: defaultItem.table_name || defaultItem.item_name || 'Default',
        rows: [],
        totalWeight: type === 'weight' ? (defaultItem.weight_kg || 0) * (defaultItem.quantity || 1) : undefined,
        totalWatts: type === 'power' ? defaultItem.total_watts || 0 : undefined,
        currentPerPhase: type === 'power' ? defaultItem.current_per_phase : undefined,
        pduType: type === 'power' ? defaultItem.pdu_type || defaultItem.custom_pdu_type : undefined,
        toolType: (type === 'power' ? 'consumos' : 'pesos') as 'consumos' | 'pesos',
        id: Date.now() + Math.random()
      }));
    }

    if (combinedTables.length === 0) return;

    // Calculate power summary for power exports
    let powerSummary;
    if (type === 'power') {
      const totalSystemWatts = combinedTables.reduce((sum, table) => sum + (table.totalWatts || 0), 0);
      const totalSystemAmps = combinedTables.reduce((sum, table) => {
        const amps = table.currentPerPhase || 0;
        return sum + amps;
      }, 0);
      powerSummary = { totalSystemWatts, totalSystemAmps };
    }

    const locationName = (tourDate.locations as any)?.name || 'Unknown Location';
    const dateStr = new Date(tourDate.date).toLocaleDateString('en-GB');

    const pdfBlob = await exportToPDF(
      `${tour.name} - ${locationName} - ${department.toUpperCase()} ${type.toUpperCase()}`,
      combinedTables,
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

  const renderDepartmentDefaults = (department: string, powerTables: any[], weightTables: any[]) => {
    return (
      <div className="space-y-6">
        {/* Power Defaults */}
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
                      onClick={() => deleteSoundPowerDefault(table.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {table.total_watts.toFixed(2)} W
                  </p>
                  {table.current_per_phase && (
                    <p className="text-xs text-muted-foreground">
                      {table.current_per_phase.toFixed(2)} A per phase
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No power defaults configured</p>
          )}
        </div>

        {/* Weight Defaults */}
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
                    <h5 className="font-medium">{table.item_name}</h5>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSoundWeightDefault(table.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {((table.weight_kg || 0) * (table.quantity || 1)).toFixed(2)} kg
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {table.quantity || 1} × {(table.weight_kg || 0).toFixed(2)} kg
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
            {soundPowerLoading || soundWeightLoading ? (
              <p>Loading sound defaults...</p>
            ) : (
              renderDepartmentDefaults('sound', soundPowerTables, soundWeightTables)
            )}
          </TabsContent>
          
          <TabsContent value="lights" className="mt-6">
            {soundPowerLoading || soundWeightLoading ? (
              <p>Loading lights defaults...</p>
            ) : (
              renderDepartmentDefaults('lights', lightsPowerTables, lightsWeightTables)
            )}
          </TabsContent>
          
          <TabsContent value="video" className="mt-6">
            {soundPowerLoading || soundWeightLoading ? (
              <p>Loading video defaults...</p>
            ) : (
              renderDepartmentDefaults('video', videoPowerTables, videoWeightTables)
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
