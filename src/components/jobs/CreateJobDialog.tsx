
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { Department } from "@/types/department";
import { JobType } from "@/types/job";
import { SimplifiedJobColorPicker } from "./SimplifiedJobColorPicker";
import { useLocationManagement } from "@/hooks/useLocationManagement";
import { localInputToUTC } from "@/utils/timezoneUtils";
import { PlacesAutocomplete } from "@/components/maps/PlacesAutocomplete";
import type { LocationDetails } from "@/hooks/useLocationManagement";
import type { PlaceResultNormalized } from "@/types/places";

// Simplified schema for better performance
const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  location: z.object({
    name: z.string().min(1, "Location is required"),
    address: z.string().min(1, "Address is required"),
    coordinates: z.object({
      lat: z.number(),
      lng: z.number(),
    }).optional(),
    place_id: z.string().optional(),
  }),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  job_type: z.enum(["single", "tour", "festival", "dryhire", "tourdate"] as const),
  departments: z.array(z.string()).min(1, "At least one department is required"),
  color: z.string().min(1, "Color is required"),
  timezone: z.string().min(1, "Timezone is required"),
}).refine((data) => {
  const start = new Date(data.start_time);
  const end = new Date(data.end_time);
  return end > start;
}, {
  message: "End time must be after start time",
  path: ["end_time"],
});

interface CreateJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDepartment?: string;
}

export const CreateJobDialog = ({ open, onOpenChange, currentDepartment }: CreateJobDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { getOrCreateLocationWithDetails } = useLocationManagement();
  const [locationInput, setLocationInput] = useState("");
  const [selectedLocationDetails, setSelectedLocationDetails] = useState<LocationDetails | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      location: {
        name: "",
        address: "",
        coordinates: undefined,
        place_id: undefined,
      },
      start_time: new Date().toISOString().slice(0, 16),
      end_time: new Date().toISOString().slice(0, 16),
      job_type: "single" as JobType,
      departments: currentDepartment ? [currentDepartment] : [],
      color: "#7E69AB",
      timezone: "Europe/Madrid",
    },
  });

  const onSubmit = useCallback(async (values: z.infer<typeof formSchema>) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      console.log("CreateJobDialog: Starting job creation process");
      
      // Validate location data before processing
      if (!values.location.name || !values.location.address) {
        toast({
          title: "Error",
          description: "Please select a valid location",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Start location resolution and time conversion in parallel
      const [locationId, startTimeUTC, endTimeUTC] = await Promise.all([
        getOrCreateLocationWithDetails(values.location as LocationDetails),
        Promise.resolve(localInputToUTC(values.start_time, values.timezone)),
        Promise.resolve(localInputToUTC(values.end_time, values.timezone))
      ]);

      console.log("CreateJobDialog: Location resolved and times converted");

      // Create job and departments in a single transaction-like approach
      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .insert([
          {
            title: values.title,
            description: values.description,
            location_id: locationId,
            start_time: startTimeUTC.toISOString(),
            end_time: endTimeUTC.toISOString(),
            job_type: values.job_type,
            color: values.color,
            timezone: values.timezone,
          },
        ])
        .select()
        .single();

      if (jobError) {
        console.error("CreateJobDialog: Job creation error:", jobError);
        throw jobError;
      }

      console.log("CreateJobDialog: Job created successfully:", job.id);

      // Insert departments in batch
      const departmentInserts = values.departments.map((department) => ({
        job_id: job.id,
        department,
      }));

      const { error: deptError } = await supabase
        .from("job_departments")
        .insert(departmentInserts);

      if (deptError) {
        console.error("CreateJobDialog: Department insertion error:", deptError);
        throw deptError;
      }

      console.log("CreateJobDialog: Departments added successfully");

      // Optimistically update the cache instead of invalidating
      queryClient.setQueryData(["jobs"], (oldData: any) => {
        if (!oldData) return oldData;
        return [...oldData, { ...job, job_departments: departmentInserts }];
      });

      toast({
        title: "Success",
        description: "Job created successfully",
      });

      reset();
      onOpenChange(false);
    } catch (error) {
      console.error("CreateJobDialog: Error creating job:", error);
      toast({
        title: "Error",
        description: "Failed to create job",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, getOrCreateLocationWithDetails, queryClient, toast, reset, onOpenChange]);

  const departments: Department[] = ["sound", "lights", "video"];
  const selectedDepartments = watch("departments") || [];

  const toggleDepartment = useCallback((department: Department) => {
    const updatedDepartments = selectedDepartments.includes(department)
      ? selectedDepartments.filter((d) => d !== department)
      : [...selectedDepartments, department];
    setValue("departments", updatedDepartments);
  }, [selectedDepartments, setValue]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] md:max-h-none md:h-auto overflow-y-auto md:overflow-visible">
        <DialogHeader>
          <DialogTitle>Create New Job</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input {...register("title")} />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea {...register("description")} />
          </div>

          <div className="space-y-2">
            <PlacesAutocomplete
              value={locationInput}
              onChange={setLocationInput}
              onSelect={(result: PlaceResultNormalized) => {
                setSelectedLocationDetails({
                  name: result.name || result.formatted_address,
                  address: result.formatted_address,
                  coordinates: result.location.lat !== 0 && result.location.lng !== 0 ? result.location : undefined,
                  place_id: result.place_id || undefined,
                });
                setValue("location", {
                  name: result.name || result.formatted_address,
                  address: result.formatted_address,
                  coordinates: result.location.lat !== 0 && result.location.lng !== 0 ? result.location : undefined,
                  place_id: result.place_id || undefined,
                });
              }}
              placeholder="Search location, venue or address…"
              label="Location"
              required
              allowManual={true}
            />
            {errors.location && (
              <p className="text-sm text-destructive">
                {errors.location.name?.message as string}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select
              onValueChange={(value) => setValue("timezone", value)}
              defaultValue={watch("timezone")}
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
            {errors.timezone && (
              <p className="text-sm text-destructive">
                {errors.timezone.message as string}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Time</Label>
              <Input
                type="datetime-local"
                {...register("start_time")}
              />
              {errors.start_time && (
                <p className="text-sm text-destructive">
                  {errors.start_time.message as string}
                </p>
              )}
            </div>
            <div>
              <Label>End Time</Label>
              <Input
                type="datetime-local"
                {...register("end_time")}
              />
              {errors.end_time && (
                <p className="text-sm text-destructive">
                  {errors.end_time.message as string}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Job Type</Label>
            <Select
              onValueChange={(value) => setValue("job_type", value as JobType)}
              defaultValue={watch("job_type")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select job type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="tour">Tour</SelectItem>
                <SelectItem value="festival">Festival</SelectItem>
                <SelectItem value="dryhire">Dry Hire</SelectItem>
                <SelectItem value="tourdate">Tour Date</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <SimplifiedJobColorPicker
              color={watch("color")}
              onChange={(color) => setValue("color", color)}
            />
            {errors.color && (
              <p className="text-sm text-destructive">{errors.color.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Departments</Label>
            <div className="flex gap-2">
              {departments.map((department) => (
                <Button
                  key={department}
                  type="button"
                  variant={
                    selectedDepartments.includes(department)
                      ? "default"
                      : "outline"
                  }
                  onClick={() => toggleDepartment(department)}
                >
                  {department}
                </Button>
              ))}
            </div>
            {errors.departments && (
              <p className="text-sm text-destructive">
                {errors.departments.message as string}
              </p>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Job"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
