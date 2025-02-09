
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";
import { ArtistTable } from "@/components/festival/ArtistTable";
import { ArtistManagementDialog } from "@/components/festival/ArtistManagementDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format, eachDayOfInterval, isValid } from "date-fns";

const FestivalArtistManagement = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [artists, setArtists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<any>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [jobDates, setJobDates] = useState<Date[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");

  useEffect(() => {
    const fetchJobDetails = async () => {
      if (!jobId) return;
      const { data, error } = await supabase
        .from("jobs")
        .select("title, start_time, end_time")
        .eq("id", jobId)
        .single();

      if (error) {
        console.error("Error fetching job details:", error);
      } else {
        setJobTitle(data.title);
        const startDate = new Date(data.start_time);
        const endDate = new Date(data.end_time);
        
        if (isValid(startDate) && isValid(endDate)) {
          const dates = eachDayOfInterval({ start: startDate, end: endDate });
          setJobDates(dates);
          // Set the first date as selected date
          const formattedDate = format(dates[0], 'yyyy-MM-dd');
          setSelectedDate(formattedDate);
        }
      }
    };

    fetchJobDetails();
  }, [jobId]);

  // Fetch artists for this job and date
  useEffect(() => {
    const fetchArtists = async () => {
      try {
        if (!jobId || !selectedDate) return;
        
        console.log("Fetching artists for job:", jobId, "and date:", selectedDate);
        const { data, error } = await supabase
          .from("festival_artists")
          .select("*")
          .eq("job_id", jobId)
          .eq("date", selectedDate)
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

    setIsLoading(true);
    fetchArtists();
  }, [jobId, selectedDate]);

  const handleAddArtist = () => {
    setSelectedArtist(null);
    setIsDialogOpen(true);
  };

  const handleEditArtist = (artist: any) => {
    setSelectedArtist(artist);
    setIsDialogOpen(true);
  };

  const formatTabDate = (date: Date) => {
    return format(date, 'EEE, MMM d');
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
          {jobDates.length > 0 ? (
            <Tabs
              value={selectedDate}
              onValueChange={setSelectedDate}
              className="w-full"
            >
              <TabsList className="mb-4">
                {jobDates.map((date) => (
                  <TabsTrigger
                    key={format(date, 'yyyy-MM-dd')}
                    value={format(date, 'yyyy-MM-dd')}
                  >
                    {formatTabDate(date)}
                  </TabsTrigger>
                ))}
              </TabsList>
              {jobDates.map((date) => (
                <TabsContent
                  key={format(date, 'yyyy-MM-dd')}
                  value={format(date, 'yyyy-MM-dd')}
                >
                  <ArtistTable
                    artists={artists}
                    isLoading={isLoading}
                    onEditArtist={handleEditArtist}
                  />
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <ArtistTable
              artists={artists}
              isLoading={isLoading}
              onEditArtist={handleEditArtist}
            />
          )}
        </CardContent>
      </Card>

      <ArtistManagementDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        artist={selectedArtist}
        jobId={jobId}
        selectedDate={selectedDate}
      />
    </div>
  );
};

export default FestivalArtistManagement;
