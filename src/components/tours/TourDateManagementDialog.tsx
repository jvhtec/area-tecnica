import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { dataLayerClient } from "@/services/dataLayerClient";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Calendar,
  MapPin,
  Plus,
  Trash2,
  Edit,
  Package,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { TourDateFormFields } from "./TourDateFormFields";
import { useLocationManagement, LocationDetails } from "@/hooks/useLocationManagement";
import { useTourDateRealtime } from "@/hooks/useTourDateRealtime";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { deleteJobDateTypes } from "@/services/deleteJobDateTypes";
import {
  buildInclusiveDateRange,
  syncJobRehearsalDates,
  syncJobRehearsalDatesForJobs,
} from "@/services/jobRehearsalDates";
import { PlaceAutocomplete } from "@/components/maps/PlaceAutocomplete";
import { TECHNICAL_DEPARTMENTS } from "@/types/department";
import { syncFlexElementsForTourDateChange } from "@/utils/flex-folders/syncDateChange";
import {
  cleanupTourDefaultDocumentsForDate,
  syncTourDefaultDocuments,
} from "@/utils/tourDefaultDocumentSync";
import {
  DateType,
  getDateTypeMeta,
  isSingleDayDateType,
  TOUR_DATE_TYPE_OPTIONS,
} from "@/constants/dateTypes";
import { useTourDefaultSets } from "@/hooks/useTourDefaultSets";
import {
  DEPARTMENT_PACKAGE_LABELS,
  PACKAGE_DEPARTMENTS,
  TOUR_PACKAGE_LABELS,
  TOUR_PACKAGE_SIZES,
  getDepartmentDefaultSetId,
  getDepartmentPackageSize,
  getPackageBadgeLabel,
  resolveDefaultSetForTourDate,
  type PackageDepartment,
  type TourPackageSize,
} from "@/utils/tourPackages";


import { queryKeys } from "@/lib/react-query";
type TourDateTableType = Exclude<DateType, "prep_day">;
type DynamicSupabaseClient = { from: (table: string) => any };

const dynamicSupabase = dataLayerClient as unknown as DynamicSupabaseClient;
const fromDynamicTable = (table: string) => dynamicSupabase.from(table);
const toTourDateTableType = (type: DateType): TourDateTableType =>
  type === "prep_day" ? "show" : type;

interface TourDateObject {
  id: string;
  date: string;
  tour_id: string;
  location_id: string | null;
  location?: {
    id: string;
    name: string;
  };
  notes?: string;
  tour_date_type: DateType;
  start_date?: string;
  end_date?: string;
  is_tour_pack_only?: boolean;
  sound_package_size?: TourPackageSize | null;
  lights_package_size?: TourPackageSize | null;
  video_package_size?: TourPackageSize | null;
  sound_default_set_id?: string | null;
  lights_default_set_id?: string | null;
  video_default_set_id?: string | null;
}

interface TourDateManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string | null;
  tourDates: TourDateObject[];
  readOnly?: boolean;
}

const buildTourDateJobTitle = (tourName: string, location: string, tourDateType: DateType): string => {
  const safeLocation = location || "Sin ubicación";
  if (tourDateType === "show") {
    return `${tourName} (${safeLocation})`;
  }
  return `${tourName} - ${getDateTypeMeta(tourDateType)?.labelEs || tourDateType} (${safeLocation})`;
};

type PackageSelectionState = Record<PackageDepartment, TourPackageSize | null>;
type DefaultSetSelectionState = Record<PackageDepartment, string | null>;

const emptyPackageSelection = (): PackageSelectionState => ({
  sound: null,
  lights: null,
  video: null,
});

const emptyDefaultSetSelection = (): DefaultSetSelectionState => ({
  sound: null,
  lights: null,
  video: null,
});

const packageSelectValue = (value: TourPackageSize | null) => value ?? "unassigned";
const defaultSetSelectValue = (value: string | null) => value ?? "auto";

