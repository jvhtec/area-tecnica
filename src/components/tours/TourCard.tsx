
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, MoreVertical, Settings, FileText, Printer, FolderPlus, Image } from "lucide-react";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TourManagementDialog } from "./TourManagementDialog";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { createAllFoldersForJob } from "@/utils/flex-folders";
import { useIsMobile } from "@/hooks/use-mobile";

interface TourCardProps {
  tour: any;
  onManageDates: () => void;
  onPrint: () => void;
}

export const TourCard = ({ tour, onManageDates, onPrint }: TourCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  // Fetch tour logo
  useEffect(() => {
    const fetchTourLogo = async () => {
      if (!tour.id) return;
      
      const { data, error } = await supabase
        .from('tour_logos')
        .select('file_path')
        .eq('tour_id', tour.id)
        .maybeSingle();

      if (!error && data?.file_path) {
        const { data: publicUrlData } = supabase
          .storage
          .from('tour-logos')
          .getPublicUrl(data.file_path);
          
        if (publicUrlData?.publicUrl) {
          setLogoUrl(publicUrlData.publicUrl);
        }
      }
    };

    fetchTourLogo();
  }, [tour.id]);

  const getUpcomingDates = () => {
    if (!tour.tour_dates) return [];
    return tour.tour_dates
      .filter((date: any) => new Date(date.date) >= new Date())
      .slice(0, 3);
  };

  const upcomingDates = getUpcomingDates();

  const handleCardClick = () => {
    navigate(`/tour-management/${tour.id}`);
  };

  const handleCreateFlexFolders = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMobileMenuOpen(false);

    if (tour.flex_folders_created) {
      toast({
        title: "Folders already created",
        description: "Flex folders have already been created for this tour.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log("Creating flex folders for tour:", tour.id);
      
      // Get tour dates to create folders for each
      const { data: tourDates, error: tourDatesError } = await supabase
        .from("tour_dates")
        .select("*")
        .eq("tour_id", tour.id)
        .order("date", { ascending: true });

      if (tourDatesError) {
        console.error("Error fetching tour dates:", tourDatesError);
        throw tourDatesError;
      }

      if (!tourDates || tourDates.length === 0) {
        toast({
          title: "No tour dates",
          description: "Cannot create folders - no tour dates found.",
          variant: "destructive"
        });
        return;
      }

      // Create folders for each tour date
      for (const tourDate of tourDates) {
        // Create a mock job object for the folder creation
        const mockJob = {
          id: `tour-${tour.id}-date-${tourDate.id}`,
          title: `${tour.name} - ${format(new Date(tourDate.date), 'MMM d, yyyy')}`,
          tour_id: tour.id,
          tour_date_id: tourDate.id,
          start_time: tourDate.date,
          end_time: tourDate.date
        };

        const documentNumber = new Date(tourDate.date)
          .toISOString()
          .slice(2, 10)
          .replace(/-/g, "");

        const formattedDate = new Date(tourDate.date).toISOString().split(".")[0] + ".000Z";
        
        await createAllFoldersForJob(mockJob, formattedDate, formattedDate, documentNumber);
      }

      // Mark tour as having folders created
      const { error: updateError } = await supabase
        .from("tours")
        .update({ flex_folders_created: true })
        .eq("id", tour.id);

      if (updateError) {
        console.error("Error updating tour:", updateError);
        throw updateError;
      }

      toast({
        title: "Success",
        description: "Flex folders have been created for all tour dates."
      });
    } catch (error: any) {
      console.error("Error creating Flex folders:", error);
      toast({
        title: "Error creating folders",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleManageTour = () => {
    setIsManagementOpen(true);
    setIsMobileMenuOpen(false);
  };

  const handleManageDatesClick = () => {
    onManageDates();
    setIsMobileMenuOpen(false);
  };

  const handlePrintClick = () => {
    onPrint();
    setIsMobileMenuOpen(false);
  };

  const MenuItems = () => (
    <>
      <div 
        className="flex items-center p-3 hover:bg-accent cursor-pointer rounded-md transition-colors"
        onClick={handleManageTour}
      >
        <Settings className="h-4 w-4 mr-3" />
        <span>Manage Tour</span>
      </div>
      <div 
        className="flex items-center p-3 hover:bg-accent cursor-pointer rounded-md transition-colors"
        onClick={handleManageDatesClick}
      >
        <Calendar className="h-4 w-4 mr-3" />
        <span>Manage Dates</span>
      </div>
      <div 
        className={`flex items-center p-3 hover:bg-accent cursor-pointer rounded-md transition-colors ${
          tour.flex_folders_created ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        onClick={!tour.flex_folders_created ? handleCreateFlexFolders : undefined}
      >
        <FolderPlus className="h-4 w-4 mr-3" />
        <span>{tour.flex_folders_created ? "Folders Created" : "Create Flex Folders"}</span>
      </div>
      <div 
        className="flex items-center p-3 hover:bg-accent cursor-pointer rounded-md transition-colors"
        onClick={handlePrintClick}
      >
        <Printer className="h-4 w-4 mr-3" />
        <span>Print Schedule</span>
      </div>
    </>
  );

  return (
    <>
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleCardClick}>
        <CardHeader 
          className="pb-3 relative"
          style={{ backgroundColor: `${tour.color}20` }}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-start gap-3 mb-2">
                {logoUrl && (
                  <div className="w-12 h-12 flex-shrink-0">
                    <img
                      src={logoUrl}
                      alt="Tour logo"
                      className="w-full h-full object-contain rounded"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="flex-1">
                  <CardTitle className="text-lg">{tour.name}</CardTitle>
                  {tour.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {tour.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Mobile Sheet Menu */}
            {isMobile ? (
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-10 w-10 p-0 touch-manipulation"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-auto max-h-[50vh]">
                  <SheetHeader>
                    <SheetTitle>{tour.name} - Options</SheetTitle>
                  </SheetHeader>
                  <div className="grid gap-2 pt-4">
                    <MenuItems />
                  </div>
                </SheetContent>
              </Sheet>
            ) : (
              /* Desktop Dropdown Menu */
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="w-56 z-[9999]"
                  sideOffset={5}
                >
                  <DropdownMenuItem onClick={handleManageTour}>
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Tour
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleManageDatesClick}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Manage Dates
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleCreateFlexFolders}
                    disabled={tour.flex_folders_created}
                  >
                    <FolderPlus className="h-4 w-4 mr-2" />
                    {tour.flex_folders_created ? "Folders Created" : "Create Flex Folders"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handlePrintClick}>
                    <Printer className="h-4 w-4 mr-2" />
                    Print Schedule
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="pt-3">
          <div className="space-y-4">
            {/* Tour dates info */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {tour.tour_dates?.length || 0} dates
                </span>
              </div>
              {tour.start_date && tour.end_date && (
                <span className="text-xs text-muted-foreground">
                  {format(new Date(tour.start_date), 'MMM d')} - {format(new Date(tour.end_date), 'MMM d, yyyy')}
                </span>
              )}
            </div>

            {/* Upcoming dates preview */}
            {upcomingDates.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Upcoming:</h4>
                {upcomingDates.map((date: any) => (
                  <div key={date.id} className="flex items-center gap-2 text-xs">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span>{format(new Date(date.date), 'MMM d, yyyy')}</span>
                    {date.location?.name && (
                      <>
                        <MapPin className="h-3 w-3 text-muted-foreground ml-2" />
                        <span className="text-muted-foreground">{date.location.name}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Status badges */}
            <div className="flex gap-2 flex-wrap">
              {tour.flex_folders_created && (
                <Badge variant="secondary" className="text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  Flex Ready
                </Badge>
              )}
              {logoUrl && (
                <Badge variant="secondary" className="text-xs">
                  <Image className="h-3 w-3 mr-1" />
                  Logo
                </Badge>
              )}
              <Badge 
                variant="outline" 
                className="text-xs"
                style={{ 
                  borderColor: tour.color,
                  color: tour.color 
                }}
              >
                {tour.tour_dates?.length || 0} dates
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Management dialog */}
      <TourManagementDialog
        open={isManagementOpen}
        onOpenChange={setIsManagementOpen}
        tour={tour}
      />
    </>
  );
};
