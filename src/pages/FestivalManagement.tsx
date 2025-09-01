import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Music2, Layout, Calendar, Printer, Loader2 } from "lucide-react";
import createFolderIcon from "@/assets/icons/icon.png";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { format, isValid, parseISO } from "date-fns";
import { FestivalLogoManager } from "@/components/festival/FestivalLogoManager";
import { FestivalScheduling } from "@/components/festival/scheduling/FestivalScheduling";
import { PrintOptionsDialog, PrintOptions } from "@/components/festival/pdf/PrintOptionsDialog";
import { useAuth } from "@/hooks/useAuth";
import { generateAndMergeFestivalPDFs } from "@/utils/pdf/festivalPdfGenerator";
import { useFlexUuid } from "@/hooks/useFlexUuid";
import { generateIndividualStagePDFs } from "@/utils/pdf/individualStagePdfGenerator";
import { FestivalWeatherSection } from "@/components/festival/FestivalWeatherSection";

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
  const [venueData, setVenueData] = useState<{
    address?: string;
    coordinates?: { lat: number; lng: number };
  }>({});
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const { userRole } = useAuth();
  const [maxStages, setMaxStages] = useState(1);
  const { flexUuid, isLoading: isFlexLoading, error: flexError, folderExists } = useFlexUuid(jobId || '');

  const isSchedulingRoute = location.pathname.includes('/scheduling');
  const isArtistRoute = location.pathname.includes('/artists');
  const isGearRoute = location.pathname.includes('/gear');
  
  const canEdit = ['admin', 'management', 'logistics'].includes(userRole || '');
  const isViewOnly = userRole === 'technician';

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

        // Fetch maximum stages from festival_gear_setups
        const { data: gearSetups, error: gearError } = await supabase
          .from("festival_gear_setups")
          .select("max_stages")
          .eq("job_id", jobId)
          .order("created_at", { ascending: false })
          .limit(1);
          
        if (gearError) {
          console.error("Error fetching gear setup:", gearError);
        } else if (gearSetups && gearSetups.length > 0) {
          setMaxStages(gearSetups[0].max_stages || 1);
        }

        setJob(jobData);
        setArtistCount(artistCount || 0);

        // Fetch venue data from hoja_de_ruta table
        const { data: hojaData, error: hojaError } = await supabase
          .from("hoja_de_ruta")
          .select("venue_address, venue_latitude, venue_longitude")
          .eq("job_id", jobId)
          .single();

        if (!hojaError && hojaData) {
          setVenueData({
            address: hojaData.venue_address || undefined,
            coordinates: hojaData.venue_latitude && hojaData.venue_longitude 
              ? { 
                  lat: hojaData.venue_latitude, 
                  lng: hojaData.venue_longitude 
                }
              : undefined
          });
        } else {
          console.log("No venue data found in hoja_de_ruta for this job");
        }

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

  const handlePrintAllDocumentation = async (options: PrintOptions, filename: string) => {
    if (!jobId) return;
    
    setIsPrinting(true);
    try {
      console.log("Starting documentation print process with options:", options);
      
      let result: { blob: Blob; filename: string };
      
      if (options.generateIndividualStagePDFs) {
        console.log("Generating individual stage PDFs");
        result = await generateIndividualStagePDFs(jobId, job?.title || 'Festival', options, maxStages);
      } else {
        console.log("Generating combined PDF");
        result = await generateAndMergeFestivalPDFs(jobId, job?.title || 'Festival', options, filename);
      }
      
      console.log(`Generated file, size: ${result.blob.size} bytes`);
      if (!result.blob || result.blob.size === 0) {
        throw new Error('Generated file is empty');
      }
      
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: options.generateIndividualStagePDFs 
          ? 'Individual stage PDFs generated successfully'
          : 'Documentation generated successfully'
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

  const handlePrintButtonClick = () => {
    setIsPrintDialogOpen(true);
  };

  const handleFlexClick = () => {
    if (isFlexLoading) {
      toast({
        title: "Loading",
        description: "Please wait while we load the Flex folder...",
      });
      return;
    }

    if (flexUuid) {
      const flexUrl = `https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/${flexUuid}/view/simple-element/header`;
      window.open(flexUrl, '_blank', 'noopener');
    } else if (flexError) {
      toast({
        title: "Error",
        description: flexError,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Info",
        description: "Flex folder not available for this festival",
      });
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
                  onClick={handlePrintButtonClick}
                  disabled={isPrinting}
                >
                  {isPrinting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="h-4 w-4" />
                  )}
                  {isPrinting ? 'Generating...' : 'Print Documentation'}
                </Button>
              )}
              {/* Only show Flex button if folder exists or is loading */}
              {canEdit && (folderExists || isFlexLoading) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={handleFlexClick}
                  disabled={!flexUuid || isFlexLoading}
                >
                  {isFlexLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <img src={createFolderIcon} alt="Flex" className="h-4 w-4" />
                  )}
                  {isFlexLoading ? 'Loading...' : 'Flex'}
                </Button>
              )}
              {canEdit && <FestivalLogoManager jobId={jobId} />}
            </div>
          </div>
        </CardHeader>
      </Card>

      {!isSchedulingRoute && !isArtistRoute && !isGearRoute && (
        <>
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
          
          {/* Add Weather Section */}
          <FestivalWeatherSection
            jobId={jobId}
            venue={venueData}
            jobDates={jobDates}
          />
        </>
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
      
      {isPrintDialogOpen && (
        <PrintOptionsDialog
          open={isPrintDialogOpen}
          onOpenChange={setIsPrintDialogOpen}
          onConfirm={handlePrintAllDocumentation}
          maxStages={maxStages}
          jobTitle={job?.title || ''}
          jobId={jobId}
        />
      )}
    </div>
  );
};

export default FestivalManagement;
