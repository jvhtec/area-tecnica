
import { Button } from "@/components/ui/button";
import createFolderIcon from "@/assets/icons/icon.png";
import { useFlexUuid } from "@/hooks/useFlexUuid";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { buildFlexUrlWithTypeDetection } from "@/utils/flex-folders";

interface TourDateFlexButtonProps {
  tourDateId: string;
  isCreatingFolders?: boolean;
}

export const TourDateFlexButton = ({ tourDateId, isCreatingFolders = false }: TourDateFlexButtonProps) => {
  const { flexUuid, isLoading: isFlexLoading, error } = useFlexUuid(tourDateId);
  const { toast } = useToast();

  const handleFlexClick = async () => {
    if (isFlexLoading || isCreatingFolders) {
      toast({
        title: "Loading",
        description: isCreatingFolders 
          ? "Creating Flex folders, please wait..." 
          : "Please wait while we load the Flex folder...",
      });
      return;
    }

    if (flexUuid) {
      try {
        // Get auth token from Supabase
        const { data: { X_AUTH_TOKEN }, error: authError } = await supabase
          .functions.invoke('get-secret', {
            body: { secretName: 'X_AUTH_TOKEN' }
          });
        
        if (authError || !X_AUTH_TOKEN) {
          console.error('Failed to get auth token:', authError);
          // Fallback to simple element URL if auth fails
          const flexUrl = `https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/${flexUuid}/view/simple-element/header`;
          window.open(flexUrl, '_blank', 'noopener');
          return;
        }

        // Build URL with element type detection
        const flexUrl = await buildFlexUrlWithTypeDetection(flexUuid, X_AUTH_TOKEN);
        window.open(flexUrl, '_blank', 'noopener');
      } catch (err) {
        console.error('Error building Flex URL:', err);
        // Fallback to simple element URL if error occurs
        const flexUrl = `https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/${flexUuid}/view/simple-element/header`;
        window.open(flexUrl, '_blank', 'noopener');
      }
    } else if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Info",
        description: "Flex folder not available for this tour date",
      });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="flex items-center gap-2 mt-4 w-full"
      onClick={handleFlexClick}
      disabled={isFlexLoading || isCreatingFolders}
    >
      {isFlexLoading || isCreatingFolders ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <img src={createFolderIcon} alt="Flex" className="h-4 w-4" />
      )}
      {isCreatingFolders ? "Creating Folders..." : "Flex Folder"}
    </Button>
  );
};
