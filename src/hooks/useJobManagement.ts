import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Department } from "@/types/department";
import { JobDocument } from "@/types/job";
import { useCallback } from "react";

export const useJobManagement = (
  selectedDepartment: Department,
  startDate: Date,
  endDate: Date,
  isProjectManagementPage = false // Add default value
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
          uploaded_at
        )
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
        return doc.file_path.startsWith(`${selectedDepartment}/`);
      }),
      isProjectManagementPage // Add this to each job object
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
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("job_documents")
        .remove([document.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("job_documents")
        .delete()
        .eq("id", document.id);

      if (dbError) throw dbError;

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
      console.log("Starting job deletion process for job:", jobId);

      // 1. Delete task documents for all departments
      console.log("Deleting task documents...");
      const { error: taskDocsError } = await supabase
        .from("task_documents")
        .delete()
        .or(
          `sound_task_id.in.(select id from sound_job_tasks where job_id='${jobId}'),lights_task_id.in.(select id from lights_job_tasks where job_id='${jobId}'),video_task_id.in.(select id from video_job_tasks where job_id='${jobId}')`
        );

      if (taskDocsError) {
        console.error("Error deleting task documents:", taskDocsError);
        throw taskDocsError;
      }

      // 2. Delete department tasks
      console.log("Deleting department tasks...");
      await Promise.all([
        supabase.from("sound_job_tasks").delete().eq("job_id", jobId),
        supabase.from("lights_job_tasks").delete().eq("job_id", jobId),
        supabase.from("video_job_tasks").delete().eq("job_id", jobId)
      ]);

      // 3. Delete department personnel
      console.log("Deleting department personnel...");
      await Promise.all([
        supabase.from("sound_job_personnel").delete().eq("job_id", jobId),
        supabase.from("lights_job_personnel").delete().eq("job_id", jobId),
        supabase.from("video_job_personnel").delete().eq("job_id", jobId)
      ]);

      // 4. Delete job documents
      console.log("Deleting job documents...");
      const { error: jobDocsError } = await supabase
        .from("job_documents")
        .delete()
        .eq("job_id", jobId);

      if (jobDocsError) {
        console.error("Error deleting job documents:", jobDocsError);
        throw jobDocsError;
      }

      // 5. Delete job assignments
      console.log("Deleting job assignments...");
      const { error: assignmentsError } = await supabase
        .from("job_assignments")
        .delete()
        .eq("job_id", jobId);

      if (assignmentsError) {
        console.error("Error deleting job assignments:", assignmentsError);
        throw assignmentsError;
      }

      // 6. Delete job departments
      console.log("Deleting job departments...");
      const { error: departmentsError } = await supabase
        .from("job_departments")
        .delete()
        .eq("job_id", jobId);

      if (departmentsError) {
        console.error("Error deleting job departments:", departmentsError);
        throw departmentsError;
      }

      // 7. Finally delete the job itself
      console.log("Deleting the job...");
      const { error: jobError } = await supabase
        .from("jobs")
        .delete()
        .eq("id", jobId);

      if (jobError) {
        console.error("Error deleting job:", jobError);
        throw jobError;
      }

      toast({
        title: "Job deleted successfully",
        description: "The job and all related records have been removed."
      });
    } catch (error: any) {
      console.error("Error in deletion process:", error);
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
