
import { Button } from "@/components/ui/button";
import createFolderIcon from "@/assets/icons/icon.png";
import { useFlexUuid } from "@/hooks/useFlexUuid";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TourDateFlexButtonProps {
  tourDateId: string;
}

export const TourDateFlexButton = ({ tourDateId }: TourDateFlexButtonProps) => {
  // Pass the tour date ID directly to the hook
  const { flexUuid, isLoading: isFlexLoading, error } = useFlexUuid(tourDateId);
  const { toast } = useToast();

  const handleFlexClick = () => {
    if (isFlexLoading) {
      toast({
        title: "Loading",
        description: "Please wait while we load the Flex folder...",
      });
      return;
    }

    if (flexUuid) {
      const flexUrl = `https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/${flexUuid}/view/simple-element/header`;
      window.open(flexUrl, '_blank', 'noopener');
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
      disabled={isFlexLoading}
    >
      {isFlexLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <img src={createFolderIcon} alt="Flex" className="h-4 w-4" />
      )}
      Flex Folder
    </Button>
  );
};
