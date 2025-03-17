
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useJobs } from "@/hooks/useJobs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { JobCard } from "@/components/jobs/JobCard";
import { Separator } from "@/components/ui/separator";
import { Tent, Printer, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { generateAndMergeFestivalPDFs } from "@/utils/pdf/festivalPdfGenerator";
import { useAuthSession } from "@/hooks/auth/useAuthSession";

const Festivals = () => {
  const navigate = useNavigate();
  const { data: jobs, isLoading } = useJobs();
  const [festivalJobs, setFestivalJobs] = useState<any[]>([]);
  const [festivalLogos, setFestivalLogos] = useState<Record<string, string>>({});
  const [isPrinting, setIsPrinting] = useState<Record<string, boolean>>({});
  const { userRole } = useAuthSession();

  useEffect(() => {
    if (jobs) {
      const festivals = jobs.filter(job => job.job_type === 'festival');
      setFestivalJobs(festivals);
      
      festivals.forEach(fetchFestivalLogo);
    }
  }, [jobs]);

  const fetchFestivalLogo = async (job: any) => {
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
  };

  const handleJobClick = (jobId: string) => {
    // When clicking a job card, navigate to the view-only festival management page
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
      
      toast({
        title: "Success",
        description: 'Documentation generated successfully'
      });
    } catch (error: any) {
      console.error('Error generating documentation:', error);
      toast({
        title: "Error",
        description: `Failed to generate documentation: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsPrinting(prev => ({ ...prev, [jobId]: false }));
    }
  };

  // Check if user can print documentation
  const canPrintDocuments = ['admin', 'management', 'logistics'].includes(userRole || '');

  // Pass an empty function for edit/delete since we're hiding these on the festivals page
  const emptyFunction = () => {};

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold">Festival Management</CardTitle>
          <Tent className="h-6 w-6 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            Access and manage all festival-type events in one place.
          </p>
          <Separator className="my-6" />
          
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white" />
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
