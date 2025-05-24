
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArtistManagementForm } from "./ArtistManagementForm";
import { useArtistMutations } from "@/hooks/useArtistMutations";

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
  const [formData, setFormData] = useState<any>(null);
  
  const { createArtist, updateArtist, isCreating, isUpdating } = useArtistMutations(jobId, selectedDate);

  useEffect(() => {
    if (open) {
      if (artist) {
        // Editing existing artist
        setFormData(artist);
      } else {
        // Creating new artist
        setFormData({
          job_id: jobId,
          date: selectedDate,
          name: "",
          stage: 1,
          show_start: "",
          show_end: "",
          soundcheck: false,
          soundcheck_start: "",
          soundcheck_end: "",
          foh_tech: false,
          mon_tech: false,
          foh_console: "",
          foh_console_provided_by: "festival",
          mon_console: "",
          mon_console_provided_by: "festival",
          wireless_systems: [],
          wireless_provided_by: "festival",
          iem_systems: [],
          iem_provided_by: "festival",
          monitors_enabled: false,
          monitors_quantity: 0,
          extras_sf: false,
          extras_df: false,
          extras_djbooth: false,
          extras_wired: "",
          infra_cat6: false,
          infra_cat6_quantity: 0,
          infra_hma: false,
          infra_hma_quantity: 0,
          infra_coax: false,
          infra_coax_quantity: 0,
          infra_opticalcon_duo: false,
          infra_opticalcon_duo_quantity: 0,
          infra_analog: 0,
          infrastructure_provided_by: "festival",
          other_infrastructure: "",
          notes: "",
          isaftermidnight: false
        });
      }
    }
  }, [open, artist, jobId, selectedDate]);

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

  if (!formData) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {artist ? "Edit Artist" : "Add Artist"}
          </DialogTitle>
        </DialogHeader>
        <ArtistManagementForm
          initialData={formData}
          onSave={handleSave}
          onCancel={handleClose}
          isLoading={isCreating || isUpdating}
          dayStartTime={dayStartTime}
        />
      </DialogContent>
    </Dialog>
  );
};