export const TourDateManagementDialog: React.FC<TourDateManagementDialogProps> = ({
  open,
  onOpenChange,
  tourId,
  tourDates = [],
  readOnly = false,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getOrCreateLocation, getOrCreateLocationWithDetails } = useLocationManagement();
  const { defaultSets } = useTourDefaultSets(tourId || "");

  // Add real-time subscriptions
  const tourDateIds = React.useMemo(() => tourDates.map(d => d.id), [tourDates]);
  useTourDateRealtime(tourId, tourDateIds);

  // Force refresh parent component data when dialog opens
  useEffect(() => {
    if (open && tourId) {
      console.log('Dialog opened, refreshing tour data');
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('tour', tourId) });
    }
  }, [open, tourId, queryClient]);

  const [editingTourDate, setEditingTourDate] = useState<any>(null);
  const [editLocationValue, setEditLocationValue] = useState<string>("");
  const [editTourDateType, setEditTourDateType] = useState<DateType>("show");
  const [editStartDate, setEditStartDate] = useState<string>("");
  const [editEndDate, setEditEndDate] = useState<string>("");
  const [editTourPackOnly, setEditTourPackOnly] = useState<boolean>(false);
  const [editPackageSizes, setEditPackageSizes] = useState<PackageSelectionState>(emptyPackageSelection);
  const [editDefaultSetIds, setEditDefaultSetIds] = useState<DefaultSetSelectionState>(emptyDefaultSetSelection);
  const [isDeletingDate, setIsDeletingDate] = useState<string | null>(null);

  // New date form state
  const [newLocation, setNewLocation] = useState<string>("");
  const [newLocationDetails, setNewLocationDetails] = useState<LocationDetails | null>(null);
  const [newTourDateType, setNewTourDateType] = useState<DateType>("show");
  const [newStartDate, setNewStartDate] = useState<string>("");
  const [newEndDate, setNewEndDate] = useState<string>("");
  const [newTourPackOnly, setNewTourPackOnly] = useState<boolean>(false);
  const [newPackageSizes, setNewPackageSizes] = useState<PackageSelectionState>(emptyPackageSelection);
  const [newDefaultSetIds, setNewDefaultSetIds] = useState<DefaultSetSelectionState>(emptyDefaultSetSelection);
  const [editLocationDetails, setEditLocationDetails] = useState<LocationDetails | null>(null);

  const { data: foldersExistenceMap } = useQuery({
    queryKey: queryKeys.scope("flex-folders-existence", tourDateIds),
    queryFn: async () => {
      if (!tourDates.length) return {};

      const { data, error } = await dataLayerClient.from("flex_folders")
        .select("tour_date_id")
        .in("tour_date_id", tourDateIds);

      if (error) throw error;

      return data.reduce((acc: Record<string, boolean>, folder) => {
        acc[folder.tour_date_id] = true;
        return acc;
      }, {});
    },
    enabled: tourDates.length > 0,
  });

  const getUniqueDefaultSetId = (
    department: PackageDepartment,
    packageSize: TourPackageSize | null
  ) => {
    if (!packageSize) return null;
    const matches = defaultSets.filter(
      (set) => set.department === department && set.package_size === packageSize
    );
    return matches.length === 1 ? matches[0].id : null;
  };

  const buildPackageUpdatePayload = (
    packageSizes: PackageSelectionState,
    defaultSetIds: DefaultSetSelectionState
  ) => ({
    sound_package_size: packageSizes.sound,
    lights_package_size: packageSizes.lights,
    video_package_size: packageSizes.video,
    sound_default_set_id:
      defaultSetIds.sound || getUniqueDefaultSetId("sound", packageSizes.sound),
    lights_default_set_id:
      defaultSetIds.lights || getUniqueDefaultSetId("lights", packageSizes.lights),
    video_default_set_id:
      defaultSetIds.video || getUniqueDefaultSetId("video", packageSizes.video),
  });

  const invalidateTourDocumentQueries = async () => {
    if (!tourId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour-documents", tourId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("jobcard-tour-documents") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour-documents-for-job") }),
    ]);
  };

  const syncTourDefaultDocumentsForDate = async (dateId: string) => {
    if (!tourId) return;

    try {
      const result = await syncTourDefaultDocuments({
        tourId,
        tourDateIds: [dateId],
      });
      await invalidateTourDocumentQueries();

      if (result.errors.length > 0) {
        toast({
          title: "Fecha de gira guardada con avisos de PDF",
          description: `${result.errors.length} documento(s) predeterminados no se pudieron actualizar.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error syncing tour default documents:", error);
      toast({
        title: "Fecha de gira guardada con avisos de PDF",
        description: "No se pudieron actualizar los PDF del paquete para esta fecha.",
        variant: "destructive",
      });
    }
  };

  const applyTourPackShortcut = (
    checked: boolean,
    setTourPackOnly: (value: boolean) => void,
    setPackageSizes: React.Dispatch<React.SetStateAction<PackageSelectionState>>,
    setDefaultSetIds: React.Dispatch<React.SetStateAction<DefaultSetSelectionState>>
  ) => {
    setTourPackOnly(checked);
    setPackageSizes(checked ? { sound: "s", lights: "s", video: "s" } : emptyPackageSelection());
    setDefaultSetIds(emptyDefaultSetSelection());
  };

  const updatePackageSize = (
    department: PackageDepartment,
    value: string,
    setPackageSizes: React.Dispatch<React.SetStateAction<PackageSelectionState>>,
    setDefaultSetIds: React.Dispatch<React.SetStateAction<DefaultSetSelectionState>>
  ) => {
    const packageSize = value === "unassigned" ? null : (value as TourPackageSize);
    setPackageSizes((prev) => ({ ...prev, [department]: packageSize }));
    setDefaultSetIds((prev) => ({
      ...prev,
      [department]: prev[department] && packageSize ? prev[department] : null,
    }));
  };

  const renderPackageControls = ({
    packageSizes,
    setPackageSizes,
    defaultSetIds,
    setDefaultSetIds,
  }: {
    packageSizes: PackageSelectionState;
    setPackageSizes: React.Dispatch<React.SetStateAction<PackageSelectionState>>;
    defaultSetIds: DefaultSetSelectionState;
    setDefaultSetIds: React.Dispatch<React.SetStateAction<DefaultSetSelectionState>>;
  }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {PACKAGE_DEPARTMENTS.map((department) => {
        const packageSize = packageSizes[department];
        const selectableSets = defaultSets.filter(
          (set) =>
            set.department === department &&
            (!packageSize || !set.package_size || set.package_size === packageSize)
        );

        return (
          <div key={department} className="space-y-2 rounded-md border p-3">
            <Label htmlFor={`${department}-package-size`} className="text-xs md:text-sm">
              {DEPARTMENT_PACKAGE_LABELS[department]}
            </Label>
            <Select
              value={packageSelectValue(packageSize)}
              onValueChange={(value) =>
                updatePackageSize(department, value, setPackageSizes, setDefaultSetIds)
              }
            >
              <SelectTrigger id={`${department}-package-size`}>
                <SelectValue placeholder="Package size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {TOUR_PACKAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>
                    {TOUR_PACKAGE_LABELS[size]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={defaultSetSelectValue(defaultSetIds[department])}
              onValueChange={(value) =>
                setDefaultSetIds((prev) => ({
                  ...prev,
                  [department]: value === "auto" ? null : value,
                }))
              }
            >
              <SelectTrigger aria-label={`${DEPARTMENT_PACKAGE_LABELS[department]} default set`}>
                <SelectValue placeholder="Default set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto / no pin</SelectItem>
                {selectableSets.map((set) => (
                  <SelectItem key={set.id} value={set.id}>
                    {set.name}
                    {set.package_size ? ` (${TOUR_PACKAGE_LABELS[set.package_size]})` : " (Unassigned)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );

  const renderPackageBadges = (dateObj: TourDateObject) => {
    const badges = PACKAGE_DEPARTMENTS.map((department) => {
      const packageSize = getDepartmentPackageSize(dateObj, department);
      if (!packageSize) return null;

      const resolution = resolveDefaultSetForTourDate({
        tourDate: dateObj,
        department,
        defaultSets,
      });
      const needsAttention = resolution.status !== "resolved";

      return (
        <div
          key={department}
          className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
        >
          <Package className="h-3 w-3" />
          <span>{getPackageBadgeLabel({ department, packageSize })}</span>
          {needsAttention && <AlertTriangle className="h-3 w-3 text-amber-600" />}
        </div>
      );
    }).filter(Boolean);

    return badges.length > 0 ? (
      <div className="flex flex-wrap items-center gap-1">{badges}</div>
    ) : null;
  };

  const handleAddDate = async (
    location: string,
    tourDateType: DateType = "show",
    startDate: string,
    endDate: string,
    isTourPackOnly: boolean = false,
    packageSizes: PackageSelectionState = emptyPackageSelection(),
    defaultSetIds: DefaultSetSelectionState = emptyDefaultSetSelection()
  ) => {
    try {
      if (!tourId) {
        throw new Error("Tour ID is required");
      }
      const finalEndDate = isSingleDayDateType(tourDateType) ? startDate : (endDate || startDate);
      const dbTourDateType = toTourDateTableType(tourDateType);
      const rehearsalDays = Math.ceil((new Date(finalEndDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;

      console.log("Adding new tour date:", { startDate, finalEndDate, location, tourId, tourDateType, isTourPackOnly });

      let locationId: string | null = null;
      if (newLocationDetails && newLocationDetails.name) {
        locationId = await getOrCreateLocationWithDetails(newLocationDetails);
      } else {
        locationId = await getOrCreateLocation(location);
      }
      console.log("Location ID:", locationId);
      const { data: newTourDate, error: tourDateError } = await dataLayerClient.from("tour_dates")
        .insert({
          tour_id: tourId,
          date: startDate, // Keep for backward compatibility
          start_date: startDate,
          end_date: finalEndDate,
          tour_date_type: dbTourDateType,
          rehearsal_days: rehearsalDays,
          location_id: locationId,
          is_tour_pack_only: isTourPackOnly,
          ...buildPackageUpdatePayload(packageSizes, defaultSetIds),
        })
        .select(`
          id,
          date,
          start_date,
          end_date,
          tour_date_type,
          rehearsal_days,
          is_tour_pack_only,
          sound_package_size,
          lights_package_size,
          video_package_size,
          sound_default_set_id,
          lights_default_set_id,
          video_default_set_id,
          location:locations (
            id,
            name
          )
        `)
        .single();
      if (tourDateError) {
        console.error("Error creating tour date:", tourDateError);
        throw tourDateError;
      }
      console.log("Tour date created:", newTourDate);

      // ... keep existing code (job creation and department assignment)
      const { data: tourData, error: tourError } = await dataLayerClient.from("tours")
        .select(`
          name,
          color,
          tour_dates (
            jobs (
              job_departments (
                department
              )
            )
          )
        `)
        .eq("id", tourId)
        .single();
      if (tourError) {
        console.error("Error fetching tour:", tourError);
        throw tourError;
      }

      const { data: newJob, error: jobError } = await dataLayerClient.from("jobs")
        .insert({
          title: buildTourDateJobTitle(tourData.name, location, tourDateType),
          start_time: `${startDate}T06:00:00`,
          end_time: `${finalEndDate}T21:59:59`,
          location_id: locationId,
          tour_date_id: newTourDate.id,
          tour_id: tourId,
          color: tourData.color || "#7E69AB",
          job_type: 'tourdate',
        })
        .select()
        .single();
      if (jobError) {
        console.error("Error creating job:", jobError);
        throw jobError;
      }
      console.log("Job created:", newJob);

      const departments =
        tourData.tour_dates?.[0]?.jobs?.[0]?.job_departments?.map(
          (dept: any) => dept.department
        ) || TECHNICAL_DEPARTMENTS;
      const jobDepartments = departments.map((department) => ({
        job_id: newJob.id,
        department,
      }));
      const { error: deptError } = await dataLayerClient.from("job_departments")
        .insert(jobDepartments);
      if (deptError) {
        console.error("Error creating job departments:", deptError);
        throw deptError;
      }

      const scheduledDates = buildInclusiveDateRange(startDate, finalEndDate);
      const jobDateTypes = scheduledDates.map((date) => ({
        job_id: newJob.id,
        date,
        type: tourDateType,
      }));

      const { error: dateTypeError } = await dataLayerClient.from("job_date_types")
        .insert(jobDateTypes);
      if (dateTypeError) {
        console.error("Error creating job date types:", dateTypeError);
        throw dateTypeError;
      }

      if (tourDateType === "rehearsal") {
        await syncJobRehearsalDates(newJob.id, scheduledDates, { seedMissing: true });
      }

      // Force refresh all related queries after successful creation
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour", tourId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("tours") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("optimized-jobs") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("jobs") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("job-assignments") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("flex-folders-existence") }),
      ]);

      await syncTourDefaultDocumentsForDate(newTourDate.id);

      toast({
        title: "Success",
        description: "Tour date and job created successfully",
      });
    } catch (error: any) {
      console.error("Error adding date:", error);
      toast({
        title: "Error adding date",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditDate = async (
    dateId: string,
    newLocation: string,
    tourDateType: DateType,
    startDate: string,
    endDate: string,
    isTourPackOnly: boolean,
    packageSizes: PackageSelectionState,
    defaultSetIds: DefaultSetSelectionState
  ) => {
    try {
      if (!tourId) {
        throw new Error("Tour ID is required");
      }
      const finalEndDate = isSingleDayDateType(tourDateType) ? startDate : (endDate || startDate);
      const dbTourDateType = toTourDateTableType(tourDateType);
      const rehearsalDays = Math.ceil((new Date(finalEndDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      console.log("Editing tour date:", { dateId, startDate, finalEndDate, newLocation, tourDateType, isTourPackOnly });
      let locationId: string | null = null;
      if (editLocationDetails && editLocationDetails.name) {
        locationId = await getOrCreateLocationWithDetails(editLocationDetails);
      } else {
        locationId = await getOrCreateLocation(newLocation);
      }

      const { data: tourData, error: tourError } = await dataLayerClient.from("tours")
        .select("name")
        .eq("id", tourId)
        .single();

      if (tourError) {
        console.error("Error fetching tour:", tourError);
        throw tourError;
      }

      const { data: updatedDate, error: dateError } = await dataLayerClient.from("tour_dates")
        .update({
          date: startDate,
          start_date: startDate,
          end_date: finalEndDate,
          tour_date_type: dbTourDateType,
          rehearsal_days: rehearsalDays,
          location_id: locationId,
          is_tour_pack_only: isTourPackOnly,
          ...buildPackageUpdatePayload(packageSizes, defaultSetIds),
        })
        .eq("id", dateId)
        .select(`
          id,
          date,
          is_tour_pack_only,
          sound_package_size,
          lights_package_size,
          video_package_size,
          sound_default_set_id,
          lights_default_set_id,
          video_default_set_id,
          location:locations (
            id,
            name
          ),
          tours (
            name
          )
        `)
        .single();

      if (dateError) {
        console.error("Error updating tour date:", dateError);
        throw dateError;
      }

      // Send push notification if tour date type changed
      if (editingTourDate && editingTourDate.tour_date_type !== tourDateType) {
        try {
          void dataLayerClient.functions.invoke('push', {
            body: {
              action: 'broadcast',
              type: `tourdate.type.changed.${tourDateType}`,
              tour_id: tourId,
              tour_date_id: dateId,
              tour_name: tourData.name,
              location_name: newLocation || (updatedDate?.location as any)?.name || '',
              old_type: editingTourDate.tour_date_type,
              new_type: tourDateType,
              url: `/tours/${tourId}`
            }
          });
        } catch (err) {
          console.error('Failed to send push notification:', err);
        }
      }

      const { data: jobs, error: jobsError } = await dataLayerClient.from("jobs")
        .update({
          title: buildTourDateJobTitle(tourData.name, newLocation, tourDateType),
          start_time: `${startDate}T06:00:00`,
          end_time: `${finalEndDate}T21:59:59`,
          location_id: locationId,
        })
        .eq("tour_date_id", dateId)
        .select("id");

      if (jobsError) {
        console.error("Error updating job:", jobsError);
        throw jobsError;
      }

      const scheduledDates = buildInclusiveDateRange(startDate, finalEndDate);

      // Update job date types for all jobs of this tour date
      if (jobs && jobs.length > 0) {
        for (const job of jobs) {
          // Delete existing job date types for this job
          await dataLayerClient.from("job_date_types")
            .delete()
            .eq("job_id", job.id);

          // Create new job date types for the updated date range
          const jobDateTypes = scheduledDates.map((date) => ({
            job_id: job.id,
            date,
            type: tourDateType,
          }));

          if (jobDateTypes.length > 0) {
            const { error: dateTypeError } = await dataLayerClient.from("job_date_types")
              .insert(jobDateTypes);
            if (dateTypeError) {
              console.error("Error updating job date types:", dateTypeError);
            }
          }
        }

        await syncJobRehearsalDatesForJobs(
          jobs.map((job) => job.id),
          scheduledDates,
          { seedMissing: tourDateType === "rehearsal" }
        );
      }

      // Sync Flex elements if date changed and flex folders exist
      const originalDate = editingTourDate?.date || editingTourDate?.start_date;
      const dateChanged = originalDate && originalDate.split('T')[0] !== startDate;
      const hasFlexFolders = foldersExistenceMap?.[dateId];
      let flexSyncHadWarningsOrError = false;

      if (dateChanged && hasFlexFolders) {
        try {
          console.log("[TourDateManagement] Date changed, syncing Flex elements...");
          const syncResult = await syncFlexElementsForTourDateChange(
            dateId,
            startDate
          );
          if (syncResult.failed > 0) {
            flexSyncHadWarningsOrError = true;
            console.warn(
              `[TourDateManagement] Flex sync completed with ${syncResult.failed} errors:`,
              syncResult.errors
            );
            toast({
              title: "Tour date updated with warnings",
              description: `Tour date saved but ${syncResult.failed} Flex element(s) failed to sync.`,
              variant: "destructive",
            });
          } else if (syncResult.success > 0) {
            console.log(
              `[TourDateManagement] Flex sync completed: ${syncResult.success} elements updated`
            );
          }
        } catch (syncError: unknown) {
          flexSyncHadWarningsOrError = true;
          console.error("[TourDateManagement] Flex sync error:", syncError);
          const errorMessage = syncError instanceof Error
            ? syncError.message
            : String(syncError);
          toast({
            title: "Tour date updated with warnings",
            description: "Tour date saved but Flex sync failed: " + errorMessage,
            variant: "destructive",
          });
        }
      }

      // Force refresh all related queries after successful edit
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour", tourId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("tours") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("optimized-jobs") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("jobs") }),
      ]);

      await syncTourDefaultDocumentsForDate(dateId);

      // Only show success toast if flex sync didn't have warnings or errors
      if (!flexSyncHadWarningsOrError) {
        toast({
          title: "Success",
          description: "Tour date updated successfully",
        });
      }
    } catch (error: any) {
      console.error("Error editing date:", error);
      toast({
        title: "Error editing date",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteDate = async (dateId: string) => {
    // ... keep existing code (deletion logic remains the same)
    if (isDeletingDate) return; // Prevent multiple simultaneous deletions

    setIsDeletingDate(dateId);

    try {
      console.log("Starting deletion of tour date:", dateId);

      // Step 1: Delete flex folders first
      console.log("Deleting flex folders...");
      const { error: flexFoldersError } = await dataLayerClient.from("flex_folders")
        .delete()
        .eq("tour_date_id", dateId);

      if (flexFoldersError) {
        console.error("Error deleting flex folders:", flexFoldersError);
        throw flexFoldersError;
      }

      // Step 2: Get all jobs for this tour date
      console.log("Fetching jobs for tour date...");
      const { data: jobs, error: jobsError } = await dataLayerClient.from("jobs")
        .select("id")
        .eq("tour_date_id", dateId);

      if (jobsError) {
        console.error("Error fetching jobs:", jobsError);
        throw jobsError;
      }

      console.log("Found jobs to delete:", jobs);

      // Step 3: Delete job-related data if jobs exist
      if (jobs && jobs.length > 0) {
        const jobIds = jobs.map(j => j.id);
        console.log("Deleting job-related data for jobs:", jobIds);

        // Delete in the correct order to avoid foreign key constraints
        const deletionSteps = [
          // Task documents first
          { table: "task_documents", condition: "sound_task_id", subquery: "sound_job_tasks" },
          { table: "task_documents", condition: "lights_task_id", subquery: "lights_job_tasks" },
          { table: "task_documents", condition: "video_task_id", subquery: "video_job_tasks" },
          { table: "task_documents", condition: "production_task_id", subquery: "production_job_tasks" },
          { table: "task_documents", condition: "administrative_task_id", subquery: "administrative_job_tasks" },

          // Tasks
          { table: "sound_job_tasks", condition: "job_id" },
          { table: "lights_job_tasks", condition: "job_id" },
          { table: "video_job_tasks", condition: "job_id" },
          { table: "production_job_tasks", condition: "job_id" },
          { table: "administrative_job_tasks", condition: "job_id" },

          // Personnel
          { table: "sound_job_personnel", condition: "job_id" },
          { table: "lights_job_personnel", condition: "job_id" },
          { table: "video_job_personnel", condition: "job_id" },

          // Other job-related tables
          { table: "job_assignments", condition: "job_id" },
          { table: "job_departments", condition: "job_id" },
          { table: "job_documents", condition: "job_id" },
          { table: "logistics_events", condition: "job_id" },
          { table: "hoja_de_ruta", condition: "job_id" },
          { table: "memoria_tecnica_documents", condition: "job_id" },
          { table: "lights_memoria_tecnica_documents", condition: "job_id" },
          { table: "video_memoria_tecnica_documents", condition: "job_id" },
          { table: "job_date_types", condition: "job_id", useService: true },
          { table: "job_milestones", condition: "job_id" },
          { table: "power_requirement_tables", condition: "job_id" },
          { table: "festival_artists", condition: "job_id" },
          { table: "festival_gear_setups", condition: "job_id" },
          { table: "festival_logos", condition: "job_id" },
          { table: "festival_shifts", condition: "job_id" },
          { table: "festival_settings", condition: "job_id" },
          { table: "festival_stages", condition: "job_id" },
          { table: "technician_work_records", condition: "job_id" },

          // Newly identified child tables
          { table: "timesheets", condition: "job_id" },
          { table: "job_expenses", condition: "job_id" },
          { table: "expense_permissions", condition: "job_id" },
          { table: "job_rehearsal_dates", condition: "job_id" },
          { table: "staffing_campaigns", condition: "job_id" },
          { table: "job_technician_payout_overrides", condition: "job_id" },
          { table: "job_stage_plots", condition: "job_id" },
          { table: "job_whatsapp_groups", condition: "job_id" },
          { table: "job_whatsapp_group_requests", condition: "job_id" },
          { table: "job_required_roles", condition: "job_id" },
          { table: "presets", condition: "job_id" },
          { table: "sub_rentals", condition: "job_id" },
          { table: "job_rate_extras", condition: "job_id" },
          { table: "transport_requests", condition: "job_id" },
          { table: "staffing_requests", condition: "job_id" },
          { table: "assignment_notifications", condition: "job_id" },
          { table: "job_milestone_definitions", condition: "job_id" },
          { table: "availability_conflicts", condition: "job_id" },
          { table: "flex_crew_calls", condition: "job_id" },
          { table: "flex_work_orders", condition: "job_id" },
        ];

        for (const step of deletionSteps) {
          if (!jobIds || jobIds.length === 0) continue;

          console.log(`Deleting from ${step.table}...`);

          try {
            if (step.subquery) {
              // Handle task documents which reference task IDs
              const { data: taskIds } = await fromDynamicTable(step.subquery)
                .select("id")
                .in("job_id", jobIds);

              if (taskIds && taskIds.length > 0) {
                const { error } = await fromDynamicTable(step.table)
                  .delete()
                  .in(step.condition, taskIds.map((t: { id: string }) => t.id));

                if (error) {
                  console.error(`Error deleting from ${step.table}:`, error);
                }
              }
            } else if (step.useService && step.table === "job_date_types") {
              // Use service for job date types deletion
              for (const jobId of jobIds) {
                try {
                  await deleteJobDateTypes(jobId);
                } catch (error) {
                  console.error(`Error deleting job date types for job ${jobId}:`, error);
                }
              }
            } else {
              // Direct deletion by job_id
              const { error } = await fromDynamicTable(step.table)
                .delete()
                .in(step.condition, jobIds);

              if (error) {
                console.warn(`Warning deleting from ${step.table} (likely restricted or empty):`, error);
                // Continue with other deletions
              }
            }
          } catch (err) {
            console.error(`Unexpected error during ${step.table} deletion:`, err);
          }
        }

        // Finally delete the jobs themselves
        console.log("Deleting jobs...");
        const { error: jobsDeleteError } = await dataLayerClient.from("jobs")
          .delete()
          .in("id", jobIds);

        if (jobsDeleteError) {
          console.error("Error deleting jobs:", jobsDeleteError);
          throw jobsDeleteError;
        }
      }

      // Step 4: Delete tour date overrides
      console.log("Deleting tour date overrides...");
      await Promise.all([
        dataLayerClient.from("tour_date_power_overrides").delete().eq("tour_date_id", dateId),
        dataLayerClient.from("tour_date_weight_overrides").delete().eq("tour_date_id", dateId)
      ]);

      // Step 5: Finally delete the tour date itself
      console.log("Deleting tour date...");
      const { error: dateError } = await dataLayerClient.from("tour_dates")
        .delete()
        .eq("id", dateId);

      if (dateError) {
        console.error("Error deleting tour date:", dateError);
        throw dateError;
      }

      let defaultDocumentCleanupFailed = false;
      if (tourId) {
        try {
          await cleanupTourDefaultDocumentsForDate({ tourId, tourDateId: dateId });
        } catch (cleanupError) {
          defaultDocumentCleanupFailed = true;
          console.error("Error cleaning up tour default documents for deleted date:", cleanupError);
        }
      }

      console.log("Tour date deletion completed successfully");

      // Force refresh all related queries after successful deletion
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour", tourId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("tours") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("tours-with-dates") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("optimized-jobs") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("jobs") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("flex-folders-existence") }),
      ]);
      await invalidateTourDocumentQueries();

      toast({
        title: defaultDocumentCleanupFailed ? "Fecha eliminada con avisos" : "Fecha eliminada",
        description: defaultDocumentCleanupFailed
          ? "La fecha se eliminó, pero no se pudieron limpiar todos los PDF automáticos."
          : "La fecha de gira se eliminó correctamente."
      });

    } catch (error: any) {
      console.error("Error deleting date:", error);
      toast({
        title: "Error al eliminar la fecha",
        description: error.message || "Se produjo un error inesperado al eliminar la fecha de gira.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingDate(null);
    }
  };

  const startEditing = (dateObj: any) => {
    setEditingTourDate(dateObj);
    const baseDate = (dateObj.start_date || dateObj.date || '').split('T')[0] || '';
    setEditStartDate(baseDate);
    setEditEndDate((dateObj.end_date || baseDate || '').split('T')[0] || '');
    setEditLocationValue(dateObj.location?.name || "");
    setEditTourDateType(dateObj.tour_date_type || 'show');
    setEditTourPackOnly(dateObj.is_tour_pack_only || false);
    setEditPackageSizes({
      sound: getDepartmentPackageSize(dateObj, "sound"),
      lights: getDepartmentPackageSize(dateObj, "lights"),
      video: getDepartmentPackageSize(dateObj, "video"),
    });
    setEditDefaultSetIds({
      sound: getDepartmentDefaultSetId(dateObj, "sound"),
      lights: getDepartmentDefaultSetId(dateObj, "lights"),
      video: getDepartmentDefaultSetId(dateObj, "video"),
    });

    if (dateObj.location) {
      setEditLocationDetails({
        name: dateObj.location.name,
        address: dateObj.location.formatted_address || dateObj.location.address || '',
        coordinates:
          dateObj.location.latitude && dateObj.location.longitude
            ? { lat: dateObj.location.latitude, lng: dateObj.location.longitude }
            : undefined,
        place_id: dateObj.location.google_place_id || dateObj.location.place_id || undefined,
      });
    } else {
      setEditLocationDetails(null);
    }
  };

  const cancelEditing = () => {
    setEditingTourDate(null);
    setEditLocationValue("");
    setEditTourDateType('show');
    setEditStartDate("");
    setEditEndDate("");
    setEditTourPackOnly(false);
    setEditPackageSizes(emptyPackageSelection());
    setEditDefaultSetIds(emptyDefaultSetSelection());
    setEditLocationDetails(null);
  };

  const submitEditing = async (dateId: string) => {
    await handleEditDate(
      dateId,
      editLocationValue,
      editTourDateType,
      editStartDate,
      editEndDate,
      editTourPackOnly,
      editPackageSizes,
      editDefaultSetIds
    );
    cancelEditing();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl w-[95vw] md:w-full max-h-[95vh] md:max-h-[90vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-4 pt-4 pb-2 md:px-6 md:pt-6 md:pb-4 border-b">
            <DialogTitle className="text-base md:text-lg">
              {readOnly ? 'Tour Dates' : 'Manage Tour Dates'}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-auto px-4 md:px-6">
            <div className="space-y-3 md:space-y-4 py-4 pb-6">
              {/* Bulk folders button removed; availability moved to Team Assignments */}

              <div className="space-y-4">
                {tourDates?.map((dateObj) => {
                  const foldersExist = foldersExistenceMap?.[dateObj.id] || false;
                  const isDeleting = isDeletingDate === dateObj.id;

                  return (
                    <div key={dateObj.id} className="p-3 md:p-4 border rounded-lg">
                      {editingTourDate && editingTourDate.id === dateObj.id && !readOnly ? (
                        <div className="flex flex-col gap-3">
                          <div className="space-y-2">
                            <Label htmlFor={`edit-tour-date-type-${dateObj.id}`}>Tipo</Label>
                            <Select
                              value={editTourDateType}
                              onValueChange={(value) => {
                                const nextType = value as DateType;
                                setEditTourDateType(nextType);
                                if (isSingleDayDateType(nextType)) {
                                  setEditEndDate(editStartDate);
                                }
                              }}
                            >
                              <SelectTrigger id={`edit-tour-date-type-${dateObj.id}`}>
                                <SelectValue placeholder="Seleccione tipo de fecha" />
                              </SelectTrigger>
                              <SelectContent>
                                {TOUR_DATE_TYPE_OPTIONS.map((option) => {
                                  const Icon = option.icon;

                                  return (
                                    <SelectItem key={option.value} value={option.value}>
                                      <div className="flex items-center gap-2">
                                        <Icon className={`h-4 w-4 ${option.iconClassName}`} />
                                        {option.label}
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 flex-shrink-0" />
                            <Input
                              type="date"
                              value={editStartDate}
                              onChange={(e) => {
                                const newDate = e.target.value;
                                setEditStartDate(newDate);
                                if (isSingleDayDateType(editTourDateType)) {
                                  setEditEndDate(newDate);
                                }
                              }}
                              required
                              className="text-sm"
                            />
                          </div>
                          {!isSingleDayDateType(editTourDateType) && (
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 flex-shrink-0" />
                              <Input
                                type="date"
                                value={editEndDate}
                                min={editStartDate}
                                onChange={(e) => setEditEndDate(e.target.value)}
                                required
                                className="text-sm"
                              />
                            </div>
                          )}
                          <PlaceAutocomplete
                            value={editLocationValue}
                            onInputChange={(value) => {
                              setEditLocationValue(value);
                              setEditLocationDetails(null);
                            }}
                            onSelect={(result) => {
                              setEditLocationValue(result.name);
                              setEditLocationDetails({
                                name: result.name,
                                address: result.address,
                                coordinates: result.coordinates,
                                place_id: result.place_id,
                              });
                            }}
                            placeholder="Location"
                            label="Location"
                            className="w-full"
                          />
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="tour-pack-only-edit"
                              checked={editTourPackOnly}
                              onCheckedChange={(checked) =>
                                applyTourPackShortcut(
                                  checked as boolean,
                                  setEditTourPackOnly,
                                  setEditPackageSizes,
                                  setEditDefaultSetIds
                                )
                              }
                            />
                            <Label htmlFor="tour-pack-only-edit" className="text-xs md:text-sm">
                              Tour Pack / S package
                            </Label>
                          </div>
                          {renderPackageControls({
                            packageSizes: editPackageSizes,
                            setPackageSizes: setEditPackageSizes,
                            defaultSetIds: editDefaultSetIds,
                            setDefaultSetIds: setEditDefaultSetIds,
                          })}
                          <div className="flex flex-col-reverse sm:flex-row gap-2">
                            <Button variant="outline" onClick={cancelEditing} className="w-full sm:w-auto">
                              Cancel
                            </Button>
                            <Button onClick={() => submitEditing(dateObj.id)} className="w-full sm:w-auto">
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
                              <Calendar className="h-4 w-4 flex-shrink-0" />
                              <span>{format(new Date(dateObj.date), "MMM d, yyyy")}</span>
                              {renderPackageBadges(dateObj)}
                            </div>
                            {dateObj.location?.name && (
                              <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                                <MapPin className="h-4 w-4 flex-shrink-0" />
                                <span className="truncate">{dateObj.location.name}</span>
                              </div>
                            )}
                            {foldersExist && (
                              <div className="text-xs text-green-600">
                                ✓ Flex folders created
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1 md:gap-2 self-end sm:self-auto">
                            {!readOnly && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => startEditing(dateObj)}
                                  title="Edit Date"
                                  disabled={isDeleting}
                                  className="h-9 w-9 touch-manipulation"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteDate(dateObj.id)}
                                  title="Delete Date"
                                  disabled={isDeleting}
                                  className={`h-9 w-9 touch-manipulation ${isDeleting ? "opacity-50 cursor-not-allowed" : ""}`}
                                >
                                  {isDeleting ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!readOnly && (
                <div className="space-y-3 md:space-y-4 border-t pt-4">
                  <h3 className="text-base md:text-lg font-semibold">Añadir nueva fecha</h3>
                  <TourDateFormFields
                    location={newLocation}
                    setLocation={setNewLocation}
                    setLocationDetails={setNewLocationDetails}
                    tourDateType={newTourDateType}
                    setTourDateType={setNewTourDateType}
                    startDate={newStartDate}
                    setStartDate={setNewStartDate}
                    endDate={newEndDate}
                    setEndDate={setNewEndDate}
                  />
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="tour-pack-only"
                      checked={newTourPackOnly}
                      onCheckedChange={(checked) =>
                        applyTourPackShortcut(
                          checked as boolean,
                          setNewTourPackOnly,
                          setNewPackageSizes,
                          setNewDefaultSetIds
                        )
                      }
                    />
                    <Label htmlFor="tour-pack-only" className="text-xs md:text-sm">
                      Tour Pack / S package
                    </Label>
                  </div>
                  {renderPackageControls({
                    packageSizes: newPackageSizes,
                    setPackageSizes: setNewPackageSizes,
                    defaultSetIds: newDefaultSetIds,
                    setDefaultSetIds: setNewDefaultSetIds,
                  })}
                  <Button
                    onClick={() => {
                      if (!newStartDate || !newLocation) {
                        toast({
                          title: "Error",
                          description: "Please fill in all required fields",
                          variant: "destructive",
                        });
                        return;
                      }
                      handleAddDate(
                        newLocation,
                        newTourDateType,
                        newStartDate,
                        newEndDate || newStartDate,
                        newTourPackOnly,
                        newPackageSizes,
                        newDefaultSetIds
                      );
                      // Reset form
                      setNewLocation("");
                      setNewLocationDetails(null);
                      setNewTourDateType('show');
                      setNewStartDate("");
                      setNewEndDate("");
                      setNewTourPackOnly(false);
                      setNewPackageSizes(emptyPackageSelection());
                      setNewDefaultSetIds(emptyDefaultSetSelection());
                    }}
                    className="w-full touch-manipulation"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">
                      Añadir {newTourDateType === "rehearsal"
                        ? "Período de ensayo"
                        : `Fecha de ${getDateTypeMeta(newTourDateType)?.labelEs || "Concierto"}`}
                    </span>
                    <span className="sm:hidden">
                      Añadir {getDateTypeMeta(newTourDateType)?.labelEs || "Concierto"}
                    </span>
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};
