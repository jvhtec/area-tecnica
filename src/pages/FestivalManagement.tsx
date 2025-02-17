
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Music2, Layout, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format, eachDayOfInterval, isValid } from "date-fns";
import { FestivalGearSetupForm } from "@/components/festival/FestivalGearSetupForm";

interface FestivalJob {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
}

const FestivalManagement = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [job, setJob] = useState<FestivalJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [artistCount, setArtistCount] = useState(0);
  const [selectedDate, setSelectedDate] = useState("");
  const [jobDates, setJobDates] = useState<Date[]>([]);

  useEffect(() => {
    const fetchJobDetails = async () => {
      try {
        if (!jobId) return;

        const { data: jobData, error: jobError } = await supabase
          .from("jobs")
          .select("*")
          .eq("id", jobId)
          .single();

        if (jobError) throw jobError;

        const { count: artistCount, error: artistError } = await supabase
          .from("festival_artists")
          .select("*", { count: 'exact' })
          .eq("job_id", jobId);

        if (artistError) throw artistError;

        setJob(jobData);
        setArtistCount(artistCount || 0);

        const startDate = new Date(jobData.start_time);
        const endDate = new Date(jobData.end_time);
        
        if (isValid(startDate) && isValid(endDate)) {
          const dates = eachDayOfInterval({ start: startDate, end: endDate });
          setJobDates(dates);
          const formattedDate = format(dates[0], 'yyyy-MM-dd');
          setSelectedDate(formattedDate);
        }
      } catch (error: any) {
        console.error("Error fetching festival details:", error);
        toast({
          title: "Error",
          description: "Could not load festival details",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobDetails();
  }, [jobId]);

  if (!jobId) {
    return <div>Job ID is required</div>;
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!job) {
    return <div>Festival not found</div>;
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Music2 className="h-6 w-6" />
                {job.title}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {new Date(job.start_time).toLocaleDateString()} - {new Date(job.end_time).toLocaleDateString()}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="gear">Festival Gear</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Artists Section */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/festival-management/${jobId}/artists`)}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Artists
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{artistCount}</p>
                <p className="text-sm text-muted-foreground">Total Artists</p>
                <Button className="mt-4 w-full" onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/festival-management/${jobId}/artists`);
                }}>
                  Manage Artists
                </Button>
              </CardContent>
            </Card>

            {/* Stages Section - Placeholder */}
            <Card className="opacity-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layout className="h-5 w-5" />
                  Stages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Coming soon</p>
              </CardContent>
            </Card>

            {/* Technical Requirements - Placeholder */}
            <Card className="opacity-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Technical Requirements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Coming soon</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="gear">
          {selectedDate && (
            <FestivalGearSetupForm 
              jobId={jobId} 
              selectedDate={selectedDate}
              onSave={() => {
                toast({
                  title: "Success",
                  description: "Festival gear setup has been updated.",
                });
              }}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FestivalManagement;
