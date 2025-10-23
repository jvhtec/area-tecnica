
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Department } from "@/types/department";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";
import { SimplifiedJobColorPicker } from "@/components/jobs/SimplifiedJobColorPicker";
import { REQUEST_TRANSPORT_OPTIONS } from "@/constants/transportOptions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";

// Available departments
const departments: Department[] = [
  "sound",
  "lights",
  "video"
];

interface LogisticsEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  selectedEvent?: {
    id: string;
    event_type: "load" | "unload";
    transport_type: string;
    event_time: string;
    event_date: string;
    loading_bay: string | null;
    job_id: string | null;
    license_plate: string | null;
    title?: string;
    color?: string;
    departments: { department: Department }[];
  };
  // Optional initial values when creating a new event
  initialJobId?: string | null;
  initialDepartments?: Department[];
  initialTransportType?: string;
  initialEventType?: 'load' | 'unload';
  onCreated?: (details: { id: string; event_type: 'load' | 'unload'; event_date: string; event_time: string }) => void;
}

export const LogisticsEventDialog = ({
  open,
  onOpenChange,
  selectedDate,
  selectedEvent,
  initialJobId = null,
  initialDepartments = [],
  initialTransportType,
  initialEventType,
  onCreated,
}: LogisticsEventDialogProps) => {
  const [eventType, setEventType] = useState<"load" | "unload">("load");
  const [transportType, setTransportType] = useState<string>("trailer");
  const [time, setTime] = useState("09:00");
  const [date, setDate] = useState(selectedDate ? format(selectedDate, "yyyy-MM-dd") : "");
  const [loadingBay, setLoadingBay] = useState("");
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [selectedDepartments, setSelectedDepartments] = useState<Department[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [color, setColor] = useState("#7E69AB");
  const [alsoCreateUnload, setAlsoCreateUnload] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Initialize form state when dialog opens or when switching to a different event
  useEffect(() => {
    if (!open) return;

    if (selectedEvent?.id) {
      setEventType(selectedEvent.event_type);
      setTransportType(selectedEvent.transport_type);
      setTime(selectedEvent.event_time);
      setDate(
        selectedEvent.event_date
          ? format(new Date(selectedEvent.event_date), "yyyy-MM-dd")
          : ""
      );
      setLoadingBay(selectedEvent.loading_bay || "");
      setSelectedJob(selectedEvent.job_id || null);
      setCustomTitle(selectedEvent.title || "");
      setLicensePlate(selectedEvent.license_plate || "");
      setSelectedDepartments((selectedEvent.departments || []).map((d) => d.department));
      setColor(selectedEvent.color || "#7E69AB");
    } else {
      setEventType(initialEventType || "load");
      setTransportType(initialTransportType || "trailer");
      setTime("09:00");
      setDate(selectedDate ? format(selectedDate, "yyyy-MM-dd") : "");
      setLoadingBay("");
      setSelectedJob(initialJobId || null);
      setCustomTitle("");
      setLicensePlate("");
      setSelectedDepartments(initialDepartments || []);
      setColor("#7E69AB");
    }
    // Only re-run when dialog opens or we switch to a different event
  }, [open, selectedEvent?.id]);

  // Fetch available Jobs (used for read-only job label and select)
  const { data: jobs } = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("id, title");
      if (error) throw error;
      return data;
    },
  });

  const handleDelete = async () => {
    try {
      if (!selectedEvent) return;

      // First delete any referencing rows in logistics_event_departments
      const { error: deptError } = await supabase
        .from("logistics_event_departments")
        .delete()
        .eq("event_id", selectedEvent.id);

      if (deptError) throw deptError;

      // Then delete the main record from logistics_events
      const { error: eventError } = await supabase
        .from("logistics_events")
        .delete()
        .eq("id", selectedEvent.id);

      if (eventError) throw eventError;

      toast({
        title: "Success",
        description: "Logistics event deleted successfully.",
      });

      queryClient.invalidateQueries({ queryKey: ["logistics-events"] });
      queryClient.invalidateQueries({ queryKey: ["today-logistics"] });

      // Close both the delete dialog and the main event dialog
      setShowDeleteDialog(false);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time || (!selectedJob && !customTitle)) {
      toast({
        title: "Error",
        description: "Date, time, and title (if no job) are required.",
        variant: "destructive",
      });
      return;
    }

    try {
      const eventData = {
        event_type: eventType,
        transport_type: transportType,
        event_date: date,
        event_time: time,
        loading_bay: loadingBay || null,
        job_id: selectedJob || null,
        title: customTitle || null,
        license_plate: licensePlate || null,
        color: color,
      };

      if (selectedEvent) {
        const { error: updateError } = await supabase
          .from("logistics_events")
          .update(eventData)
          .eq("id", selectedEvent.id);

        if (updateError) throw updateError;

        await supabase
          .from("logistics_event_departments")
          .delete()
          .eq("event_id", selectedEvent.id);

        if (selectedDepartments.length > 0) {
          const { error: deptError } = await supabase
            .from("logistics_event_departments")
            .insert(
              selectedDepartments.map((dept) => ({
                event_id: selectedEvent.id,
                department: dept,
              }))
            );
          if (deptError) throw deptError;
        }

        toast({
          title: "Success",
          description: "Logistics event updated successfully.",
        });
      } else {
        const { data: newEvent, error } = await supabase
          .from("logistics_events")
          .insert(eventData)
          .select()
          .single();

        if (error) throw error;

        // notify caller on create
        try {
          onCreated?.({ id: newEvent.id, event_type: newEvent.event_type, event_date: newEvent.event_date, event_time: newEvent.event_time });
        } catch {}

        if (selectedDepartments.length > 0) {
          const { error: deptError } = await supabase
            .from("logistics_event_departments")
            .insert(
              selectedDepartments.map((dept) => ({
                event_id: newEvent.id,
                department: dept,
              }))
            );
          if (deptError) throw deptError;
        }

        // Optional: create an unload event right after saving a load event
        if (alsoCreateUnload && eventType === 'load') {
          const unloadData = { ...eventData, event_type: 'unload' as const };
          const { data: unloadEvent, error: unloadErr } = await supabase
            .from('logistics_events')
            .insert(unloadData)
            .select()
            .single();
          if (unloadErr) throw unloadErr;
          if (selectedDepartments.length > 0) {
            const { error: unloadDeptErr } = await supabase
              .from('logistics_event_departments')
              .insert(selectedDepartments.map((dept) => ({ event_id: unloadEvent.id, department: dept })));
            if (unloadDeptErr) throw unloadDeptErr;
          }
          try {
            onCreated?.({ id: unloadEvent.id, event_type: unloadEvent.event_type, event_date: unloadEvent.event_date, event_time: unloadEvent.event_time });
          } catch {}
        }

        toast({
          title: "Success",
          description: "Logistics event created successfully.",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["logistics-events"] });
      queryClient.invalidateQueries({ queryKey: ["today-logistics"] });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] md:max-h-none md:h-auto overflow-y-auto md:overflow-visible">
          <DialogHeader>
            <DialogTitle>
              {selectedEvent ? "Edit Logistics Event" : "Create Logistics Event"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
          {/* Job Selection or locked job display */}
            {(!selectedEvent && !initialJobId) ? (
              <div className="space-y-2">
                <Label>Job</Label>
                <Select
                  value={selectedJob || "no-job"}
                  onValueChange={(value) => {
                    setSelectedJob(value === "no-job" ? null : value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no-job">No Job</SelectItem>
                    {jobs?.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Job</Label>
                <div className="px-3 py-2 border rounded bg-muted text-sm">
                  {(() => {
                    const jt = jobs?.find(j => j.id === (selectedEvent?.job_id || initialJobId))?.title;
                    return jt || 'Selected Job';
                  })()}
                </div>
              </div>
            )}

            {/* Color Picker */}
            <div className="space-y-2">
              <Label>Event Color</Label>
              <SimplifiedJobColorPicker
                color={color}
                onChange={setColor}
              />
            </div>

            {/* Custom Title (only required if no job is selected) */}
            {selectedJob === null && (
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Enter event title"
                  required
                />
              </div>
            )}

            {/* Event Type */}
            <div className="space-y-2">
              <Label>Event Type</Label>
              <Select
                value={eventType}
                onValueChange={(value: "load" | "unload") => setEventType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="load">Load</SelectItem>
                  <SelectItem value="unload">Unload</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            {/* Time */}
            <div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>

            {/* Transport Type */}
            <div className="space-y-2">
              <Label>Transport Type</Label>
              <Select value={transportType} onValueChange={setTransportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUEST_TRANSPORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* License Plate */}
            <div className="space-y-2">
              <Label>License Plate</Label>
              <Input
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                placeholder="Enter license plate"
              />
            </div>

            {/* Departments */}
            <div className="space-y-2">
              <Label>Departments</Label>
              <div className="flex flex-wrap gap-2">
                {departments.map((dept) => (
                  <Button
                    key={dept}
                    type="button"
                    variant={selectedDepartments.includes(dept) ? "default" : "outline"}
                    onClick={() => {
                      setSelectedDepartments((prev) =>
                        prev.includes(dept)
                          ? prev.filter((d) => d !== dept)
                          : [...prev, dept]
                      );
                    }}
                  >
                    {dept}
                  </Button>
                ))}
              </div>
            </div>

            {/* Loading Bay */}
            <div className="space-y-2">
              <Label>Loading Bay</Label>
              <Input
                value={loadingBay}
                onChange={(e) => setLoadingBay(e.target.value)}
                placeholder="Optional"
              />
            </div>

            {/* Submit & Delete Buttons */}
            <div className="flex justify-between items-center pt-2">
              {selectedEvent && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              )}
              {!selectedEvent && eventType === 'load' && (
                <div className="flex items-center gap-2">
                  <Checkbox id="alsoCreateUnload" checked={alsoCreateUnload} onCheckedChange={(v) => setAlsoCreateUnload(!!v)} />
                  <Label htmlFor="alsoCreateUnload" className="text-sm">Also create unload event</Label>
                </div>
              )}
              <Button type="submit">
                {selectedEvent ? "Update" : "Create"} Event
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete AlertDialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete This Event?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the event.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
