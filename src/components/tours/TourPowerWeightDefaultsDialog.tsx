
import React from "react";
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@/components/ui/responsive-dialog";
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
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Power & Weight Defaults: {tour.name}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        
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
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
};
