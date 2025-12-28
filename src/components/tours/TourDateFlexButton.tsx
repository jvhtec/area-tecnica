
import { Button } from "@/components/ui/button";
import createFolderIcon from "@/assets/icons/icon.png";
import { useFlexUuid } from "@/hooks/useFlexUuid";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { openFlexElement } from "@/utils/flex-folders";

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
      console.log(`[TourDateFlexButton] Opening Flex for tour date ${tourDateId}, element: ${flexUuid}`);
      
      await openFlexElement({
        elementId: flexUuid,
        context: {
          jobType: 'tourdate',
          folderType: 'tourdate',
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error.message || "Failed to open Flex",
            variant: "destructive",
          });
        },
        onWarning: (message) => {
          toast({
            title: "Warning",
            description: message,
          });
        },
      });
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
        <img
          src={createFolderIcon}
          alt="Flex"
          width={16}
          height={16}
          loading="lazy"
          decoding="async"
          className="h-4 w-4"
        />
      )}
      {isCreatingFolders ? "Creating Folders..." : "Flex Folder"}
    </Button>
  );
};
