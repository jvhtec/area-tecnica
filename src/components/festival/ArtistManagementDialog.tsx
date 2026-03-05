
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  const formId = artist ? "artist-management-edit-form" : "artist-management-create-form";

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
      <DialogContent className="flex h-[100vh] max-h-[100vh] md:max-h-[100vh] w-[100vw] max-w-[100vw] flex-col gap-0 overflow-hidden rounded-none sm:rounded-none p-0">
        <DialogHeader className="border-b px-4 py-3 sm:px-6">
          <DialogTitle>
            {artist ? "Editar Artista" : "Agregar Artista"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <ArtistManagementForm
            artist={artist}
            jobId={jobId}
            selectedDate={selectedDate}
            dayStartTime={dayStartTime}
            onSubmit={handleSave}
            formId={formId}
          />
        </div>
        <div className="border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
          <div className="flex justify-end">
            <Button
              type="submit"
              form={formId}
              disabled={isCreating || isUpdating}
              className="w-full sm:w-auto sm:min-w-[240px]"
            >
              {isCreating || isUpdating
                ? "Guardando..."
                : artist
                  ? "Actualizar Artista"
                  : "Agregar Artista"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
