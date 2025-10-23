
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Department } from "@/types/department";
import { ProjectManagementJobList } from "./ProjectManagementJobList";

interface DepartmentTabsProps {
  selectedDepartment: Department;
  onDepartmentChange: (value: string) => void;
  jobs: any[];
  jobsLoading: boolean;
  highlightToday?: boolean;
}

export const DepartmentTabs = ({
  selectedDepartment,
  onDepartmentChange,
  jobs,
  jobsLoading,
  highlightToday = false
}: DepartmentTabsProps) => {
  return (
    <Tabs value={selectedDepartment} onValueChange={onDepartmentChange} className="mt-4">
      <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
        <TabsTrigger value="sound">Sound</TabsTrigger>
        <TabsTrigger value="lights">Lights</TabsTrigger>
        <TabsTrigger value="video">Video</TabsTrigger>
      </TabsList>

      {["sound", "lights", "video"].map((dept) => (
        <TabsContent key={dept} value={dept}>
          <ProjectManagementJobList
            jobs={jobs}
            jobsLoading={jobsLoading}
            highlightToday={highlightToday}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
};
