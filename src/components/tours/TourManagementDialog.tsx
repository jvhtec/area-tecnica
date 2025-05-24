
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TourColorSection } from "./TourColorSection";
import { TourDeleteSection } from "./TourDeleteSection";
import { useTourManagement } from "./hooks/useTourManagement";
import { TourLogoManager } from "./TourLogoManager";
import { useNavigate } from "react-router-dom";
import { Calculator, Weight } from "lucide-react";

interface TourManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tour: any;
}

export const TourManagementDialog = ({
  open,
  onOpenChange,
  tour,
}: TourManagementDialogProps) => {
  const navigate = useNavigate();
  const { handleColorChange, handleNameChange, handleDelete } = useTourManagement(tour, () => onOpenChange(false));

  const handlePowerDefaults = () => {
    // Navigate to ConsumosTool with tour context
    navigate(`/sound/consumos?tourId=${tour.id}&mode=defaults`);
    onOpenChange(false);
  };

  const handleWeightDefaults = () => {
    // Navigate to PesosTool with tour context
    navigate(`/sound/pesos?tourId=${tour.id}&mode=defaults`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Tour: {tour.name}</DialogTitle>
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
            <h3 className="text-sm font-medium mb-3">Tour Defaults</h3>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={handlePowerDefaults}
                className="flex items-center gap-2"
              >
                <Calculator className="h-4 w-4" />
                Set Power Defaults
              </Button>
              <Button
                variant="outline"
                onClick={handleWeightDefaults}
                className="flex items-center gap-2"
              >
                <Weight className="h-4 w-4" />
                Set Weight Defaults
              </Button>
            </div>
          </div>
          
          <TourDeleteSection onDelete={handleDelete} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
