
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TourPowerDefaultsSection } from "./TourPowerDefaultsSection";
import { TourWeightDefaultsSection } from "./TourWeightDefaultsSection";

interface TourPowerWeightDefaultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tour: any;
}

export const TourPowerWeightDefaultsDialog: React.FC<TourPowerWeightDefaultsDialogProps> = ({
  open,
  onOpenChange,
  tour,
}) => {
  if (!tour) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Power & Weight Defaults: {tour.name}</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="power" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="power">Power Requirements</TabsTrigger>
            <TabsTrigger value="weight">Weight Requirements</TabsTrigger>
          </TabsList>
          
          <TabsContent value="power" className="mt-6">
            <TourPowerDefaultsSection tourId={tour.id} />
          </TabsContent>
          
          <TabsContent value="weight" className="mt-6">
            <TourWeightDefaultsSection tourId={tour.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
