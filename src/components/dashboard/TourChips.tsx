import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Plus, Eye, EyeOff, ChevronDown, ChevronUp, MoreVertical } from "lucide-react";
import { useMemo, useState } from "react";
import { TourDateManagementDialog } from "../tours/TourDateManagementDialog";
import { TourCard } from "../tours/TourCard";
import CreateTourDialog from "../tours/CreateTourDialog";
import { toast } from "@/hooks/use-toast";
import { exportTourPDF } from "@/lib/tourPdfExport";
import { BulkTourFolderActions } from "../tours/BulkTourFolderActions";
import { useTourSubscription } from "@/hooks/useTourSubscription";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface TourChipsProps {
  onTourClick: (tourId: string) => void;
}

export const TourChips = ({ onTourClick }: TourChipsProps) => {
  const [selectedTourId, setSelectedTourId] = useState<string | null>(null);
  const [isDatesDialogOpen, setIsDatesDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showCompletedTours, setShowCompletedTours] = useState(false);
  const [showLegacyDisclaimer, setShowLegacyDisclaimer] = useState(true);
  const [isMobileActionsOpen, setIsMobileActionsOpen] = useState(false);
  const isMobile = useIsMobile();

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
          status,
          flex_folders_created,
          flex_main_folder_id,
          tour_dates (
            id,
            date,
            location:locations (name)
          )
        `)
        .order("created_at", { ascending: false })
        .eq("deleted", false)
        .eq("status", "active");

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

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const sortedTourDatesById = useMemo(() => {
    const map = new Map<string, any[]>();
    tours.forEach((tour: any) => {
      if (!tour?.tour_dates) return;
      const sortedDates = [...tour.tour_dates].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      map.set(tour.id, sortedDates);
    });
    return map;
  }, [tours]);

  const getSortedTourDates = (tourId: string) => {
    return sortedTourDatesById.get(tourId) || [];
  };

  // Filter tours based on completion status
  const activeTours = useMemo(() => tours.filter((tour: any) => {
    if (!tour.end_date) return true; // Tours without end_date are considered active
    const endDate = new Date(tour.end_date);
    endDate.setHours(0, 0, 0, 0);
    return endDate >= today;
  }), [today, tours]);

  const completedTours = useMemo(() => tours.filter((tour: any) => {
    if (!tour.end_date) return false;
    const endDate = new Date(tour.end_date);
    endDate.setHours(0, 0, 0, 0);
    return endDate < today;
  }), [today, tours]);

  const displayedTours = showCompletedTours ? tours : activeTours;
  
  // Find tours that need root folders from all tours
  const toursNeedingRootFolders = tours.filter((tour: any) => !tour.flex_folders_created);

  return (
    <div className="space-y-4">
      {/* Mobile: Stack actions vertically, Desktop: Horizontal layout */}
      <div className="flex flex-col md:flex-row gap-3 md:justify-between md:items-center">
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="flex items-center gap-2 w-full md:w-auto touch-manipulation"
          size={isMobile ? "default" : "default"}
        >
          <Plus className="h-4 w-4" />
          Create Tour
        </Button>
        
        {/* Desktop: Show completed tours filter inline */}
        {!isMobile && completedTours.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {completedTours.length} completed
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCompletedTours(!showCompletedTours)}
              className="flex items-center gap-2"
            >
              {showCompletedTours ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  <span className="hidden sm:inline">Hide Completed</span>
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  <span className="hidden sm:inline">Show Completed ({completedTours.length})</span>
                </>
              )}
            </Button>
          </div>
        )}
        
        {/* Mobile: Show completed tours filter in sheet */}
        {isMobile && completedTours.length > 0 && (
          <Sheet open={isMobileActionsOpen} onOpenChange={setIsMobileActionsOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center gap-2 w-full touch-manipulation"
              >
                <MoreVertical className="h-4 w-4" />
                View Options ({completedTours.length} completed)
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto max-h-[40vh]">
              <SheetHeader>
                <SheetTitle>Tour Options</SheetTitle>
              </SheetHeader>
              <div className="grid gap-3 pt-4">
                <div
                  className="flex items-center justify-between p-3 hover:bg-accent rounded-md cursor-pointer transition-colors"
                  onClick={() => {
                    setShowCompletedTours(!showCompletedTours);
                    setIsMobileActionsOpen(false);
                  }}
                >
                  <div className="flex items-center gap-3">
                    {showCompletedTours ? (
                      <>
                        <EyeOff className="h-5 w-5" />
                        <span>Hide Completed Tours</span>
                      </>
                    ) : (
                      <>
                        <Eye className="h-5 w-5" />
                        <span>Show Completed Tours</span>
                      </>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {completedTours.length}
                  </span>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Tour Cards Grid - Responsive wrapping */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
        {displayedTours.map((tour: any) => (
          <div
            key={tour.id}
            className={completedTours.some(ct => ct.id === tour.id) ? 'opacity-75' : ''}
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

      {/* Legacy Tours Disclaimer - Moved to bottom and collapsible */}
      {toursNeedingRootFolders.length > 0 && (
        <BulkTourFolderActions 
          tours={toursNeedingRootFolders} 
          onRefresh={() => refetchTours()}
        />
      )}
    </div>
  );
};
