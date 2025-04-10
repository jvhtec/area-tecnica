import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Department } from "@/types/department";
import { SimplifiedJobColorPicker } from "./SimplifiedJobColorPicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JobType } from "@/types/job";

interface EditJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: any;
}

export const EditJobDialog = ({ open, onOpenChange, job }: EditJobDialogProps) => {
  const [title, setTitle] = useState(job.title);
  const [description, setDescription] = useState(job.description || "");
  const [startTime, setStartTime] = useState(job.start_time?.slice(0, 16) || "");
  const [endTime, setEndTime] = useState(job.end_time?.slice(0, 16) || "");
  const [color, setColor] = useState(job.color || "#7E69AB");
  const [jobType, setJobType] = useState<JobType>(job.job_type || "single");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<Department[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset form when job changes
  useEffect(() => {
    if (job) {
      setTitle(job.title);
      setDescription(job.description || "");
      setStartTime(job.start_time?.slice(0, 16) || "");
      setEndTime(job.end_time?.slice(0, 16) || "");
      setColor(job.color || "#7E69AB");
      setJobType(job.job_type || "single");
    }
  }, [job]);

  // Fetch current departments when dialog opens
  useEffect(() => {
    const fetchDepartments = async () => {
      const { data, error } = await supabase
        .from("job_departments")
        .select("department")
        .eq("job_id", job.id);

      if (error) {
        console.error("Error fetching departments:", error);
        return;
      }

      const departments = data.map(d => d.department as Department);
      setSelectedDepartments(departments);
    };

    if (open && job.id) {
      fetchDepartments();
    }
  }, [open, job.id]);

  const handleDepartmentToggle = (department: Department) => {
    setSelectedDepartments(prev => 
      prev.includes(department)
        ? prev.filter(d => d !== department)
        : [...prev, department]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error: jobError } = await supabase
        .from("jobs")
        .update({
          title,
          description,
          start_time: startTime,
          end_time: endTime,
          color,
          job_type: jobType
        })
        .eq("id", job.id);

      if (jobError) throw jobError;

      // Update departments
      const { data: currentDepts } = await supabase
        .from("job_departments")
        .select("department")
        .eq("job_id", job.id);

      const currentDepartments = currentDepts?.map(d => d.department) || [];
      
      // Remove deselected departments
      const toRemove = currentDepartments.filter(dept => !selectedDepartments.includes(dept as Department));
      if (toRemove.length > 0) {
        await supabase
          .from("job_departments")
          .delete()
          .eq("job_id", job.id)
          .in("department", toRemove);
      }

      // Add new departments
      const toAdd = selectedDepartments.filter(dept => !currentDepartments.includes(dept));
      if (toAdd.length > 0) {
        await supabase
          .from("job_departments")
          .insert(toAdd.map(department => ({ job_id: job.id, department })));
      }

      toast({
        title: "Job updated successfully",
        description: "The job has been updated.",
      });
      
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating job:", error);
      toast({
        title: "Error updating job",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const departments: Department[] = ["sound", "lights", "video"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] md:max-h-none md:h-auto overflow-y-auto md:overflow-visible">
        <DialogHeader>
          <DialogTitle>Edit Job</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <Label>Color</Label>
            <SimplifiedJobColorPicker color={color} onChange={setColor} />
          </div>
          <div className="space-y-2">
            <Label>Job Type</Label>
            <Select
              value={jobType}
              onValueChange={(value) => setJobType(value as JobType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select job type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="tour">Tour</SelectItem>
                <SelectItem value="tourdate">Tour Date</SelectItem>
                <SelectItem value="festival">Festival</SelectItem>
                <SelectItem value="dryhire">Dry Hire</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Departments</Label>
            <div className="flex flex-col gap-2">
              {departments.map((department) => (
                <div key={department} className="flex items-center space-x-2">
                  <Checkbox
                    id={`department-${department}`}
                    checked={selectedDepartments.includes(department)}
                    onCheckedChange={() => handleDepartmentToggle(department)}
                  />
                  <Label htmlFor={`department-${department}`} className="capitalize">
                    {department}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
