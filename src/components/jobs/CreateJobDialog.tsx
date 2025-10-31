
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
import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Department } from "@/types/department";
import { JobType } from "@/types/job";
import { SimplifiedJobColorPicker } from "./SimplifiedJobColorPicker";
import { useLocationManagement } from "@/hooks/useLocationManagement";
import { localInputToUTC } from "@/utils/timezoneUtils";
import { PlaceAutocomplete } from "@/components/maps/PlaceAutocomplete";
import type { LocationDetails } from "@/hooks/useLocationManagement";
import { roleOptionsForDiscipline } from "@/types/roles";

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
  initialDate?: Date;
  initialJobType?: JobType;
  onCreated?: (job: any) => void;
}

export const CreateJobDialog = ({ open, onOpenChange, currentDepartment, initialDate, initialJobType, onCreated }: CreateJobDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { getOrCreateLocationWithDetails } = useLocationManagement();
  const [locationInput, setLocationInput] = useState("");
  const [requirements, setRequirements] = useState<Record<string, Array<{ role_code: string; quantity: number }>>>({});
  const navigate = useNavigate();

  const formatInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const getDefaultTimes = () => {
    const base = initialDate ? new Date(initialDate) : new Date();
    const start = new Date(base);
    start.setHours(10, 0, 0, 0);
    const end = new Date(base);
    end.setHours(18, 0, 0, 0);
    return { start: formatInput(start), end: formatInput(end) };
  };

  const COLOR_PALETTE = [
    "#ef4444", // red-500
    "#f97316", // orange-500
    "#f59e0b", // amber-500
    "#84cc16", // lime-500
    "#22c55e", // green-500
    "#10b981", // emerald-500
    "#06b6d4", // cyan-500
    "#0ea5e9", // sky-500
    "#3b82f6", // blue-500
    "#8b5cf6", // violet-500
    "#a855f7", // purple-500
    "#ec4899", // pink-500
    "#f43f5e", // rose-500
  ] as const;

  const getRandomColor = () => {
    const idx = Math.floor(Math.random() * COLOR_PALETTE.length);
    return COLOR_PALETTE[idx];
  };

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
      start_time: getDefaultTimes().start,
      end_time: getDefaultTimes().end,
      job_type: (initialJobType ?? "single") as JobType,
      departments: currentDepartment ? [currentDepartment] : [],
      color: getRandomColor(),
      timezone: "Europe/Madrid",
    },
  });

  // Reset defaults when opening to reflect latest props
  const resetWithProps = useCallback(() => {
    const times = getDefaultTimes();
    reset({
      title: "",
      description: "",
      location: {
        name: "",
        address: "",
        coordinates: undefined,
        place_id: undefined,
      },
      start_time: times.start,
      end_time: times.end,
      job_type: (initialJobType ?? "single") as JobType,
      departments: currentDepartment ? [currentDepartment] : [],
      color: getRandomColor(),
      timezone: "Europe/Madrid",
    });
    setLocationInput("");
  }, [getDefaultTimes, initialJobType, currentDepartment, reset]);

  // Refresh defaults when the dialog opens or when the preset/date changes while closed
  useEffect(() => {
    if (open) {
      resetWithProps();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialDate, initialJobType]);

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

      // Insert required roles if provided and not a dryhire
      if (values.job_type !== 'dryhire') {
        const rows: Array<{ job_id: string; department: string; role_code: string; quantity: number }>= [];
        for (const dept of Object.keys(requirements)) {
          for (const r of requirements[dept] || []) {
            if (r.role_code && r.quantity > 0) rows.push({ job_id: job.id, department: dept, role_code: r.role_code, quantity: r.quantity });
          }
        }
        if (rows.length > 0) {
          const { error: reqErr } = await supabase.from('job_required_roles').insert(rows);
          if (reqErr) {
            console.warn('CreateJobDialog: Failed to insert required roles', reqErr);
          }
        }
      }

      // Optimistically update the cache instead of invalidating
      queryClient.setQueryData(["jobs"], (oldData: any) => {
        if (!oldData) return oldData;
        return [...oldData, { ...job, job_departments: departmentInserts }];
      });

      toast({
        title: "Success",
        description: "Job created successfully",
      });

      // Broadcast push notification (fire-and-forget)
      try {
        void supabase.functions.invoke('push', {
          body: { action: 'broadcast', type: 'job.created', job_id: job.id }
        });
      } catch {}

      // Redirect to management page
      try {
        const dest = job.job_type === 'festival'
          ? `/festival-management/${job.id}`
          : `/festival-management/${job.id}?singleJob=true`;
        navigate(dest);
      } catch {}

      // We navigate to management; skip parent callbacks to avoid state updates on unmounted pages

      reset();
      setRequirements({});
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
  }, [isSubmitting, getOrCreateLocationWithDetails, queryClient, toast, reset, onOpenChange, onCreated, navigate]);

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
            <PlaceAutocomplete
              value={locationInput}
              onSelect={(result) => {
                setLocationInput(result.name);
                setValue("location", {
                  name: result.name,
                  address: result.address,
                  coordinates: result.coordinates,
                  place_id: result.place_id,
                });
              }}
              placeholder="Enter venue location"
              label="Location"
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

          {/* Optional crew requirements (skip for dryhire) */}
          {watch("job_type") !== 'dryhire' && selectedDepartments.length > 0 && (
            <div className="space-y-2 border rounded-md p-3">
              <Label className="font-semibold">Required Crew (optional)</Label>
              <div className="space-y-3">
                {selectedDepartments.map((dept) => (
                  <div key={dept} className="space-y-2">
                    <div className="text-sm capitalize font-medium">{dept}</div>
                    {(requirements[dept] || []).map((r, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2">
                        <div className="col-span-8">
                          <Select
                            value={r.role_code}
                            onValueChange={(v) => {
                              setRequirements((prev) => {
                                const list = [...(prev[dept] || [])]
                                list[idx] = { ...list[idx], role_code: v }
                                return { ...prev, [dept]: list }
                              })
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              {roleOptionsForDiscipline(dept).map((opt) => (
                                <SelectItem key={opt.code} value={opt.code}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={r.quantity}
                            onChange={(e) => {
                              const val = Math.max(0, Math.floor(Number(e.target.value) || 0))
                              setRequirements((prev) => {
                                const list = [...(prev[dept] || [])]
                                list[idx] = { ...list[idx], quantity: val }
                                return { ...prev, [dept]: list }
                              })
                            }}
                          />
                        </div>
                        <div className="col-span-1 flex items-center justify-end">
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => setRequirements((prev) => {
                              const list = [...(prev[dept] || [])]
                              list.splice(idx, 1)
                              return { ...prev, [dept]: list }
                            })}
                          >
                            ×
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setRequirements((prev) => {
                          const list = [...(prev[dept] || [])]
                          const first = roleOptionsForDiscipline(dept)[0]?.code || ''
                          list.push({ role_code: first, quantity: 1 })
                          return { ...prev, [dept]: list }
                        })}
                      >
                        Add role
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="w-full flex justify-end">
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Creating..." : "Create Job"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
