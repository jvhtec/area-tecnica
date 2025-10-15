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

interface JobTypeFilterProps {
  allJobTypes: string[];
  selectedJobTypes: string[];
  onTypeToggle: (type: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  single: "Single",
  festival: "Festival",
  tour: "Tour",
  tourdate: "Tour Date",
  dryhire: "Dry Hire",
};

const getTypeLabel = (type: string) => TYPE_LABELS[type?.toLowerCase()] || type;

export const JobTypeFilter = ({
  allJobTypes,
  selectedJobTypes,
  onTypeToggle,
}: JobTypeFilterProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Types
          {selectedJobTypes.length > 0 && (
            <span className="ml-1 rounded-full bg-primary text-primary-foreground text-xs px-2 py-0.5">
              {selectedJobTypes.length}
            </span>
          )}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Select All / Clear All */}
        <DropdownMenuItem
          onClick={() => {
            if (selectedJobTypes.length === allJobTypes.length) {
              // Clear all
              selectedJobTypes.forEach(t => onTypeToggle(t));
            } else {
              // Select all
              allJobTypes.forEach(t => {
                if (!selectedJobTypes.includes(t)) onTypeToggle(t);
              });
            }
          }}
          className="font-medium"
        >
          {selectedJobTypes.length === allJobTypes.length ? "Clear All" : "Select All"}
        </DropdownMenuItem>

        {allJobTypes.length > 0 && <DropdownMenuSeparator />}

        {allJobTypes.map((type) => (
          <DropdownMenuItem
            key={type}
            onClick={(e) => {
              e.preventDefault();
              onTypeToggle(type);
            }}
            className="gap-2 cursor-pointer"
          >
            <Checkbox
              checked={selectedJobTypes.includes(type)}
              onChange={() => onTypeToggle(type)}
              className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
            />
            <span className="ml-2">{getTypeLabel(type)}</span>
          </DropdownMenuItem>
        ))}

        {allJobTypes.length === 0 && (
          <DropdownMenuItem disabled className="text-muted-foreground">
            No types available
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

