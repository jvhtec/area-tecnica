
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { JobCardNew } from "../jobs/cards/JobCardNew";
import { Department } from "@/types/department";
import { JobDocument } from "@/components/jobs/cards/JobCardDocuments";
// Task dialogs intentionally not used for parity — tasks hidden on these cards

interface DepartmentTabContentProps {
  department: Department;
  jobs: any[];
  isLoading: boolean;
  onDeleteDocument: (jobId: string, document: JobDocument) => void;
  userRole: string | null;
}

export const DepartmentTabContent = ({
  department,
  jobs,
  isLoading,
  onDeleteDocument,
  userRole
}: DepartmentTabContentProps) => {
  // Parity: no task dialogs in department tabs

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!jobs?.length) {
    return (
      <p className="text-muted-foreground p-4">
        No jobs found for this department.
      </p>
    );
  }

  const handleJobClick = (_jobId: string) => {};

  const getTaskDialog = () => null;

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <JobCardNew
          key={job.id}
          job={job}
          onEditClick={() => {}}
          onDeleteClick={() => {}}
          onJobClick={handleJobClick}
          department={department}
          onDeleteDocument={onDeleteDocument}
          showUpload={true}
          userRole={userRole}
          hideTasks
        />
      ))}
      
      {getTaskDialog()}
    </div>
  );
};
