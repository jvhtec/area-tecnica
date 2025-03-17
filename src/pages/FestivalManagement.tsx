
import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Music2, Layout, Calendar, Printer, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { format, isValid, parseISO } from "date-fns";
import { FestivalLogoManager } from "@/components/festival/FestivalLogoManager";
import { FestivalScheduling } from "@/components/festival/scheduling/FestivalScheduling";
import { generateAndMergeFestivalPDFs } from "@/utils/pdfMerger";
import { useAuthSession } from "@/hooks/auth/useAuthSession";

interface FestivalJob {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
}

interface Artist {
  id: string;
  name: string;
  stage: number;
  date: string;
  profile_complete: boolean;
  soundcheck_start?: string;
  soundcheck_end?: string;
  show_start: string;
  show_end: string;
  technical_info: any;
  infrastructure_info: any;
  extras: any;
  notes?: string;
}

interface Stage {
  id: string;
  name: string;
  number: number;
}

const FestivalManagement = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [job, setJob] = useState<FestivalJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [artistCount, setArtistCount] = useState(0);
  const [jobDates, setJobDates] = useState<Date[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const { userRole } = useAuthSession();

  const isSchedulingRoute = location.pathname.includes('/scheduling');
  
  // Determine user permissions
  const canEdit = ['admin', 'management', 'logistics'].includes(userRole || '');
  const isViewOnly = userRole === 'technician'; // Technicians have view-only access

  useEffect(() => {
    const fetchJobDetails = async () => {
      try {
        if (!jobId) {
          console.log("No jobId provided");
          return;
        }

        console.log("Fetching job details for jobId:", jobId);

        const { data: jobData, error: jobError } = await supabase
          .from("jobs")
          .select("*")
          .eq("id", jobId)
          .single();

        if (jobError) {
          console.error("Error fetching job data:", jobError);
          throw jobError;
        }

        console.log("Job data retrieved:", jobData);

        const { count: artistCount, error: artistError } = await supabase
          .from("festival_artists")
          .select("*", { count: 'exact' })
          .eq("job_id", jobId);

        if (artistError) {
          console.error("Error fetching artist count:", artistError);
          throw artistError;
        }

        setJob(jobData);
        setArtistCount(artistCount || 0);

        const startDate = new Date(jobData.start_time);
        const endDate = new Date(jobData.end_time);
        
        console.log("Start date:", startDate);
        console.log("End date:", endDate);
        
        if (isValid(startDate) && isValid(endDate)) {
          try {
            const dates = [];
            const currentDate = new Date(startDate);
            
            while (currentDate <= endDate) {
              dates.push(new Date(currentDate));
              currentDate.setDate(currentDate.getDate() + 1);
            }
            
            console.log("Generated job dates:", dates);
            setJobDates(dates);
          } catch (dateError) {
            console.error("Error generating date interval:", dateError);
            
            console.log("Using fallback date approach");
            const dateArray = [];
            if (isValid(startDate)) dateArray.push(startDate);
            if (isValid(endDate) && endDate.getTime() !== startDate?.getTime()) dateArray.push(endDate);
            
            console.log("Fallback dates:", dateArray);
            setJobDates(dateArray);
          }
        } else {
          console.warn("Invalid dates in job data, checking for date types");
          
          const { data: dateTypes, error: dateTypesError } = await supabase
            .from("job_date_types")
            .select("*")
            .eq("job_id", jobId);
            
          if (dateTypesError) {
            console.error("Error fetching date types:", dateTypesError);
          } else if (dateTypes && dateTypes.length > 0) {
            console.log("Date types found:", dateTypes);
            
            const uniqueDates = Array.from(new Set(
              dateTypes
                .map(dt => {
                  try {
                    return new Date(dt.date);
                  } catch (e) {
                    return null;
                  }
                })
                .filter(date => date && isValid(date))
            )) as Date[];
            
            console.log("Unique dates from date_types:", uniqueDates);
            setJobDates(uniqueDates);
          } else {
            console.warn("No valid dates found for this job");
            setJobDates([new Date()]);
          }
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

  const handlePrintAllDocumentation = async () => {
    if (!jobId) return;
    
    setIsPrinting(true);
    try {
      console.log("Starting all documentation print process");
      
      const mergedPdf = await generateAndMergeFestivalPDFs(jobId, job?.title || 'Festival');
      
      console.log(`Merged PDF created, size: ${mergedPdf.size} bytes`);
      if (!mergedPdf || mergedPdf.size === 0) {
        throw new Error('Generated PDF is empty');
      }
      
      const url = URL.createObjectURL(mergedPdf);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${job?.title || 'Festival'}_Complete_Documentation.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: 'All documentation generated successfully'
      });
    } catch (error: any) {
      console.error('Error generating documentation:', error);
      toast({
        title: "Error",
        description: `Failed to generate documentation: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsPrinting(false);
    }
  };

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
                {job?.title}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {new Date(job?.start_time || '').toLocaleDateString()} - {new Date(job?.end_time || '').toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2 items-center">
              {canEdit && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={handlePrintAllDocumentation}
                  disabled={isPrinting}
                >
                  {isPrinting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="h-4 w-4" />
                  )}
                  {isPrinting ? 'Generating...' : 'Print All Documentation'}
                </Button>
              )}
              {canEdit && <FestivalLogoManager jobId={jobId} />}
            </div>
          </div>
        </CardHeader>
      </Card>

      {!isSchedulingRoute && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                {isViewOnly ? "View Artists" : "Manage Artists"}
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/festival-management/${jobId}/gear`)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layout className="h-5 w-5" />
                Stages & Gear
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Manage stages and technical equipment</p>
              <Button className="mt-4 w-full" onClick={(e) => {
                e.stopPropagation();
                navigate(`/festival-management/${jobId}/gear`);
              }}>
                {isViewOnly ? "View Gear" : "Manage Gear"}
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/festival-management/${jobId}/scheduling`)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Scheduling
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Manage shifts and staff assignments</p>
              <Button className="mt-4 w-full" onClick={(e) => {
                e.stopPropagation();
                navigate(`/festival-management/${jobId}/scheduling`);
              }}>
                {isViewOnly ? "View Schedule" : "Manage Schedule"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
      
      {isSchedulingRoute && (
        <div>
          <div className="mb-4">
            <Button 
              variant="outline" 
              onClick={() => navigate(`/festival-management/${jobId}`)}
              className="flex items-center gap-1"
            >
              Back to Festival
            </Button>
          </div>
          
          {jobDates.length > 0 ? (
            <FestivalScheduling jobId={jobId} jobDates={jobDates} isViewOnly={isViewOnly} />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground mb-4">No dates available for scheduling. Please update the festival dates first.</p>
                <Button onClick={() => navigate(`/festival-management/${jobId}`)}>
                  Go Back
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default FestivalManagement;
