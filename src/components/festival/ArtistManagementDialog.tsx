
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArtistManagementForm } from "./ArtistManagementForm";
import { MobileArtistFormSheet } from "./mobile/MobileArtistFormSheet";
import { useArtistMutations } from "@/hooks/useArtistMutations";
import { useIsMobile } from "@/hooks/use-mobile";

interface ArtistManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean, wasUpdated?: boolean) => void;
  artist?: any;
  jobId?: string;
  selectedDate: string;
  dayStartTime?: string;
}

export const ArtistManagementDialog = ({
  open,
  onOpenChange,
  artist,
  jobId,
  selectedDate,
  dayStartTime = "07:00"
}: ArtistManagementDialogProps) => {
  const { createArtist, updateArtist, isCreating, isUpdating } = useArtistMutations(jobId, selectedDate);
  const isMobile = useIsMobile();

  const handleSave = async (data: any) => {
    try {
      if (artist) {
        // Update existing artist
        await updateArtist({ id: artist.id, ...data });
      } else {
        // Create new artist
        await createArtist(data);
      }

      // Close dialog and notify that there was an update
      onOpenChange(false, true);
    } catch (error) {
      console.error("Error saving artist:", error);
      // Don't close dialog on error so user can retry
    }
  };

  const handleClose = () => {
    onOpenChange(false, false);
  };

  // Mobile: full-screen stepped form
  if (isMobile && open) {
    return (
      <MobileArtistFormSheet
        artist={artist}
        jobId={jobId}
        selectedDate={selectedDate}
        dayStartTime={dayStartTime}
        onSubmit={handleSave}
        isSubmitting={isCreating || isUpdating}
        onClose={handleClose}
      />
    );
  }

  // Desktop: standard dialog
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle>
            {artist ? "Editar Artista" : "Agregar Artista"}
          </DialogTitle>
        </DialogHeader>
        <ArtistManagementForm
          artist={artist}
          jobId={jobId}
          selectedDate={selectedDate}
          dayStartTime={dayStartTime}
          onSubmit={handleSave}
          isSubmitting={isCreating || isUpdating}
        />
      </DialogContent>
    </Dialog>
  );
};
