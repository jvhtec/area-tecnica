
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Settings, FileText } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface TourCardProps {
  tour: {
    id: string;
    name: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    color: string;
    tour_dates?: Array<{
      id: string;
      date: string;
      location?: {
        name: string;
      };
    }>;
  };
  onTourClick: () => void;
  onManageDates: () => void;
  onPrint: () => void;
}

export const TourCard = ({ tour, onTourClick, onManageDates, onPrint }: TourCardProps) => {
  const navigate = useNavigate();

  const formatDateRange = () => {
    if (!tour.start_date || !tour.end_date) {
      return "Dates not set";
    }
    
    const startDate = new Date(tour.start_date);
    const endDate = new Date(tour.end_date);
    
    return `${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd, yyyy')}`;
  };

  const getNextLocation = () => {
    if (!tour.tour_dates?.length) return "No dates scheduled";
    
    const nextDate = tour.tour_dates[0];
    return nextDate.location?.name || "Location TBD";
  };

  const handleCardClick = () => {
    navigate(`/tour-management/${tour.id}`);
  };

  return (
    <Card 
      className="hover:shadow-lg transition-all duration-200 border-l-4 cursor-pointer" 
      style={{ borderLeftColor: tour.color }}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">{tour.name}</CardTitle>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{formatDateRange()}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{getNextLocation()}</span>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {tour.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {tour.description}
          </p>
        )}
        
        <div className="text-sm text-muted-foreground mb-4">
          <span className="font-medium">{tour.tour_dates?.length || 0}</span> dates scheduled
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onManageDates();
            }}
            className="flex items-center gap-1 flex-1"
          >
            <Calendar className="h-3 w-3" />
            Dates
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onPrint();
            }}
            className="flex items-center gap-1 flex-1"
          >
            <FileText className="h-3 w-3" />
            Print
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
