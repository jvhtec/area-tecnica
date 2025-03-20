
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Edit2, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { TourManagementDialog } from "./TourManagementDialog";
import { supabase } from "@/lib/supabase";

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
      console.log("Fetching tour logo for:", tour.id);
      
      const { data, error } = await supabase
        .from('tour_logos')
        .select('file_path')
        .eq('tour_id', tour.id)
        .maybeSingle();
      
      if (error) {
        console.error("Error fetching tour logo:", error);
        setLogoUrl(null);
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
        
      console.log("Tour card logo URL:", urlData.publicUrl);
      setLogoUrl(urlData.publicUrl);
    } catch (error) {
      console.error("Unexpected error fetching logo:", error);
      setLogoUrl(null);
    }
  };
  
  // Effect to fetch logo when component mounts or tour changes
  useEffect(() => {
    if (tour && tour.id) {
      fetchLogo();
    }
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
            <div className="h-14 w-14 mr-2 flex-shrink-0 overflow-hidden">
              <img 
                src={logoUrl} 
                alt={`${tour.name} logo`} 
                className="h-full w-full object-contain"
                onError={(e) => {
                  console.error('Image failed to load:', logoUrl);
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTAgMTRIMTRWMTZIMTBWMTRaIiBmaWxsPSJjdXJyZW50Q29sb3IiLz48cGF0aCBkPSJNMTIgMUMxNC4yMDkxIDEgMTYgMi43OTA4NiAxNiA1QzE2IDcuMjA5MTQgMTQuMjA5MSA5IDEyIDlDOS43OTA4NiA5IDggNy4yMDkxNCA4IDVDOCAyLjc5MDg2IDkuNzkwODYgMSAxMiAxWiIgZmlsbD0iY3VycmVudENvbG9yIi8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xIDEzQzEgMTAuNzkwOSAyLjc5MDg2IDkgNSA5SDE5QzIxLjIwOTEgOSAyMyAxMC43OTA5IDIzIDEzVjE5QzIzIDIwLjEwNDYgMjIuMTA0NiAyMSAyMSAyMUgzQzEuODk1NDMgMjEgMSAyMC4xMDQ2IDEgMTlWMTNaTTE5IDExSDVDMy44OTU0MyAxMSAzIDExLjg5NTQgMyAxM0MzIDE1LjIwOTEgNC43OTA5MSAxNyA3IDE3SDE3QzE5LjIwOTEgMTcgMjEgMTUuMjA5MSAyMSAxM0MyMSAxMS44OTU0IDIwLjEwNDYgMTEgMTkgMTFaIiBmaWxsPSJjdXJyZW50Q29sb3IiLz48L3N2Zz4=';
                }}
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
