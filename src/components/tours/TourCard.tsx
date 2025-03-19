
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Edit2, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { TourManagementDialog } from "./TourManagementDialog";
import { supabase } from "@/integrations/supabase/client";

interface TourCardProps {
  tour: any;
  onTourClick: (tourId: string) => void;
  onManageDates: (tourId: string) => void;
  onPrint: (tour: any) => Promise<void>;
}

export const TourCard = ({
  tour,
  onTourClick,
  onManageDates,
  onPrint
}: TourCardProps) => {
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [dialogKey, setDialogKey] = useState(0); // Used to force re-render of dialog
  
  // Function to fetch the tour logo
  const fetchLogo = async () => {
    try {
      const { data, error } = await supabase
        .from('tour_logos')
        .select('file_path')
        .eq('tour_id', tour.id)
        .maybeSingle();
      
      if (error) {
        console.error("Error fetching tour logo:", error);
        return;
      }
      
      if (!data) {
        console.log("No logo found for tour:", tour.id);
        setLogoUrl(null);
        return;
      }
      
      const { data: urlData } = supabase
        .storage
        .from('tour-logos')
        .getPublicUrl(data.file_path);
        
      setLogoUrl(urlData.publicUrl);
    } catch (error) {
      console.error("Unexpected error fetching logo:", error);
    }
  };
  
  // Effect to fetch logo when component mounts or tour changes
  useEffect(() => {
    fetchLogo();
  }, [tour.id]);
  
  // Handle dialog close with refresh
  const handleDialogOpenChange = (open: boolean) => {
    setIsManageDialogOpen(open);
    
    // When the dialog closes, refresh logo and increment key to force re-render
    if (!open) {
      fetchLogo();
      setDialogKey(prevKey => prevKey + 1);
    }
  };
  
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
        <CardTitle className="text-xl font-semibold flex items-center gap-2 my-[30px] py-0">
          {logoUrl && (
            <div className="h-8 w-8 mr-2 flex-shrink-0">
              <img 
                src={logoUrl} 
                alt={`${tour.name} logo`} 
                className="h-full w-full object-contain"
              />
            </div>
          )}
          {tour.name}
          {tour.flex_main_folder_id && <Badge variant="secondary">Flex Folders Created</Badge>}
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="absolute top-2 right-2 flex gap-1">
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={e => {
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
            onClick={e => {
              e.stopPropagation();
              handleDialogOpenChange(true);
            }} 
            title="Edit Tour"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={e => {
              e.stopPropagation();
              onPrint(tour);
            }} 
            title="Print Tour"
          >
            <FileText className="h-4 w-4" />
          </Button>
        </div>
        {tour.description && <p className="text-muted-foreground mt-2">{tour.description}</p>}
      </CardContent>

      {isManageDialogOpen && (
        <TourManagementDialog 
          key={dialogKey}
          open={isManageDialogOpen} 
          onOpenChange={handleDialogOpenChange} 
          tour={tour} 
        />
      )}
    </Card>
  );
};
