import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { MobileFilterSheet } from '@/components/ui/mobile-filter-sheet';
import { StatusFilter } from './StatusFilter';
import { JobTypeFilter } from './JobTypeFilter';

interface MobileFiltersProps {
  allJobTypes: string[];
  selectedJobTypes: string[];
  onTypeToggle: (type: string) => void;
  allJobStatuses: string[];
  selectedJobStatuses: string[];
  onStatusSelection: (status: string) => void;
  activeFilterCount: number;
  onResetFilters?: () => void;
}

/**
 * Mobile-optimized filter panel for project management
 * Uses a sheet component for better mobile UX
 */
export function MobileFilters({
  allJobTypes,
  selectedJobTypes,
  onTypeToggle,
  allJobStatuses,
  selectedJobStatuses,
  onStatusSelection,
  activeFilterCount,
  onResetFilters,
}: MobileFiltersProps) {
  const [open, setOpen] = useState(false);

  return (
    <MobileFilterSheet
      open={open}
      onOpenChange={setOpen}
      activeFilterCount={activeFilterCount}
      onReset={onResetFilters}
      triggerText="Filters"
      title="Filter Projects"
      description="Refine your project list by status and type"
    >
      <div className="space-y-4">
        {/* Job Status Filter */}
        <div className="space-y-2">
          <Label>Job Status</Label>
          <StatusFilter
            allJobStatuses={allJobStatuses}
            selectedJobStatuses={selectedJobStatuses}
            onStatusSelection={onStatusSelection}
          />
        </div>

        <Separator />

        {/* Job Type Filter */}
        <div className="space-y-2">
          <Label>Job Type</Label>
          <JobTypeFilter
            allJobTypes={allJobTypes}
            selectedJobTypes={selectedJobTypes}
            onTypeToggle={onTypeToggle}
          />
        </div>
      </div>
    </MobileFilterSheet>
  );
}
