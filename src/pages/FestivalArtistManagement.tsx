
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";
import { ArtistTable } from "@/components/festival/ArtistTable";
import { ArtistManagementDialog } from "@/components/festival/ArtistManagementDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

const FestivalArtistManagement = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [artists, setArtists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<any>(null);
  const [jobTitle, setJobTitle] = useState("");

  useEffect(() => {
    const fetchJobDetails = async () => {
      if (!jobId) return;
      const { data, error } = await supabase
        .from("jobs")
        .select("title")
        .eq("id", jobId)
        .single();

      if (error) {
        console.error("Error fetching job details:", error);
      } else {
        setJobTitle(data.title);
      }
    };

    fetchJobDetails();
  }, [jobId]);

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
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate(`/festival-management/${jobId}`)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Festival Management
        </Button>
        <h1 className="text-2xl font-bold">{jobTitle}</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Festival Artists</CardTitle>
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
