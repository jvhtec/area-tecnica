
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Department } from "@/types/department";
import { JobDocument } from "@/types/job";
import { useCallback } from "react";
import { deleteJobOptimistically } from "@/services/optimisticJobDeletionService";
import { resolveJobDocBucket } from "@/utils/jobDocuments";

export const useOptimisticJobManagement = (
  selectedDepartment: Department,
  startDate: Date,
  endDate: Date,
  isProjectManagementPage = false
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchJobs = useCallback(async () => {
    console.log("useOptimisticJobManagement: Fetching jobs for department:", selectedDepartment);
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
          visible_to_tech,
          uploaded_at,
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
      console.error("useOptimisticJobManagement: Error fetching jobs:", error);
      throw error;
    }

    const jobsWithFilteredDocs = data.map((job) => ({
      ...job,
      job_documents: job.job_documents.filter((doc: any) => {
        console.log(
          "useOptimisticJobManagement: Checking document path:",
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
      "useOptimisticJobManagement: Jobs fetched with filtered documents:",
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
      console.log("useOptimisticJobManagement: Deleting document:", document);

      // Delete from storage
      const bucket = resolveJobDocBucket(document.file_path);
      const { error: storageError } = await supabase.storage
        .from(bucket)
        .remove([document.file_path]);

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
      console.error("useOptimisticJobManagement: Error deleting document:", error);
      toast({
        title: "Error",
        description: "Failed to delete document: " + error.message,
        variant: "destructive"
      });
    }
  };

  const deleteJob = async (jobId: string) => {
    try {
      console.log("useOptimisticJobManagement: Starting optimistic job deletion for:", jobId);
      
      // Perform optimistic update - remove job from cache immediately
      queryClient.setQueryData(
        ["jobs", selectedDepartment, startDate, endDate],
        (oldJobs: any[]) => {
          if (!oldJobs) return oldJobs;
          return oldJobs.filter(job => job.id !== jobId);
        }
      );

      // Call optimistic deletion service
      const result = await deleteJobOptimistically(jobId);
      
      if (result.success) {
        toast({
          title: "Job deleted",
          description: result.details || "The job has been removed and cleanup is running in background."
        });
      } else {
        // Restore job in cache if deletion failed
        queryClient.invalidateQueries({ queryKey: ["jobs"] });
        throw new Error(result.error || "Unknown deletion error");
      }
    } catch (error: any) {
      console.error("useOptimisticJobManagement: Error in optimistic job deletion:", error);
      toast({
        title: "Error deleting job",
        description: error.message,
        variant: "destructive"
      });
      
      // Restore the cache by refetching
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
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
