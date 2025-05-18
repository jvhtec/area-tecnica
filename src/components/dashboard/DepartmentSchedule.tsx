import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobCardNew } from "./JobCardNew";
import { LucideIcon, RefreshCw } from "lucide-react";
import { Department } from "@/types/department";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

interface DepartmentScheduleProps {
  name: Department;
  icon: LucideIcon;
  color: string;
  jobs: any[];
  onEditClick: (job: any) => void;
  onDeleteClick: (jobId: string) => void;
  onJobClick: (jobId: string) => void;
  userRole?: string | null;
}

export const DepartmentSchedule = ({
  name,
  icon: Icon,
  color,
  jobs,
  onEditClick,
  onDeleteClick,
  onJobClick,
  userRole
}: DepartmentScheduleProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      console.log(`Refreshing ${name} department schedule...`);
      // Invalidate and refetch the jobs query
      await queryClient.invalidateQueries({ 
        queryKey: ["jobs"],
        refetchType: "active",
        exact: false
      });
      console.log(`${name} department schedule refreshed successfully`);
      toast.success(`${name} schedule refreshed`);
    } catch (error) {
      console.error(`Error refreshing ${name} schedule:`, error);
      toast.error(`Failed to refresh ${name} schedule`);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Card className="w-full transition-all hover:shadow-lg">
      <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Icon className={`w-6 h-6 ${color}`} />
            <span className="capitalize">{name} Schedule</span>
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleRefresh();
            }}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="h-[400px] overflow-y-auto">
        <div className="space-y-4">
          {jobs.map(job => (
            <JobCardNew
              key={job.id}
              job={job}
              onEditClick={onEditClick}
              onDeleteClick={onDeleteClick}
              onJobClick={onJobClick}
              department={name}
              userRole={userRole}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};