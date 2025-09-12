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
    <div className="flex justify-between items-center">
      <h1 className="text-2xl font-semibold">Departmento de {department}</h1>
      <div className="flex gap-2">
        <div className="flex">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={() => onCreateJob()}
                  className="gap-2 rounded-r-none"
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
              <Button variant="outline" className="px-2 rounded-l-none" disabled={!canCreate} aria-label="Choose preset">
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
