
import { JobCard } from "@/components/jobs/JobCard";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { ReloadButton } from "@/components/ui/reload-button";

interface JobDocument {
  id: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
}

interface Assignment {
  job_id: string;
  jobs: any;
  festival_jobs?: any;
}

interface AssignmentsListProps {
  assignments: Assignment[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}

export const AssignmentsList = ({ assignments, loading, onRefresh }: AssignmentsListProps) => {
  const { toast } = useToast();
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    console.log("Setting up real-time subscription for job assignments");
    
    const channel = supabase
      .channel('job_assignments_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_assignments'
        },
        async (payload) => {
          console.log("Received real-time update for job assignments:", payload);
          // The parent component will handle the refresh through React Query
        }
      )
      .subscribe();

    return () => {
      console.log("Cleaning up real-time subscription");
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDownload = async (jobDocument: JobDocument) => {
    try {
      console.log("Downloading document:", jobDocument);
      
      const { data, error } = await supabase.storage
        .from('job_documents')
        .download(jobDocument.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = jobDocument.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download Started",
        description: `Downloading ${jobDocument.file_name}`,
      });
    } catch (error: any) {
      console.error("Download error:", error);
      setHasError(true);
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // For debugging
  useEffect(() => {
    console.log("Current assignments data:", assignments);
    if (assignments && assignments.length > 0) {
      setHasError(false);
    }
  }, [assignments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading assignments...</p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="flex items-center text-yellow-500 gap-2">
          <AlertTriangle />
          <p>There was an error loading your assignments</p>
        </div>
        <ReloadButton onReload={onRefresh} />
      </div>
    );
  }

  if (!assignments || assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <p className="text-muted-foreground">No upcoming assignments found.</p>
        <ReloadButton onReload={onRefresh} />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {assignments.map((assignment) => {
        console.log("Rendering assignment:", assignment);
        
        // Handle both regular and festival jobs
        const jobData = assignment.jobs || assignment.festival_jobs;
        
        if (!jobData) {
          console.warn("Missing job data for assignment:", assignment.job_id);
          return null;
        }
        
        return (
          <div key={assignment.job_id} className="space-y-4">
            <JobCard
              job={jobData}
              onEditClick={() => {}}
              onDeleteClick={() => {}}
              onJobClick={() => {}}
              department="sound"
              userRole="technician"
            />
            {jobData.job_documents?.length > 0 && (
              <div className="ml-4 space-y-2">
                <h3 className="text-sm font-medium">Documents:</h3>
                <div className="grid gap-2">
                  {jobData.job_documents.map((doc: JobDocument) => (
                    <Button
                      key={doc.id}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2"
                      onClick={() => handleDownload(doc)}
                    >
                      <Download className="h-4 w-4" />
                      {doc.file_name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
      <div className="flex justify-end mt-2">
        <ReloadButton onReload={onRefresh} className="ml-auto" />
      </div>
    </div>
  );
};
