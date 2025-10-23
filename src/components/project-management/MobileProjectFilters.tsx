import React from "react";
import { Filter, Search, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JobTypeFilter } from "./JobTypeFilter";
import { StatusFilter } from "./StatusFilter";

interface MobileProjectFiltersProps {
  allJobTypes: string[];
  selectedJobTypes: string[];
  onTypeToggle: (type: string) => void;
  allJobStatuses: string[];
  selectedJobStatuses: string[];
  onStatusSelection: (status: string) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  jobsLoading: boolean;
}

export const MobileProjectFilters: React.FC<MobileProjectFiltersProps> = ({
  allJobTypes,
  selectedJobTypes,
  onTypeToggle,
  allJobStatuses,
  selectedJobStatuses,
  onStatusSelection,
  searchQuery,
  onSearchQueryChange,
  jobsLoading,
}) => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Filters
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="space-y-6">
        <SheetHeader className="text-left">
          <SheetTitle className="text-base font-semibold">Filters</SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Search</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder="Search projects..."
                className="pl-8"
              />
              {jobsLoading && (
                <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium text-muted-foreground">Job Types</span>
            <JobTypeFilter
              allJobTypes={allJobTypes}
              selectedJobTypes={selectedJobTypes}
              onTypeToggle={onTypeToggle}
            />
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium text-muted-foreground">Status</span>
            <StatusFilter
              allJobStatuses={allJobStatuses}
              selectedJobStatuses={selectedJobStatuses}
              onStatusSelection={onStatusSelection}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileProjectFilters;
