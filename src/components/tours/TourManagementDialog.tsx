
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TourColorSection } from "./TourColorSection";
import { TourDeleteSection } from "./TourDeleteSection";
import TourDefaultsManager from "./TourDefaultsManager";
import { useTourManagement } from "./hooks/useTourManagement";
import { TourLogoManager } from "./TourLogoManager";
import { useNavigate } from "react-router-dom";
import { Calculator, Weight, Settings } from "lucide-react";
import { useState } from "react";
import { useTourDates } from "./hooks/useTourDates";

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
  const { handleColorChange, handleNameChange, handleDelete } = useTourManagement(tour, () => onOpenChange(false));
  const [defaultsManagerOpen, setDefaultsManagerOpen] = useState(false);
  const { data: tourDates = [] } = useTourDates(tour?.id);

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
              <TourColorSection 
                color={tour.color} 
                tourName={tour.name}
                onColorChange={handleColorChange}
                onNameChange={handleNameChange}
              />
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

      <Dialog open={defaultsManagerOpen} onOpenChange={setDefaultsManagerOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tour Defaults & Export Manager</DialogTitle>
          </DialogHeader>
          <TourDefaultsManager
            tourId={tour.id}
            tourName={tour.name}
            tourDates={tourDates}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
