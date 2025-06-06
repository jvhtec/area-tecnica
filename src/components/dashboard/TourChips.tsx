import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { TourDateManagementDialog } from "../tours/TourDateManagementDialog";
import { TourCard } from "../tours/TourCard";
import CreateTourDialog from "../tours/CreateTourDialog";
import { toast } from "@/hooks/use-toast";
import { exportTourPDF } from "@/lib/tourPdfExport";
import { BulkTourFolderActions } from "../tours/BulkTourFolderActions";
import { useTourSubscription } from "@/hooks/useTourSubscription";

interface TourChipsProps {
  onTourClick: (tourId: string) => void;
}

export const TourChips = ({ onTourClick }: TourChipsProps) => {
  const [selectedTourId, setSelectedTourId] = useState<string | null>(null);
  const [isDatesDialogOpen, setIsDatesDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Set up realtime subscription for tours
  useTourSubscription();

  const { data: tours = [], refetch: refetchTours } = useQuery({
    queryKey: ["tours"],
    queryFn: async () => {
      console.log("Fetching tours...");
      const { data: toursData, error: toursError } = await supabase
        .from("tours")
        .select(`
          id,
          name,
          description,
          start_date,
          end_date,
          color,
          flex_folders_created,
          flex_main_folder_id,
          tour_dates (
            id,
            date,
            location:locations (name)
          )
        `)
        .order("created_at", { ascending: false })
        .eq("deleted", false);

      if (toursError) {
        console.error("Error fetching tours:", toursError);
        throw toursError;
      }

      console.log("Tours fetched successfully:", toursData);
      return toursData;
    },
  });

  const handleManageDates = (tourId: string) => {
    setSelectedTourId(tourId);
    setIsDatesDialogOpen(true);
  };

  const handlePrint = async (tour: any) => {
    try {
      console.log("Starting PDF export for tour:", tour.name);
      
      if (!tour.tour_dates || tour.tour_dates.length === 0) {
        toast({
          title: "Error",
          description: "No tour dates available to print",
          variant: "destructive"
        });
        return;
      }

      await exportTourPDF(tour);

      toast({
        title: "Success",
        description: "Tour schedule exported successfully"
      });
    } catch (error: any) {
      console.error("Error exporting PDF:", error);
      toast({
        title: "Error",
        description: "Failed to export PDF: " + (error.message || "Unknown error"),
        variant: "destructive"
      });
    }
  };

  const getSortedTourDates = (tourId: string) => {
    const tour = tours.find((t: any) => t.id === tourId);
    if (!tour?.tour_dates) return [];
    
    return [...tour.tour_dates].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Tour
        </Button>
      </div>

      <BulkTourFolderActions 
        tours={tours} 
        onRefresh={() => refetchTours()} 
      />

      <div className="flex flex-wrap gap-4">
        {tours.map((tour: any) => (
          <div
            key={tour.id}
            className="w-full sm:w-[calc(50%-1rem)] md:w-[calc(33.33%-1rem)] lg:w-[calc(25%-1rem)]"
          >
            <TourCard
              tour={tour}
              onManageDates={() => handleManageDates(tour.id)}
              onPrint={() => handlePrint(tour)}
            />
          </div>
        ))}
      </div>

      {selectedTourId && (
        <TourDateManagementDialog
          open={isDatesDialogOpen}
          onOpenChange={setIsDatesDialogOpen}
          tourId={selectedTourId}
          tourDates={getSortedTourDates(selectedTourId)}
        />
      )}

      <CreateTourDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        currentDepartment="sound"
      />
    </div>
  );
};
