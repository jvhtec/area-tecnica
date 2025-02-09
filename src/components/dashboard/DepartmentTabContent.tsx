import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { JobCardNew } from "./JobCardNew";
import { Department } from "@/types/department";
import { JobDocument } from "@/types/job";
import { useState } from "react";
import { SoundTaskDialog } from "@/components/sound/SoundTaskDialog";
import { LightsTaskDialog } from "@/components/lights/LightsTaskDialog";
import { VideoTaskDialog } from "@/components/video/VideoTaskDialog";

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
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

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

  const handleJobClick = (jobId: string) => {
    setSelectedJobId(jobId);
  };

  const getTaskDialog = () => {
    if (!selectedJobId) return null;

    switch (department) {
      case 'sound':
        return (
          <SoundTaskDialog
            jobId={selectedJobId}
            open={!!selectedJobId}
            onOpenChange={(open) => !open && setSelectedJobId(null)}
          />
        );
      case 'lights':
        return (
          <LightsTaskDialog
            jobId={selectedJobId}
            open={!!selectedJobId}
            onOpenChange={(open) => !open && setSelectedJobId(null)}
          />
        );
      case 'video':
        return (
          <VideoTaskDialog
            jobId={selectedJobId}
            open={!!selectedJobId}
            onOpenChange={(open) => !open && setSelectedJobId(null)}
          />
        );
      default:
        return null;
    }
  };

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
        />
      ))}
      
      {getTaskDialog()}
    </div>
  );
};