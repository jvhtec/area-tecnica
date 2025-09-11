import React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Filter } from "lucide-react";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";

type JobStatus = "Tentativa" | "Confirmado" | "Completado" | "Cancelado";

interface StatusFilterProps {
  allJobStatuses: string[];
  selectedJobStatuses: string[];
  onStatusSelection: (status: string) => void;
}

const STATUS_LABELS: Record<JobStatus, string> = {
  "Tentativa": "Tentative",
  "Confirmado": "Confirmed", 
  "Completado": "Completed",
  "Cancelado": "Cancelled"
};

export const StatusFilter = ({
  allJobStatuses,
  selectedJobStatuses,
  onStatusSelection
}: StatusFilterProps) => {
  const getStatusLabel = (status: string): string => {
    return STATUS_LABELS[status as JobStatus] || status;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Status
          {selectedJobStatuses.length > 0 && (
            <span className="ml-1 rounded-full bg-primary text-primary-foreground text-xs px-2 py-0.5">
              {selectedJobStatuses.length}
            </span>
          )}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Select All / Clear All */}
        <DropdownMenuItem
          onClick={() => {
            if (selectedJobStatuses.length === allJobStatuses.length) {
              // Clear all
              selectedJobStatuses.forEach(status => onStatusSelection(status));
            } else {
              // Select all
              allJobStatuses.forEach(status => {
                if (!selectedJobStatuses.includes(status)) {
                  onStatusSelection(status);
                }
              });
            }
          }}
          className="font-medium"
        >
          {selectedJobStatuses.length === allJobStatuses.length ? "Clear All" : "Select All"}
        </DropdownMenuItem>
        
        {allJobStatuses.length > 0 && <DropdownMenuSeparator />}
        
        {/* Individual status checkboxes */}
        {allJobStatuses.map((status) => (
          <DropdownMenuItem
            key={status}
            onClick={(e) => {
              e.preventDefault();
              onStatusSelection(status);
            }}
            className="gap-2 cursor-pointer"
          >
            <Checkbox
              checked={selectedJobStatuses.includes(status)}
              onChange={() => onStatusSelection(status)}
              className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
            />
            <JobStatusBadge status={status as JobStatus} />
            <span className="ml-2">{getStatusLabel(status)}</span>
          </DropdownMenuItem>
        ))}
        
        {allJobStatuses.length === 0 && (
          <DropdownMenuItem disabled className="text-muted-foreground">
            No statuses available
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};