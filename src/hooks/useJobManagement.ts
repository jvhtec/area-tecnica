
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Department } from "@/types/department";
import { JobDocument } from "@/types/job";
import { useCallback } from "react";
import { deleteJobOptimistically } from "@/services/optimisticJobDeletionService";
import { resolveJobDocLocation } from "@/utils/jobDocuments";

export const useJobManagement = (
  selectedDepartment: Department,
  startDate: Date,
  endDate: Date,
  isProjectManagementPage = false
) => {
  const { toast } = useToast();

  const fetchJobs = useCallback(async () => {
    console.log("useJobManagement: Fetching jobs for department:", selectedDepartment);
    const { data, error } = await supabase
      .from("jobs")
      .select(`
        *,
        location:locations(name),
        job_departments!inner(department),
        job_assignments(
          technician_id,
          sound_role,
          lights_role,
          video_role,
          profiles(
            first_name,
            last_name
          )
        ),
        job_documents(
          id,
          file_name,
          file_path,
          uploaded_at,
          visible_to_tech,
          read_only,
          template_type
        ),
        flex_folders(id)
      `)
      .eq("job_departments.department", selectedDepartment)
      .in("job_type", ["single", "festival","tourdate"])
      .gte("start_time", startDate.toISOString())
      .lte("start_time", endDate.toISOString())
      .order("start_time", { ascending: true });

    if (error) {
      console.error("useJobManagement: Error fetching jobs:", error);
      throw error;
    }

    const jobsWithFilteredDocs = data.map((job) => ({
      ...job,
      job_documents: job.job_documents.filter((doc: any) => {
        console.log(
          "useJobManagement: Checking document path:",
          doc.file_path,
          "for department:",
          selectedDepartment
        );
        return doc.file_path.startsWith(`${selectedDepartment}/`) || doc.template_type === 'soundvision';
      }),
      flex_folders_exist: job.flex_folders.length > 0,
      isProjectManagementPage
    }));

    console.log(
      "useJobManagement: Jobs fetched with filtered documents:",
      jobsWithFilteredDocs
    );
    return jobsWithFilteredDocs;
  }, [selectedDepartment, startDate, endDate, isProjectManagementPage]);

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ["jobs", selectedDepartment, startDate, endDate],
    queryFn: fetchJobs,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true
  });

  const handleDeleteDocument = async (jobId: string, document: JobDocument) => {
    if (document.read_only) {
      toast({
        title: "Cannot delete read-only document",
        description: "Template documents are attached automatically and cannot be removed manually.",
        variant: "destructive",
      });
      return;
    }
    try {
      console.log("useJobManagement: Deleting document:", document);

      // Delete from storage
      const { bucket, path } = resolveJobDocLocation(document.file_path);
      const { error: storageError } = await supabase.storage
        .from(bucket)
        .remove([path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("job_documents")
        .delete()
        .eq("id", document.id);

      if (dbError) throw dbError;

      // Broadcast push: document deleted (fire-and-forget)
      try {
        void supabase.functions.invoke('push', {
          body: { action: 'broadcast', type: 'document.deleted', job_id: jobId, file_name: document.file_name }
        });
      } catch {}

      toast({
        title: "Document deleted",
        description: "The document has been successfully deleted."
      });
    } catch (error: any) {
      console.error("useJobManagement: Error deleting document:", error);
      toast({
        title: "Error",
        description: "Failed to delete document: " + error.message,
        variant: "destructive"
      });
    }
  };

  const deleteJob = async (jobId: string) => {
    try {
      console.log("useJobManagement: Starting optimistic job deletion for:", jobId);
      
      const result = await deleteJobOptimistically(jobId);
      
      if (result.success) {
        toast({
          title: "Job deleted successfully",
          description: result.details || "The job has been removed and cleanup is running in background."
        });
      } else {
        throw new Error(result.error || "Unknown deletion error");
      }
    } catch (error: any) {
      console.error("useJobManagement: Error in optimistic job deletion:", error);
      toast({
        title: "Error deleting job",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    }
  };

  return {
    jobs,
    jobsLoading,
    handleDeleteDocument,
    deleteJob
  };
};
