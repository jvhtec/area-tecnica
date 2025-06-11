import { Button } from "@/components/ui/button";
import createFolderIcon from "@/assets/icons/icon.png";
import { useFlexUuid } from "@/hooks/useFlexUuid";
import { Loader2 } from "lucide-react";

interface TourDateFlexButtonProps {
  tourDateId: string;
}

export const TourDateFlexButton = ({ tourDateId }: TourDateFlexButtonProps) => {
  const { flexUuid, isLoading: isFlexLoading } = useFlexUuid(tourDateId);

  const handleFlexClick = () => {
    if (flexUuid) {
      const flexUrl = `https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/${flexUuid}/view/simple-element/header`;
      window.open(flexUrl, '_blank', 'noopener');
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="flex items-center gap-2 mt-4 w-full"
      onClick={handleFlexClick}
      disabled={!flexUuid || isFlexLoading}
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
