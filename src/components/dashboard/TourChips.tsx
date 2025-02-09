import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { TourDateManagementDialog } from "../tours/TourDateManagementDialog";
import { TourCard } from "../tours/TourCard";
import CreateTourDialog from "../tours/CreateTourDialog";
import { useToast } from "@/hooks/use-toast";
import { exportTourPDF } from "@/lib/tourPdfExport";

interface TourChipsProps {
  onTourClick: (tourId: string) => void;
}

export const TourChips = ({ onTourClick }: TourChipsProps) => {
  const [selectedTourId, setSelectedTourId] = useState<string | null>(null);
  const [isDatesDialogOpen, setIsDatesDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: tours = [] } = useQuery({
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
          variant: "destructive",
        });
        return;
      }

      const rows = tour.tour_dates.map((td: any) => ({
        date: new Date(td.date).toLocaleDateString(),
        location: td.location?.name || "TBD",
      }));

      const start = tour.start_date ? new Date(tour.start_date).toLocaleDateString() : "TBD";
      const end = tour.end_date ? new Date(tour.end_date).toLocaleDateString() : "TBD";
      const dateSpan = `${start} - ${end}`;

      console.log("Generating PDF with:", {
        tourName: tour.name,
        dateSpan,
        rows: rows
      });

      const pdfBlob = await exportTourPDF(
        tour.name,
        dateSpan,
        rows
      );
      
      console.log("PDF generated successfully, creating download URL");
      const url = URL.createObjectURL(pdfBlob);
      
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `${tour.name} - Schedule.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Tour schedule exported successfully",
      });
    } catch (error: any) {
      console.error("Error exporting PDF:", error);
      toast({
        title: "Error",
        description: "Failed to export PDF: " + (error.message || "Unknown error"),
        variant: "destructive",
      });
    }
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

      <div className="flex flex-wrap gap-4">
        {tours.map((tour: any) => (
          <div
            key={tour.id}
            className="w-full sm:w-[calc(50%-1rem)] md:w-[calc(33.33%-1rem)] lg:w-[calc(25%-1rem)]"
          >
            <TourCard
              tour={tour}
              onTourClick={() => onTourClick(tour.id)}
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
          tourDates={tours.find((t: any) => t.id === selectedTourId)?.tour_dates || []}
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