
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTourDefaultSets } from "@/hooks/useTourDefaultSets";
import { useToast } from "@/hooks/use-toast";
import { FileText, Weight, Calculator, Trash2 } from "lucide-react";
import { exportToPDF } from "@/utils/pdfExport";

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
  const [activeTab, setActiveTab] = useState('power');

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

  const handleBulkPDFExport = async (department: string, type: 'power' | 'weight') => {
    try {
      const relevantSets = department === 'sound' ? soundDefaultSets : 
                          department === 'lights' ? lightsDefaultSets : videoDefaultSets;
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

      // Convert to the format expected by exportToPDF
      const tables = filteredTables.map(table => ({
        name: table.table_name,
        rows: table.table_data.rows || [],
        totalWeight: type === 'weight' ? table.total_value : undefined,
        totalWatts: type === 'power' ? table.total_value : undefined,
        currentPerPhase: table.metadata?.currentPerPhase,
        pduType: table.metadata?.pduType,
        toolType: table.table_data.toolType || (type === 'power' ? 'consumos' : 'pesos'),
        id: Date.now()
      }));

      const pdfBlob = await exportToPDF(
        `${tour.name} - ${department.toUpperCase()} ${type.toUpperCase()} Defaults`,
        tables,
        type,
        tour.name,
        new Date().toLocaleDateString('en-GB'),
        undefined,
        undefined,
        0
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

  const renderDepartmentDefaults = (department: string, sets: any[], tables: any[], deleteSet: (id: string) => Promise<void>) => {
    const powerTables = tables.filter(t => t.table_type === 'power');
    const weightTables = tables.filter(t => t.table_type === 'weight');

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
                Export Power PDF
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
                Export Weight PDF
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tour Defaults: {tour?.name}</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sound">Sound</TabsTrigger>
            <TabsTrigger value="lights">Lights</TabsTrigger>
            <TabsTrigger value="video">Video</TabsTrigger>
          </TabsList>
          
          <TabsContent value="sound" className="mt-6">
            {soundLoading ? (
              <p>Loading sound defaults...</p>
            ) : (
              renderDepartmentDefaults('sound', soundDefaultSets, soundDefaultTables, deleteSoundSet)
            )}
          </TabsContent>
          
          <TabsContent value="lights" className="mt-6">
            {lightsLoading ? (
              <p>Loading lights defaults...</p>
            ) : (
              renderDepartmentDefaults('lights', lightsDefaultSets, lightsDefaultTables, deleteLightsSet)
            )}
          </TabsContent>
          
          <TabsContent value="video" className="mt-6">
            {videoLoading ? (
              <p>Loading video defaults...</p>
            ) : (
              renderDepartmentDefaults('video', videoDefaultSets, videoDefaultTables, deleteVideoSet)
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
