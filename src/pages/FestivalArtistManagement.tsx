import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ArtistTable } from "@/components/festival/ArtistTable";
import { ArtistManagementDialog } from "@/components/festival/ArtistManagementDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

const FestivalArtistManagement = () => {
  const { jobId } = useParams();
  const { toast } = useToast();
  const [artists, setArtists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<any>(null);

  // Fetch artists for this job
  useEffect(() => {
    const fetchArtists = async () => {
      try {
        console.log("Fetching artists for job:", jobId);
        const { data, error } = await supabase
          .from("festival_artists")
          .select("*")
          .eq("job_id", jobId)
          .order("show_start", { ascending: true });

        if (error) throw error;
        console.log("Fetched artists:", data);
        setArtists(data || []);
      } catch (error: any) {
        console.error("Error fetching artists:", error);
        toast({
          title: "Error",
          description: "Could not load artists",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (jobId) {
      fetchArtists();
    }
  }, [jobId]);

  const handleAddArtist = () => {
    setSelectedArtist(null);
    setIsDialogOpen(true);
  };

  const handleEditArtist = (artist: any) => {
    setSelectedArtist(artist);
    setIsDialogOpen(true);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Festival Artists Management</CardTitle>
          <Button onClick={handleAddArtist}>
            <Plus className="h-4 w-4 mr-2" />
            Add Artist
          </Button>
        </CardHeader>
        <CardContent>
          <ArtistTable
            artists={artists}
            isLoading={isLoading}
            onEditArtist={handleEditArtist}
          />
        </CardContent>
      </Card>

      <ArtistManagementDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        artist={selectedArtist}
        jobId={jobId}
      />
    </div>
  );
};

export default FestivalArtistManagement;