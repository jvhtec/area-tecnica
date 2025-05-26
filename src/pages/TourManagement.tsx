
import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Calendar, 
  Settings, 
  FileText, 
  MapPin, 
  Printer, 
  Loader2,
  Music2,
  Truck,
  Clock
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { format, isValid } from "date-fns";
import { TourLogoManager } from "@/components/tours/TourLogoManager";
import { TourDateManagementDialog } from "@/components/tours/TourDateManagementDialog";
import { TourDefaultsManager } from "@/components/tours/TourDefaultsManager";
import { useAuth } from "@/hooks/useAuth";

interface Tour {
  id: string;
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  color: string;
  flex_folders_created: boolean;
}

interface TourDate {
  id: string;
  date: string;
  location?: {
    id: string;
    name: string;
  };
}

const TourManagement = () => {
  const { tourId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [tour, setTour] = useState<Tour | null>(null);
  const [tourDates, setTourDates] = useState<TourDate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
  const [isDefaultsDialogOpen, setIsDefaultsDialogOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const { userRole } = useAuth();
  
  const canEdit = ['admin', 'management', 'logistics'].includes(userRole || '');
  const isViewOnly = userRole === 'technician';

  // Check if we're on a sub-route
  const isSubRoute = location.pathname.includes('/dates') || 
                     location.pathname.includes('/documents') || 
                     location.pathname.includes('/technicians') ||
                     location.pathname.includes('/scheduling') ||
                     location.pathname.includes('/logistics');

  useEffect(() => {
    const fetchTourDetails = async () => {
      try {
        if (!tourId) {
          console.log("No tourId provided");
          return;
        }

        console.log("Fetching tour details for tourId:", tourId);

        // Fetch tour data
        const { data: tourData, error: tourError } = await supabase
          .from("tours")
          .select("*")
          .eq("id", tourId)
          .single();

        if (tourError) {
          console.error("Error fetching tour data:", tourError);
          throw tourError;
        }

        // Fetch tour dates with location information
        const { data: datesData, error: datesError } = await supabase
          .from("tour_dates")
          .select(`
            id,
            date,
            location:locations (
              id,
              name
            )
          `)
          .eq("tour_id", tourId)
          .order("date", { ascending: true });

        if (datesError) {
          console.error("Error fetching tour dates:", datesError);
          throw datesError;
        }

        console.log("Tour data retrieved:", tourData);
        console.log("Tour dates retrieved:", datesData);

        // Transform the data to match our TourDate interface
        const transformedDates = datesData?.map(item => ({
          id: item.id,
          date: item.date,
          location: Array.isArray(item.location) ? item.location[0] : item.location
        })) || [];

        setTour(tourData);
        setTourDates(transformedDates);
      } catch (error: any) {
        console.error("Error fetching tour details:", error);
        toast({
          title: "Error",
          description: "Could not load tour details",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTourDetails();
  }, [tourId, toast]);

  const handlePrintDocumentation = async () => {
    if (!tourId || !tour) return;
    
    setIsPrinting(true);
    try {
      // TODO: Implement comprehensive tour documentation export
      console.log("Printing tour documentation for:", tour.name);
      
      toast({
        title: "Success",
        description: 'Tour documentation will be available soon'
      });
    } catch (error: any) {
      console.error('Error generating tour documentation:', error);
      toast({
        title: "Error",
        description: `Failed to generate documentation: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsPrinting(false);
    }
  };

  if (!tourId) {
    return <div>Tour ID is required</div>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading tour details...</span>
      </div>
    );
  }

  if (!tour) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <h2 className="text-xl font-bold">Tour Not Found</h2>
        <p className="text-muted-foreground mt-2">
          The requested tour could not be found or may have been deleted.
        </p>
        <Button onClick={() => navigate('/dashboard')} className="mt-4">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  // Don't render the overview cards if we're on a sub-route
  if (isSubRoute) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="mb-4">
          <Button 
            variant="outline" 
            onClick={() => navigate(`/tour-management/${tourId}`)}
            className="flex items-center gap-1"
          >
            Back to Tour Overview
          </Button>
        </div>
        {/* Sub-route content will be rendered by nested routes */}
      </div>
    );
  }

  const formatDateRange = () => {
    if (!tour.start_date || !tour.end_date) {
      return "Dates not set";
    }
    
    const startDate = new Date(tour.start_date);
    const endDate = new Date(tour.end_date);
    
    if (!isValid(startDate) || !isValid(endDate)) {
      return "Invalid dates";
    }
    
    return `${format(startDate, 'MMM dd, yyyy')} - ${format(endDate, 'MMM dd, yyyy')}`;
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Tour Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Music2 className="h-6 w-6" style={{ color: tour.color }} />
                {tour.name}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {formatDateRange()} • {tourDates.length} dates
              </p>
              {tour.description && (
                <p className="text-sm text-muted-foreground mt-2">
                  {tour.description}
                </p>
              )}
            </div>
            <div className="flex gap-2 items-center">
              {canEdit && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={handlePrintDocumentation}
                  disabled={isPrinting}
                >
                  {isPrinting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="h-4 w-4" />
                  )}
                  {isPrinting ? 'Generating...' : 'Print Documentation'}
                </Button>
              )}
              {canEdit && <TourLogoManager tourId={tourId} />}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Management Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Tour Dates Management */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setIsDateDialogOpen(true)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Tour Dates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{tourDates.length}</p>
            <p className="text-sm text-muted-foreground">Total Dates</p>
            <Button className="mt-4 w-full" onClick={(e) => {
              e.stopPropagation();
              setIsDateDialogOpen(true);
            }}>
              {isViewOnly ? "View Dates" : "Manage Dates"}
            </Button>
          </CardContent>
        </Card>

        {/* Configuration & Defaults */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setIsDefaultsDialogOpen(true)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Manage tour defaults and settings</p>
            <Button className="mt-4 w-full" onClick={(e) => {
              e.stopPropagation();
              setIsDefaultsDialogOpen(true);
            }}>
              {isViewOnly ? "View Settings" : "Manage Defaults"}
            </Button>
          </CardContent>
        </Card>

        {/* Document Management */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/tour-management/${tourId}/documents`)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Upload and manage tour documents</p>
            <Button className="mt-4 w-full" onClick={(e) => {
              e.stopPropagation();
              navigate(`/tour-management/${tourId}/documents`);
            }}>
              {isViewOnly ? "View Documents" : "Manage Documents"}
            </Button>
          </CardContent>
        </Card>

        {/* Technician Assignment */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/tour-management/${tourId}/technicians`)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Technicians
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Assign technicians to tour dates</p>
            <Button className="mt-4 w-full" onClick={(e) => {
              e.stopPropagation();
              navigate(`/tour-management/${tourId}/technicians`);
            }}>
              {isViewOnly ? "View Assignments" : "Manage Assignments"}
            </Button>
          </CardContent>
        </Card>

        {/* Tour Scheduling */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/tour-management/${tourId}/scheduling`)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Scheduling
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Manage tour timeline and scheduling</p>
            <Button className="mt-4 w-full" onClick={(e) => {
              e.stopPropagation();
              navigate(`/tour-management/${tourId}/scheduling`);
            }}>
              {isViewOnly ? "View Schedule" : "Manage Schedule"}
            </Button>
          </CardContent>
        </Card>

        {/* Logistics Management */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/tour-management/${tourId}/logistics`)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Logistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Manage equipment transport and logistics</p>
            <Button className="mt-4 w-full" onClick={(e) => {
              e.stopPropagation();
              navigate(`/tour-management/${tourId}/logistics`);
            }}>
              {isViewOnly ? "View Logistics" : "Manage Logistics"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      {isDateDialogOpen && (
        <TourDateManagementDialog
          open={isDateDialogOpen}
          onOpenChange={setIsDateDialogOpen}
          tourId={tourId}
          tourDates={tourDates}
        />
      )}

      {isDefaultsDialogOpen && (
        <TourDefaultsManager
          open={isDefaultsDialogOpen}
          onOpenChange={setIsDefaultsDialogOpen}
          tour={tour}
        />
      )}
    </div>
  );
};

export default TourManagement;
