
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, MoreVertical, Settings, FileText, Printer, Zap, Weight } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { TourManagementDialog } from "./TourManagementDialog";
import { TourPowerWeightDefaultsDialog } from "./TourPowerWeightDefaultsDialog";

interface TourCardProps {
  tour: any;
  onTourClick: () => void;
  onManageDates: () => void;
  onPrint: () => void;
}

export const TourCard = ({ tour, onTourClick, onManageDates, onPrint }: TourCardProps) => {
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [isPowerWeightOpen, setIsPowerWeightOpen] = useState(false);

  const getUpcomingDates = () => {
    if (!tour.tour_dates) return [];
    return tour.tour_dates
      .filter((date: any) => new Date(date.date) >= new Date())
      .slice(0, 3);
  };

  const upcomingDates = getUpcomingDates();

  return (
    <>
      <Card className="cursor-pointer hover:shadow-md transition-shadow">
        <CardHeader 
          className="pb-3"
          style={{ backgroundColor: `${tour.color}20` }}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1" onClick={onTourClick}>
              <CardTitle className="text-lg mb-2">{tour.name}</CardTitle>
              {tour.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {tour.description}
                </p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsManagementOpen(true)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Manage Tour
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onManageDates}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Manage Dates
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsPowerWeightOpen(true)}>
                  <Zap className="h-4 w-4 mr-2" />
                  Power & Weight Defaults
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onPrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print Schedule
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        <CardContent className="pt-3" onClick={onTourClick}>
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
            <div className="flex gap-2">
              {tour.flex_folders_created && (
                <Badge variant="secondary" className="text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  Flex Ready
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

      {/* Management dialogs */}
      <TourManagementDialog
        open={isManagementOpen}
        onOpenChange={setIsManagementOpen}
        tour={tour}
      />
      
      <TourPowerWeightDefaultsDialog
        open={isPowerWeightOpen}
        onOpenChange={setIsPowerWeightOpen}
        tour={tour}
      />
    </>
  );
};
