
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useJobs } from "@/hooks/useJobs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { JobCard } from "@/components/jobs/JobCard";
import { Separator } from "@/components/ui/separator";
import { Tent } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { generateAndMergeFestivalPDFs } from "@/utils/pdfMerger";

const Festivals = () => {
  const navigate = useNavigate();
  const { data: jobs, isLoading } = useJobs();
  const [festivalJobs, setFestivalJobs] = useState<any[]>([]);
  const [festivalLogos, setFestivalLogos] = useState<Record<string, string>>({});
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  useEffect(() => {
    if (jobs) {
      // Filter jobs to only include those with job_type 'festival'
      const festivals = jobs.filter(job => job.job_type === 'festival');
      setFestivalJobs(festivals);
      
      // Fetch logos for all festival jobs
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
    navigate(`/festival-management/${jobId}`);
  };

  const handleGenerateDocumentation = async (jobId: string, jobTitle: string) => {
    try {
      setGeneratingPdf(jobId);
      toast.info("Generating documentation. This may take a moment...");

      const pdfBlob = await generateAndMergeFestivalPDFs(jobId, jobTitle);
      
      // Create a download link
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${jobTitle.replace(/\s+/g, '_')}_Documentation.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Documentation generated successfully!");
    } catch (error) {
      console.error("Error generating documentation:", error);
      toast.error("Failed to generate documentation. Please try again.");
    } finally {
      setGeneratingPdf(null);
    }
  };

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
                <div key={job.id} onClick={() => handleJobClick(job.id)} className="cursor-pointer">
                  <JobCard 
                    job={job} 
                    onJobClick={() => handleJobClick(job.id)} 
                    onEditClick={() => {}} // Empty function as we're removing edit functionality
                    onDeleteClick={() => {}}
                    onGenerateDocumentation={handleGenerateDocumentation}
                    userRole="management"
                    department="sound"
                    festivalLogo={festivalLogos[job.id]}
                  />
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
