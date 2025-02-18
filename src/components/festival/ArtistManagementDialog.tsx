
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from 'uuid';
import { ArtistFormLinksDialog } from "./ArtistFormLinksDialog";

interface ArtistManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artist: any;
  jobId: string;
  selectedDate: string;
}

export const ArtistManagementDialog = ({
  open,
  onOpenChange,
  artist,
  jobId,
  selectedDate
}: ArtistManagementDialogProps) => {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [stage, setStage] = useState<number | "">("");
  const [showStart, setShowStart] = useState("");
  const [showEnd, setShowEnd] = useState("");
  const [soundcheck, setSoundcheck] = useState(false);
  const [soundcheckStart, setSoundcheckStart] = useState("");
  const [soundcheckEnd, setSoundcheckEnd] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);

  useEffect(() => {
    if (artist) {
      setName(artist.name || "");
      setStage(artist.stage || "");
      setShowStart(artist.show_start || "");
      setShowEnd(artist.show_end || "");
      setSoundcheck(artist.soundcheck || false);
      setSoundcheckStart(artist.soundcheck_start || "");
      setSoundcheckEnd(artist.soundcheck_end || "");
    } else {
      // Reset form when creating a new artist
      setName("");
      setStage("");
      setShowStart("");
      setShowEnd("");
      setSoundcheck(false);
      setSoundcheckStart("");
      setSoundcheckEnd("");
    }
  }, [artist]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      if (!jobId) {
        throw new Error("Job ID is missing.");
      }

      const artistData = {
        job_id: jobId,
        date: selectedDate,
        name,
        stage: stage !== "" ? parseInt(stage.toString(), 10) : null,
        show_start: showStart,
        show_end: showEnd,
        soundcheck,
        soundcheck_start: soundcheckStart,
        soundcheck_end: soundcheckEnd,
      };

      let upsertData;
      if (artist) {
        upsertData = await supabase
          .from("festival_artists")
          .update(artistData)
          .eq("id", artist.id);
      } else {
        artistData['id'] = uuidv4();
        upsertData = await supabase
          .from("festival_artists")
          .insert(artistData);
      }

      if (upsertData.error) throw upsertData.error;

      toast({
        title: "Success",
        description: `Artist ${artist ? "updated" : "created"} successfully`,
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error upserting artist:", error);
      toast({
        title: "Error",
        description: "Could not save artist: " + error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{artist ? "Edit Artist" : "Create Artist"}</DialogTitle>
          <DialogDescription>
            {artist ? "Update artist details." : "Add a new artist to the festival."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="stage" className="text-right">
              Stage
            </Label>
            <Input
              id="stage"
              type="number"
              value={stage}
              onChange={(e) => {
                const value = e.target.value;
                setStage(value === "" ? "" : Number(value));
              }}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="showStart" className="text-right">
              Show Start
            </Label>
            <Input
              id="showStart"
              type="time"
              value={showStart}
              onChange={(e) => setShowStart(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="showEnd" className="text-right">
              Show End
            </Label>
            <Input
              id="showEnd"
              type="time"
              value={showEnd}
              onChange={(e) => setShowEnd(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="soundcheck" className="text-right">
              Soundcheck
            </Label>
            <input
              id="soundcheck"
              type="checkbox"
              checked={soundcheck}
              onChange={(e) => setSoundcheck(e.target.checked)}
              className="col-span-3"
            />
          </div>
          {soundcheck && (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="soundcheckStart" className="text-right">
                  Soundcheck Start
                </Label>
                <Input
                  id="soundcheckStart"
                  type="time"
                  value={soundcheckStart}
                  onChange={(e) => setSoundcheckStart(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="soundcheckEnd" className="text-right">
                  Soundcheck End
                </Label>
                <Input
                  id="soundcheckEnd"
                  type="time"
                  value={soundcheckEnd}
                  onChange={(e) => setSoundcheckEnd(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
