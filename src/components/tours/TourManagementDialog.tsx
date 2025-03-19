
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TourColorSection } from "./TourColorSection";
import { TourDeleteSection } from "./TourDeleteSection";
import { useTourManagement } from "./hooks/useTourManagement";
import { TourLogoManager } from "./TourLogoManager";

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
  const { handleColorChange, handleNameChange, handleDelete } = useTourManagement(tour, () => onOpenChange(false));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Tour: {tour.name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="border-b pb-4">
            <h3 className="text-sm font-medium mb-3">Tour Logo</h3>
            <TourLogoManager tourId={tour.id} />
          </div>
          
          <TourColorSection 
            color={tour.color} 
            tourName={tour.name}
            onColorChange={handleColorChange}
            onNameChange={handleNameChange}
          />
          <TourDeleteSection onDelete={handleDelete} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
