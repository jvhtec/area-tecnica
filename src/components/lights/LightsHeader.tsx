import { Button } from "@/components/ui/button";
import { Plus, ChevronDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { JobType } from "@/types/job";

interface LightsHeaderProps {
  onCreateJob: (preset?: JobType) => void;
  department?: string;
  canCreate?: boolean;
}

export const LightsHeader = ({ onCreateJob, department = "Lights", canCreate = true }: LightsHeaderProps) => {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-2xl font-semibold">Departmento de {department}</h1>
      <div className="flex w-full sm:w-auto flex-wrap gap-2 sm:justify-end">
        <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-2 sm:gap-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => onCreateJob()}
                  className="w-full sm:w-auto gap-2 sm:rounded-r-none"
                  aria-label="Create job"
                  disabled={!canCreate}
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Create Job</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {canCreate ? `Create ${department} job` : 'Insufficient permissions'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto px-2 sm:rounded-l-none" disabled={!canCreate} aria-label="Choose preset">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onCreateJob("single")}>Single</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onCreateJob("tour")}>Tour</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onCreateJob("festival")}>Festival</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onCreateJob("dryhire")}>Dry Hire</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onCreateJob("tourdate")}>Tour Date</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};
