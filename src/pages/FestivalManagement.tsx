
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
import { exportArtistPDF, ArtistPdfData } from "@/utils/artistPdfExport";
import { exportArtistTablePDF, ArtistTablePdfData } from "@/utils/artistTablePdfExport";
import { exportShiftsTablePDF } from "@/utils/shiftsTablePdfExport";
import { mergePDFs } from "@/utils/pdfMerger";
import { toast } from "sonner";

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

interface ShiftWithAssignments {
  id: string;
  job_id: string;
  name: string;
  date: string;
  start_time: string;
  end_time: string;
  department?: string;
  stage?: string;
  assignments: any[];
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

  // Check if URL contains "scheduling" to determine if we're on the scheduling page
  const isSchedulingRoute = location.pathname.includes('/scheduling');
  
  console.log("FestivalManagement - Current route:", location.pathname);
  console.log("FestivalManagement - Is scheduling route:", isSchedulingRoute);
  console.log("FestivalManagement - Job ID:", jobId);

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

        // Generate dates for the festival duration
        const startDate = new Date(jobData.start_time);
        const endDate = new Date(jobData.end_time);
        
        console.log("Start date:", startDate);
        console.log("End date:", endDate);
        
        if (isValid(startDate) && isValid(endDate)) {
          try {
            // Calculate days between start and end (inclusive)
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
            
            // Fallback: use just the start and end dates
            console.log("Using fallback date approach");
            const dateArray = [];
            if (isValid(startDate)) dateArray.push(startDate);
            if (isValid(endDate) && endDate.getTime() !== startDate?.getTime()) dateArray.push(endDate);
            
            console.log("Fallback dates:", dateArray);
            setJobDates(dateArray);
          }
        } else {
          console.warn("Invalid dates in job data, checking for date types");
          
          // Try to get dates from job_date_types table
          const { data: dateTypes, error: dateTypesError } = await supabase
            .from("job_date_types")
            .select("*")
            .eq("job_id", jobId);
            
          if (dateTypesError) {
            console.error("Error fetching date types:", dateTypesError);
          } else if (dateTypes && dateTypes.length > 0) {
            console.log("Date types found:", dateTypes);
            
            // Extract unique dates from date_types
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
            // Create a default date as fallback (today)
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
      // 1. Fetch all artists
      const { data: artists, error: artistError } = await supabase
        .from("festival_artists")
        .select("*, technical_info(*), infrastructure_info(*), extras(*)")
        .eq("job_id", jobId);
      
      if (artistError) throw artistError;
      
      // 2. Fetch all stages
      const { data: stages, error: stagesError } = await supabase
        .from("festival_stages")
        .select("*")
        .eq("job_id", jobId);
      
      if (stagesError) throw stagesError;

      // 3. Generate individual artist PDFs
      const artistPdfs: Blob[] = [];
      
      for (const artist of artists) {
        // Map artist data to ArtistPdfData format
        const artistData: ArtistPdfData = {
          name: artist.name,
          stage: artist.stage,
          date: artist.date,
          schedule: {
            show: { start: artist.show_start, end: artist.show_end },
            soundcheck: artist.soundcheck_start ? {
              start: artist.soundcheck_start,
              end: artist.soundcheck_end || ''
            } : undefined
          },
          technical: artist.technical_info,
          infrastructure: artist.infrastructure_info,
          extras: artist.extras,
          notes: artist.notes
        };
        
        try {
          const pdf = await exportArtistPDF(artistData);
          artistPdfs.push(pdf);
        } catch (err) {
          console.error(`Error generating PDF for artist ${artist.name}:`, err);
        }
      }
      
      // 4. Generate artist table PDFs for each date and stage
      const uniqueDates = [...new Set(artists.map(a => a.date))];
      const artistTablePdfs: Blob[] = [];
      
      for (const date of uniqueDates) {
        // Group artists by stage for this date
        const stageMap = new Map<number, any[]>();
        
        artists.filter(a => a.date === date).forEach(artist => {
          if (!stageMap.has(artist.stage)) {
            stageMap.set(artist.stage, []);
          }
          stageMap.get(artist.stage)?.push(artist);
        });
        
        // Generate table PDF for each stage on this date
        for (const [stageNum, stageArtists] of stageMap.entries()) {
          if (stageArtists.length === 0) continue;
          
          const stageName = stages?.find(s => s.number === stageNum)?.name || `Stage ${stageNum}`;
          
          // Format for artist table PDF
          const tableData: ArtistTablePdfData = {
            jobTitle: job?.title || 'Festival',
            date: date,
            stage: stageName,
            artists: stageArtists.map(a => ({
              name: a.name,
              stage: a.stage,
              showTime: { start: a.show_start, end: a.show_end },
              soundcheck: a.soundcheck_start ? { 
                start: a.soundcheck_start, 
                end: a.soundcheck_end || '' 
              } : undefined,
              technical: a.technical_info,
              extras: a.extras,
              notes: a.notes
            }))
          };
          
          try {
            const pdf = await exportArtistTablePDF(tableData);
            artistTablePdfs.push(pdf);
          } catch (err) {
            console.error(`Error generating table PDF for ${date} Stage ${stageNum}:`, err);
          }
        }
      }
      
      // 5. Generate shifts table PDFs for each date
      const shiftsPdfs: Blob[] = [];
      
      for (const date of uniqueDates) {
        // Fetch shifts for this date
        const { data: shifts, error: shiftsError } = await supabase
          .from("festival_shifts")
          .select(`
            id, job_id, name, date, start_time, end_time, department, stage,
            assignments:festival_shift_assignments(
              id, shift_id, technician_id, role,
              profiles:technician_id(id, first_name, last_name, email, department, role)
            )
          `)
          .eq("job_id", jobId)
          .eq("date", date);
        
        if (shiftsError) {
          console.error(`Error fetching shifts for date ${date}:`, shiftsError);
          continue;
        }
        
        if (shifts && shifts.length > 0) {
          try {
            const pdf = await exportShiftsTablePDF({
              jobTitle: job?.title || 'Festival',
              date: date,
              shifts: shifts as ShiftWithAssignments[]
            });
            shiftsPdfs.push(pdf);
          } catch (err) {
            console.error(`Error generating shifts PDF for date ${date}:`, err);
          }
        }
      }
      
      // 6. Merge all PDFs
      const allPdfs = [...artistPdfs, ...artistTablePdfs, ...shiftsPdfs];
      
      if (allPdfs.length === 0) {
        throw new Error('No documents were generated');
      }
      
      const mergedPdf = await mergePDFs(allPdfs);
      
      // 7. Create a download link and trigger download
      const url = URL.createObjectURL(mergedPdf);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${job?.title || 'Festival'}_Complete_Documentation.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('All documentation generated successfully');
    } catch (error: any) {
      console.error('Error generating documentation:', error);
      toast.error(`Failed to generate documentation: ${error.message}`);
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
              <FestivalLogoManager jobId={jobId} />
            </div>
          </div>
        </CardHeader>
      </Card>

      {!isSchedulingRoute && (
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

          {/* Stages & Gear Section */}
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
                Manage Gear
              </Button>
            </CardContent>
          </Card>

          {/* Scheduling Section */}
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
                Manage Schedule
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Scheduling content when on the scheduling route */}
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
            <FestivalScheduling jobId={jobId} jobDates={jobDates} />
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
