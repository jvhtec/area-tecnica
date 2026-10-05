import { useState } from 'react';
import { Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { jobRangeLabel } from '@/features/matrix-v2/jobDays';
import { isFocusableJob } from '@/features/matrix-v2/focus/focusableJob';
import type { MatrixJob } from '@/hooks/useOptimizedMatrixData';

interface FocusJobPickerProps {
  jobs: MatrixJob[];
  focusJobId: string | null;
  onFocusJob: (jobId: string | null) => void;
  block?: boolean;
}

/** Toolbar entry to job focus: pick a job to build its crew against. */
export function FocusJobPicker({ jobs, focusJobId, onFocusJob, block = false }: FocusJobPickerProps) {
  const [open, setOpen] = useState(false);
  const focusable = jobs.filter(isFocusableJob);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant={focusJobId ? 'secondary' : 'outline'} size="sm" className={block ? 'w-full justify-start' : 'h-8'}>
          <Crosshair className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Enfocar trabajo
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar trabajo…" />
          <CommandList>
            <CommandEmpty>No hay trabajos que enfocar.</CommandEmpty>
            <CommandGroup>
              {focusable.map((job) => (
                <CommandItem
                  key={job.id}
                  value={`${job.title} ${job.id}`}
                  onSelect={() => {
                    onFocusJob(job.id === focusJobId ? null : job.id);
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{job.title}</span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">{jobRangeLabel(job)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
