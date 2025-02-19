
import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";

interface Job {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  tours?: {
    name: string | null;
  } | null;
}

interface JobComboboxProps {
  jobs: Job[];
  selectedJob: Job | null;
  onSelect: (job: Job | null) => void;
  isLoading?: boolean;
}

export function JobCombobox({ jobs, selectedJob, onSelect, isLoading }: JobComboboxProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={isLoading}
        >
          {selectedJob ? (
            <span>
              {selectedJob.title}
              {selectedJob.tours?.name && ` (${selectedJob.tours.name})`}
              {` - ${format(new Date(selectedJob.start_time), 'dd/MM/yyyy')}`}
            </span>
          ) : (
            "Search for a job..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command>
          <CommandInput placeholder="Search jobs..." />
          <CommandEmpty>No jobs found.</CommandEmpty>
          <CommandGroup>
            {jobs.map((job) => (
              <CommandItem
                key={job.id}
                value={`${job.title}-${job.id}`}
                onSelect={() => {
                  onSelect(job);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedJob?.id === job.id ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="flex-1">
                  {job.title}
                  {job.tours?.name && (
                    <span className="ml-2 text-muted-foreground">
                      ({job.tours.name})
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground">
                  {format(new Date(job.start_time), 'dd/MM/yyyy')}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
