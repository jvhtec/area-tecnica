import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Calendar, MapPin, FileText, Settings, UserCheck, RefreshCw, LogOut, FileImage, Cloud } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { FestivalScheduling } from "@/components/festival/scheduling/FestivalScheduling";
import { FestivalWeatherSection } from "@/components/festival/FestivalWeatherSection";
import { PrintOptionsDialog } from "@/components/festival/pdf/PrintOptionsDialog";
import { generateAndMergeFestivalPDFs } from "@/utils/pdf/festivalPdfGenerator";
import { JobExtrasManagement } from "@/components/jobs/JobExtrasManagement";

interface UnifiedJobManagementProps {
  mode: 'job' | 'festival';
}

interface FestivalJob {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location?: string;
  description?: string;
  job_type: string;
  client: string;
}

interface Artist {
  id: string;
  name: string;
  stage: number;
  date: string;
  show_start: string;
  show_end: string;
}

interface Stage {
  id: string;
  stage_number: number;
  name: string;
}

export const UnifiedJobManagement = ({ mode }: UnifiedJobManagementProps) => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [job, setJob] = useState<FestivalJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [artistCount, setArtistCount] = useState(0);
  const [dates, setDates] = useState<Date[]>([]);
  const [venue, setVenue] = useState<{ address?: string; lat?: number; lng?: number } | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [maxStages, setMaxStages] = useState(1);
  const [showPrintDialog, setShowPrintDialog] = useState(false);

  const { data: logoUrl } = useQuery({
    queryKey: ['festival-logo', jobId],
    queryFn: async () => {
      if (!jobId) return null;
      
      const { data, error } = await supabase.storage
        .from('festival-logos')
        .list(`${jobId}/`, {
          limit: 1,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error || !data?.length) return null;

      const { data: urlData } = supabase.storage
        .from('festival-logos')
        .getPublicUrl(`${jobId}/${data[0].name}`);

      return urlData.publicUrl;
    },
    enabled: !!jobId
  });

  // Fetch job details
  useEffect(() => {
    const fetchJobDetails = async () => {
      if (!jobId) return;

      try {
        const { data, error } = await supabase
          .from('jobs')
          .select('*')
          .eq('id', jobId)
          .single();

        if (error) {
          console.error('Error fetching job:', error);
          toast({
            title: "Error",
            description: "Failed to load job details",
            variant: "destructive"
          });
          return;
        }

        setJob(data);
        
        // Calculate date range
        const startDate = new Date(data.start_time);
        const endDate = new Date(data.end_time);
        const dateArray = [];
        let currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
          dateArray.push(new Date(currentDate));
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        setDates(dateArray);
      } catch (error) {
        console.error('Error in fetchJobDetails:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchJobDetails();
  }, [jobId, toast]);

  // Fetch artist count for festivals
  useEffect(() => {
    if (mode === 'festival' && jobId) {
      const fetchArtistCount = async () => {
        const { data, error } = await supabase
          .from('festival_artists')
          .select('id')
          .eq('job_id', jobId);
        
        if (!error && data) {
          setArtistCount(data.length);
        }
      };

      fetchArtistCount();
    }
  }, [jobId, mode]);

  // Fetch gear setup info for festivals
  useEffect(() => {
    if (mode === 'festival' && jobId) {
      const fetchGearSetup = async () => {
        const { data, error } = await supabase
          .from('festival_gear_setup')
          .select('max_stages')
          .eq('job_id', jobId)
          .single();
        
        if (!error && data) {
          setMaxStages(data.max_stages || 1);
        }
      };

      fetchGearSetup();
    }
  }, [jobId, mode]);

  // Fetch venue data for weather
  useEffect(() => {
    if (jobId) {
      const fetchVenueData = async () => {
        const { data: hojaData, error } = await supabase
          .from('hoja_de_ruta')
          .select('venue_address, venue_lat, venue_lng')
          .eq('job_id', jobId)
          .single();

        if (!error && hojaData) {
          setVenue({
            address: hojaData.venue_address,
            lat: hojaData.venue_lat,
            lng: hojaData.venue_lng
          });
        }
      };

      fetchVenueData();
    }
  }, [jobId]);

  const handlePrintAllDocumentation = async (options: any, filename: string) => {
    if (!job || !jobId) return;

    setIsPrinting(true);
    try {
      const result = await generateAndMergeFestivalPDFs(jobId, job.title, options, filename);
      
      // Create download link
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success!",
        description: "Documentation has been generated and downloaded."
      });
    } catch (error) {
      console.error('Error generating documentation:', error);
      toast({
        title: "Error",
        description: "Failed to generate documentation. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleFlexClick = () => {
    if (!job) return;
    
    const baseUrl = "https://ws.flex.es/";
    const companyId = "10041";
    
    window.open(`${baseUrl}?company=${companyId}`, '_blank');
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading {mode} management...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">{mode === 'festival' ? 'Festival' : 'Job'} Not Found</h2>
              <p className="text-muted-foreground">
                The requested {mode} could not be found.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSchedulingRoute = window.location.pathname.includes('/scheduling');
  const startDate = new Date(job.start_time);
  const endDate = new Date(job.end_time);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          
          {logoUrl && (
            <img 
              src={logoUrl} 
              alt={`${job.title} logo`}
              className="h-12 w-auto object-contain"
            />
          )}
          
          <div>
            <h1 className="text-2xl font-bold">
              {mode === 'festival' ? 'Festival Management' : 'Job Management'}
            </h1>
            <h2 className="text-xl text-muted-foreground">{job.title}</h2>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {mode === 'festival' && (
            <>
              <Button 
                onClick={() => setShowPrintDialog(true)}
                disabled={isPrinting}
                variant="outline"
                className="flex items-center gap-2"
              >
                {isPrinting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Print
                  </>
                )}
              </Button>
              <Button 
                onClick={handleFlexClick}
                variant="outline"
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Flex
              </Button>
              <Button 
                onClick={() => navigate(`/festival-management/${jobId}/gear`)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <FileImage className="h-4 w-4" />
                Logo Manager
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {mode === 'festival' ? 'Artists' : 'Personnel'}
            </CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{artistCount}</div>
            <p className="text-xs text-muted-foreground">
              {mode === 'festival' ? 'Registered artists' : 'Assigned personnel'}
            </p>
            <Button 
              className="w-full mt-4" 
              onClick={() => navigate(`/${mode}-management/${jobId}/artists`)}
            >
              {mode === 'festival' ? 'Artist Management' : 'Personnel Management'}
            </Button>
          </CardContent>
        </Card>

        {mode === 'festival' && (
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stages & Gear</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{maxStages}</div>
              <p className="text-xs text-muted-foreground">
                Maximum stages configured
              </p>
              <Button 
                className="w-full mt-4" 
                onClick={() => navigate(`/festival-management/${jobId}/gear`)}
              >
                Equipment
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduling</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dates.length}</div>
            <p className="text-xs text-muted-foreground">
              {format(startDate, "MMM d")} - {format(endDate, "MMM d, yyyy")}
            </p>
            <Button 
              className="w-full mt-4" 
              onClick={() => navigate(`/${mode}-management/${jobId}/scheduling`)}
            >
              Scheduling
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Job Extras Management Section */}
      <JobExtrasManagement jobId={jobId || ''} isManager={true} />

      {venue && venue.address && venue.lat && venue.lng && (
        <FestivalWeatherSection
          jobId={jobId || ''}
          jobDates={dates}
          venue={{
            address: venue.address,
            coordinates: {
              lat: venue.lat,
              lng: venue.lng
            }
          }}
        />
      )}

      {isSchedulingRoute && mode === 'festival' && (
        <FestivalScheduling
          jobId={jobId}
          jobDates={dates}
          isViewOnly={false}
        />
      )}

      {mode === 'festival' && (
        <PrintOptionsDialog
          open={showPrintDialog}
          onOpenChange={setShowPrintDialog}
          onConfirm={handlePrintAllDocumentation}
          maxStages={maxStages}
          jobTitle={job?.title || ''}
          jobId={jobId}
        />
      )}
    </div>
  );
};