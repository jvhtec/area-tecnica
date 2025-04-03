
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFestivalsData } from "@/hooks/festival/useFestivalsData";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { JobCard } from "@/components/jobs/JobCard";
import { Separator } from "@/components/ui/separator";
import { Tent, Printer, Loader2, RefreshCw, AlertTriangle, Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { generateAndMergeFestivalPDFs } from "@/utils/pdf/festivalPdfGenerator";
import { useAuthSession } from "@/hooks/auth/useAuthSession";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const Festivals = () => {
  const navigate = useNavigate();
  const { 
    festivals, 
    isLoading, 
    isError, 
    error, 
    isRefreshing, 
    refetch, 
    connectionStatus 
  } = useFestivalsData();
  
  const [festivalJobs, setFestivalJobs] = useState<any[]>([]);
  const [festivalLogos, setFestivalLogos] = useState<Record<string, string>>({});
  const [isPrinting, setIsPrinting] = useState<Record<string, boolean>>({});
  const { userRole } = useAuthSession();

  useEffect(() => {
    if (festivals) {
      setFestivalJobs(festivals);
      festivals.forEach(fetchFestivalLogo);
    }
  }, [festivals]);

  const fetchFestivalLogo = async (job: any) => {
    try {
      const { data, error } = await supabase
        .from('festival_logos')
        .select('file_path')
        .eq('job_id', job.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching logo:', error);
        return;
      }

      if (data?.file_path) {
        const { data: { publicUrl } } = supabase
          .storage
          .from('festival-logos')
          .getPublicUrl(data.file_path);
        
        setFestivalLogos(prev => ({
          ...prev,
          [job.id]: publicUrl
        }));
      }
    } catch (err) {
      console.error('Error in fetchFestivalLogo:', err);
    }
  };

  const handleJobClick = (jobId: string) => {
    navigate(`/festival-management/${jobId}`);
  };

  const handlePrintAllDocumentation = async (jobId: string, jobTitle: string) => {
    setIsPrinting(prev => ({ ...prev, [jobId]: true }));
    
    try {
      console.log("Starting document generation for festival:", jobTitle);
      const mergedPdf = await generateAndMergeFestivalPDFs(jobId, jobTitle);
      
      if (!mergedPdf || mergedPdf.size === 0) {
        throw new Error('Generated PDF is empty');
      }
      
      const url = URL.createObjectURL(mergedPdf);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${jobTitle}_Complete_Documentation.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Documentation generated successfully');
    } catch (error: any) {
      console.error('Error generating documentation:', error);
      toast.error(`Failed to generate documentation: ${error.message}`);
    } finally {
      setIsPrinting(prev => ({ ...prev, [jobId]: false }));
    }
  };

  // Check if user can print documentation
  const canPrintDocuments = ['admin', 'management', 'logistics'].includes(userRole || '');

  // Empty functions for onEditClick and onDeleteClick since we don't want those buttons
  const emptyFunction = () => {};

  const getConnectionStatusIcon = () => {
    if (connectionStatus === 'connecting') {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    } else if (connectionStatus === 'connected') {
      return <Wifi className="h-4 w-4 text-green-500" />;
    } else {
      return <WifiOff className="h-4 w-4 text-red-500" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-4">
            <CardTitle className="text-2xl font-bold">Festival Management</CardTitle>
            <Tent className="h-6 w-6 text-muted-foreground" />
          </div>
          
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center mr-2">
                    {getConnectionStatusIcon()}
                    <span className="ml-1 text-xs">
                      {connectionStatus === 'connected' ? 'Live' : 
                       connectionStatus === 'connecting' ? 'Connecting...' : 'Offline'}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    {connectionStatus === 'connected' 
                      ? 'Real-time updates active' 
                      : connectionStatus === 'connecting'
                      ? 'Establishing connection...'
                      : 'Real-time updates offline - click refresh for latest data'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refetch} 
              disabled={isLoading || isRefreshing}
              className="ml-2"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            Access and manage all festival-type events in one place.
          </p>
          <Separator className="my-6" />
          
          {isLoading ? (
            <div className="flex flex-col justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin mb-2 text-primary" />
              <p className="text-muted-foreground">Loading festivals...</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col justify-center items-center h-40 text-center">
              <AlertTriangle className="h-8 w-8 mb-2 text-destructive" />
              <h3 className="text-lg font-medium text-destructive">Error loading festivals</h3>
              <p className="text-muted-foreground mt-2 max-w-md">
                {error instanceof Error ? error.message : 'An unknown error occurred'}
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refetch}
                className="mt-4"
              >
                Try Again
              </Button>
            </div>
          ) : festivalJobs.length === 0 ? (
            <div className="text-center py-10">
              <h3 className="text-lg font-medium">No festivals found</h3>
              <p className="text-muted-foreground mt-2">
                There are currently no festival-type jobs scheduled.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {festivalJobs.map((job) => (
                <div key={job.id} className="relative">
                  <div onClick={() => handleJobClick(job.id)} className="cursor-pointer">
                    <JobCard 
                      job={job} 
                      onJobClick={() => handleJobClick(job.id)} 
                      onEditClick={emptyFunction} 
                      onDeleteClick={emptyFunction}
                      userRole={userRole}
                      department="sound"
                      festivalLogo={festivalLogos[job.id]}
                      hideFestivalControls={true}
                    />
                  </div>
                  {canPrintDocuments && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2 z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrintAllDocumentation(job.id, job.title);
                      }}
                      disabled={isPrinting[job.id]}
                    >
                      {isPrinting[job.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Printer className="h-4 w-4" />
                      )}
                      <span className="sr-only">Print Documentation</span>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Festivals;
