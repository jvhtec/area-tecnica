
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TourColorSection } from "./TourColorSection";
import { TourDeleteSection } from "./TourDeleteSection";
import { TourDefaultsManager } from "./TourDefaultsManager";
import { useTourManagement } from "./hooks/useTourManagement";
import { TourLogoManager } from "./TourLogoManager";
import { useNavigate } from "react-router-dom";
import { Calculator, Weight, Settings, Package, XCircle, CheckCircle } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface TourManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tour: any;
  tourDateId?: string; // Add optional tour date ID for override mode
}

export const TourManagementDialog = ({
  open,
  onOpenChange,
  tour,
  tourDateId,
}: TourManagementDialogProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { handleColorChange, handleNameChange, handleDescriptionChange, handleDelete } = useTourManagement(tour, () => onOpenChange(false));
  const [defaultsManagerOpen, setDefaultsManagerOpen] = useState(false);
  const [isUpdatingTourPack, setIsUpdatingTourPack] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const handlePowerDefaults = () => {
    // Navigate to ConsumosTool with tour context
    const params = new URLSearchParams({
      tourId: tour.id,
      mode: tourDateId ? 'override' : 'defaults'
    });
    
    if (tourDateId) {
      params.append('tourDateId', tourDateId);
    }
    
    navigate(`/sound/consumos?${params.toString()}`);
    onOpenChange(false);
  };

  const handleWeightDefaults = () => {
    // Navigate to PesosTool with tour context
    const params = new URLSearchParams({
      tourId: tour.id,
      mode: tourDateId ? 'override' : 'defaults'
    });
    
    if (tourDateId) {
      params.append('tourDateId', tourDateId);
    }
    
    navigate(`/sound/pesos?${params.toString()}`);
    onOpenChange(false);
  };

  const handleManageDefaults = () => {
    setDefaultsManagerOpen(true);
  };

  const handleBulkTourPackUpdate = async (tourPackOnly: boolean) => {
    setIsUpdatingTourPack(true);
    try {
      const { error } = await supabase
        .from("tour_dates")
        .update({ is_tour_pack_only: tourPackOnly })
        .eq("tour_id", tour.id);

      if (error) throw error;

      // Refresh tour data
      await queryClient.invalidateQueries({ queryKey: ["tour", tour.id] });
      await queryClient.invalidateQueries({ queryKey: ["tours"] });

      toast({
        title: "Success",
        description: `All tour dates ${tourPackOnly ? 'set to' : 'removed from'} Tour Pack Only mode.`,
      });
    } catch (error: any) {
      console.error("Error updating tour dates:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingTourPack(false);
    }
  };

  const handleToggleTourStatus = async () => {
    const newStatus = tour.status === 'active' ? 'cancelled' : 'active';
    const actionWord = newStatus === 'cancelled' ? 'cancel' : 'reactivate';
    
    setIsUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('tours')
        .update({ status: newStatus })
        .eq('id', tour.id);

      if (error) throw error;

      // Refresh tour data
      await queryClient.invalidateQueries({ queryKey: ["tour", tour.id] });
      await queryClient.invalidateQueries({ queryKey: ["tours"] });

      toast({
        title: "Success",
        description: `Tour ${actionWord}ed successfully`,
      });
    } catch (error: any) {
      console.error(`Error ${actionWord}ing tour:`, error);
      toast({
        title: "Error",
        description: `Failed to ${actionWord} tour: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Manage Tour: {tour.name}
              {tourDateId && <span className="text-sm text-muted-foreground ml-2">(Override Mode)</span>}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="border-b pb-4">
              <h3 className="text-sm font-medium mb-3">Tour Logo</h3>
              <TourLogoManager tourId={tour.id} />
            </div>
            
            <div className="border-b pb-4">
              <h3 className="text-sm font-medium mb-3">Tour Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    {tour.status === 'cancelled' ? (
                      <>
                        <XCircle className="h-4 w-4 text-red-600" />
                        <div>
                          <p className="text-sm font-medium">Tour Cancelled</p>
                          <p className="text-xs text-muted-foreground">This tour is hidden from main views</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="text-sm font-medium">Tour Active</p>
                          <p className="text-xs text-muted-foreground">This tour is visible in all views</p>
                        </div>
                      </>
                    )}
                  </div>
                  <Button
                    variant={tour.status === 'cancelled' ? 'default' : 'destructive'}
                    size="sm"
                    onClick={handleToggleTourStatus}
                    disabled={isUpdatingStatus}
                  >
                    {isUpdatingStatus ? (
                      'Updating...'
                    ) : tour.status === 'cancelled' ? (
                      'Reactivate Tour'
                    ) : (
                      'Mark as Not Happening'
                    )}
                  </Button>
                </div>
                {tour.status === 'cancelled' && (
                  <Badge variant="destructive" className="text-xs">
                    <XCircle className="h-3 w-3 mr-1" />
                    This tour and its dates are hidden from main views
                  </Badge>
                )}
              </div>
            </div>

            <div className="border-b pb-4">
              <TourColorSection 
                color={tour.color} 
                tourName={tour.name}
                tourDescription={tour.description}
                onColorChange={handleColorChange}
                onNameChange={handleNameChange}
                onDescriptionChange={handleDescriptionChange}
              />
            </div>

            <div className="border-b pb-4">
              <h3 className="text-sm font-medium mb-3">Tour Pack Settings</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium">Bulk Tour Pack Mode</p>
                      <p className="text-xs text-muted-foreground">Set all dates in this tour to Tour Pack Only</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkTourPackUpdate(true)}
                      disabled={isUpdatingTourPack}
                    >
                      Enable All
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkTourPackUpdate(false)}
                      disabled={isUpdatingTourPack}
                    >
                      Disable All
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-b pb-4">
              <h3 className="text-sm font-medium mb-3">
                {tourDateId ? 'Tour Date Overrides' : 'Tour Defaults'}
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <Button
                  variant="outline"
                  onClick={handleManageDefaults}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Manage All Defaults & Export PDFs
                </Button>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={handlePowerDefaults}
                    className="flex items-center gap-2"
                  >
                    <Calculator className="h-4 w-4" />
                    {tourDateId ? 'Override Power' : 'Set Power Defaults'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleWeightDefaults}
                    className="flex items-center gap-2"
                  >
                    <Weight className="h-4 w-4" />
                    {tourDateId ? 'Override Weight' : 'Set Weight Defaults'}
                  </Button>
                </div>
              </div>
            </div>
            
            <TourDeleteSection onDelete={handleDelete} />
          </div>
        </DialogContent>
      </Dialog>

      <TourDefaultsManager
        open={defaultsManagerOpen}
        onOpenChange={setDefaultsManagerOpen}
        tour={tour}
      />
    </>
  );
};
