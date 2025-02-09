import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Edit2, FileText } from "lucide-react";
import { useState } from "react";
import { TourManagementDialog } from "./TourManagementDialog";

interface TourCardProps {
  tour: any;
  onTourClick: (tourId: string) => void;
  onManageDates: (tourId: string) => void;
  onPrint: (tour: any) => Promise<void>;
}

export const TourCard = ({ tour, onTourClick, onManageDates, onPrint }: TourCardProps) => {
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);

  return (
    <Card 
      className="relative hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onTourClick(tour.id)}
      style={{ 
        borderColor: `${tour.color}30` || '#7E69AB30',
        backgroundColor: `${tour.color}05` || '#7E69AB05'
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          {tour.name}
          {tour.flex_main_folder_id && (
            <Badge variant="secondary">Flex Folders Created</Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="absolute top-2 right-2 flex gap-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onManageDates(tour.id);
            }}
            title="Manage Dates"
          >
            <Calendar className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setIsManageDialogOpen(true);
            }}
            title="Edit Tour"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onPrint(tour);
            }}
            title="Print Tour"
          >
            <FileText className="h-4 w-4" />
          </Button>
        </div>
        {tour.description && (
          <p className="text-muted-foreground mt-2">{tour.description}</p>
        )}
      </CardContent>

      {isManageDialogOpen && (
        <TourManagementDialog
          open={isManageDialogOpen}
          onOpenChange={setIsManageDialogOpen}
          tour={tour}
        />
      )}
    </Card>
  );
};