import { JobCard } from "@/components/jobs/JobCard";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useEffect } from "react";

interface JobDocument {
  id: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
}

interface Assignment {
  job_id: string;
  jobs: any;
}

interface AssignmentsListProps {
  assignments: Assignment[];
  loading: boolean;
}

export const AssignmentsList = ({ assignments, loading }: AssignmentsListProps) => {
  const { toast } = useToast();

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
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">Loading assignments...</p>;
  }

  if (assignments.length === 0) {
    return <p className="text-muted-foreground">No upcoming assignments found.</p>;
  }

  return (
    <div className="grid gap-4">
      {assignments.map((assignment) => (
        <div key={assignment.job_id} className="space-y-4">
          <JobCard
            job={assignment.jobs}
            onEditClick={() => {}}
            onDeleteClick={() => {}}
            onJobClick={() => {}}
            department="sound"
            userRole="technician"
          />
          {assignment.jobs.job_documents?.length > 0 && (
            <div className="ml-4 space-y-2">
              <h3 className="text-sm font-medium">Documents:</h3>
              <div className="grid gap-2">
                {assignment.jobs.job_documents.map((doc: JobDocument) => (
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
      ))}
    </div>
  );
};