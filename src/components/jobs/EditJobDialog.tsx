
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
import { utcToLocalInput, localInputToUTC } from "@/utils/timezoneUtils";
import { PlaceAutocomplete } from "@/components/maps/PlaceAutocomplete";
import { useLocationManagement } from "@/hooks/useLocationManagement";

interface EditJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: any;
}

export const EditJobDialog = ({ open, onOpenChange, job }: EditJobDialogProps) => {
  const [title, setTitle] = useState(job.title);
  const [description, setDescription] = useState(job.description || "");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [color, setColor] = useState(job.color || "#7E69AB");
  const [jobType, setJobType] = useState<JobType>(job.job_type || "single");
  const [timezone, setTimezone] = useState(job.timezone || "Europe/Madrid");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<Department[]>([]);
  
  // Venue-related state
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venueData, setVenueData] = useState<{
    place_id?: string;
    coordinates?: { lat: number; lng: number };
  } | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getOrCreateLocationWithDetails } = useLocationManagement();

  // Reset form when job changes and fetch location data
  useEffect(() => {
    const fetchJobWithLocation = async () => {
      if (job) {
        setTitle(job.title);
        setDescription(job.description || "");
        setColor(job.color || "#7E69AB");
        setJobType(job.job_type || "single");
        setTimezone(job.timezone || "Europe/Madrid");
        
        // Convert UTC times to local input format using job's timezone
        if (job.start_time && job.end_time) {
          const jobTimezone = job.timezone || "Europe/Madrid";
          setStartTime(utcToLocalInput(job.start_time, jobTimezone));
          setEndTime(utcToLocalInput(job.end_time, jobTimezone));
        }

        // Fetch location data if job has a location_id
        if (job.location_id) {
          try {
            const { data: locationData, error } = await supabase
              .from("locations")
              .select("*")
              .eq("id", job.location_id)
              .single();

            if (!error && locationData) {
              setVenueName(locationData.name || "");
              setVenueAddress(locationData.formatted_address || "");
              setVenueData({
                place_id: locationData.google_place_id || undefined,
                coordinates: locationData.latitude && locationData.longitude 
                  ? { lat: locationData.latitude, lng: locationData.longitude }
                  : undefined,
              });
            }
          } catch (error) {
            console.error("Error fetching location data:", error);
          }
        } else {
          // Clear venue data if no location
          setVenueName("");
          setVenueAddress("");
          setVenueData(null);
        }
      }
    };

    fetchJobWithLocation();
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

  const handleVenueSelect = (result: { name: string; address: string; coordinates?: { lat: number; lng: number }; place_id?: string }) => {
    setVenueName(result.name);
    setVenueAddress(result.address);
    setVenueData({
      place_id: result.place_id,
      coordinates: result.coordinates,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Convert local datetime-local input values to UTC using the job's timezone
      const startTimeUTC = localInputToUTC(startTime, timezone);
      const endTimeUTC = localInputToUTC(endTime, timezone);

      // Handle venue/location updates
      let locationId = job.location_id;
      
      if (venueName && venueAddress) {
        // Create or update location using the location management hook
        const locationDetails = {
          name: venueName,
          address: venueAddress,
          coordinates: venueData?.coordinates,
          place_id: venueData?.place_id,
        };
        
        locationId = await getOrCreateLocationWithDetails(locationDetails);
      } else if (venueName && !venueAddress) {
        // If only venue name is provided without address, handle it
        locationId = await getOrCreateLocationWithDetails({ 
          name: venueName, 
          address: venueName 
        });
      } else if (!venueName && !venueAddress) {
        // If venue is cleared, remove location reference
        locationId = null;
      }

      const { error: jobError } = await supabase
        .from("jobs")
        .update({
          title,
          description,
          start_time: startTimeUTC.toISOString(),
          end_time: endTimeUTC.toISOString(),
          color,
          job_type: jobType,
          timezone,
          location_id: locationId,
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
          
          {/* Venue Section */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
            <Label className="text-base font-semibold">Venue Information</Label>
            <div className="grid gap-4">
              <PlaceAutocomplete
                value={venueName}
                onSelect={handleVenueSelect}
                placeholder="Search for venue (WiZink Center Madrid, etc.)"
                label="Venue Name"
                className="w-full"
              />
              <div>
                <Label htmlFor="venueAddress">Address</Label>
                <Input
                  id="venueAddress"
                  value={venueAddress}
                  onChange={(e) => setVenueAddress(e.target.value)}
                  placeholder="Venue address (auto-filled from venue selection)"
                />
              </div>
            </div>
          </div>
          
          <div>
            <Label>Timezone</Label>
            <Select
              value={timezone}
              onValueChange={setTimezone}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Europe/Madrid">Europe/Madrid</SelectItem>
                <SelectItem value="Europe/London">Europe/London</SelectItem>
                <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                <SelectItem value="America/New_York">America/New_York</SelectItem>
                <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
              </SelectContent>
            </Select>
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
