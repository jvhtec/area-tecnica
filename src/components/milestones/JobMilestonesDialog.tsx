import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format, addDays, subDays, min } from "date-fns";
import { Settings, Calendar, MapPin, Clock } from "lucide-react";
import { MilestoneGanttChart } from "./MilestoneGanttChart";
import { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { ManageMilestonesDialog } from "./ManageMilestonesDialog";

interface JobMilestonesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobStartDate: Date;
}

export function JobMilestonesDialog({
  open,
  onOpenChange,
  jobId,
  jobStartDate,
}: JobMilestonesDialogProps) {
  const [manageMilestonesOpen, setManageMilestonesOpen] = useState(false);

  const { data: job } = useQuery({
    queryKey: ["job-details", jobId],
    queryFn: async () => {
      console.log("Fetching job details for:", jobId);
      const { data, error } = await supabase
        .from("jobs")
        .select(`
          *,
          location:locations(name)
        `)
        .eq("id", jobId)
        .single();

      if (error) {
        console.error("Error fetching job:", error);
        throw error;
      }
      console.log("Job details:", data);
      return data;
    },
  });

  // Fetch milestone definitions
  const { data: definitions } = useQuery({
    queryKey: ["milestone-definitions"],
    queryFn: async () => {
      console.log("Fetching milestone definitions");
      const { data, error } = await supabase
        .from("milestone_definitions")
        .select("*")
        .order("default_offset");

      if (error) {
        console.error("Error fetching definitions:", error);
        throw error;
      }
      console.log("Milestone definitions:", data);
      return data;
    },
  });

  // Fetch existing job milestones with department information
  const { data: milestones, isLoading } = useQuery({
    queryKey: ["job-milestones", jobId],
    queryFn: async () => {
      console.log("Fetching milestones for job:", jobId);
      const { data, error } = await supabase
        .from("job_milestones")
        .select(`
          *,
          definition:milestone_definitions(
            name,
            category,
            department
          ),
          completed_by:profiles(
            first_name,
            last_name
          )
        `)
        .eq("job_id", jobId)
        .order("due_date");

      if (error) {
        console.error("Error fetching milestones:", error);
        throw error;
      }
      console.log("Fetched milestones:", data);
      return data;
    },
  });

  // Fetch show dates to properly align milestones
  const { data: showDates } = useQuery({
    queryKey: ["job-show-dates", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_date_types")
        .select("*")
        .eq("job_id", jobId)
        .eq("type", "show")
        .order("date");

      if (error) throw error;
      return data;
    },
  });

  // Create initial milestones if none exist
  const createInitialMilestones = async () => {
    if (!definitions || !showDates?.[0]) return;

    const firstShowDate = new Date(showDates[0].date);
    const milestonesToCreate = definitions.map((def) => ({
      job_id: jobId,
      definition_id: def.id,
      name: def.name,
      offset_days: def.default_offset,
      due_date: addDays(firstShowDate, def.default_offset),
    }));

    console.log("Creating initial milestones:", milestonesToCreate);

    const { error } = await supabase
      .from("job_milestones")
      .insert(milestonesToCreate);

    if (error) {
      console.error("Error creating milestones:", error);
    }
  };

  // Create initial milestones if needed
  useEffect(() => {
    if (definitions?.length && !milestones?.length && showDates?.length) {
      createInitialMilestones();
    }
  }, [definitions, milestones, showDates]);

  // Calculate the earliest milestone date to determine chart start date
  const chartStartDate = milestones?.length
    ? min([
        jobStartDate,
        ...milestones.map((m) => new Date(m.due_date)),
      ])
    : jobStartDate;

  // Ensure we show at least 2 weeks before the earliest date
  const adjustedStartDate = subDays(chartStartDate, 14);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] w-full">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Job Milestones</DialogTitle>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => setManageMilestonesOpen(true)}
              >
                <Settings className="h-4 w-4" />
                Manage Milestones
              </Button>
            </div>
            {job && (
              <>
                <div className="mt-4 space-y-2">
                  <h2 className="text-xl font-semibold">{job.title}</h2>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{format(new Date(job.start_time), 'MMM d, yyyy')}</span>
                    </div>
                    {job.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{job.location.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>{format(new Date(job.start_time), 'HH:mm')}</span>
                    </div>
                  </div>
                </div>
                <Separator className="my-4" />
              </>
            )}
          </DialogHeader>
          
          {isLoading ? (
            <div className="h-[400px] flex items-center justify-center">
              Loading milestones...
            </div>
          ) : (
            <div className="relative w-full overflow-hidden">
              <MilestoneGanttChart 
                milestones={milestones || []} 
                startDate={adjustedStartDate}
                jobId={jobId}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ManageMilestonesDialog
        open={manageMilestonesOpen}
        onOpenChange={setManageMilestonesOpen}
        jobId={jobId}
      />
    </>
  );
}