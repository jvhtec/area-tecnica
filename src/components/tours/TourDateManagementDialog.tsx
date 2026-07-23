import React, { useState, useEffect } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
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
import type { LocationDetails } from "@/hooks/useLocationManagement";
import { useTourDateRealtime } from "@/hooks/useTourDateRealtime";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PlaceAutocomplete } from "@/components/maps/PlaceAutocomplete";
import { syncTourDefaultDocuments } from "@/utils/tourDefaultDocumentSync";
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
import {
  buildPackageUpdatePayload as createPackageUpdatePayload,
  emptyDefaultSetSelection,
  emptyPackageSelection,
  defaultSetSelectValue,
  packageSelectValue,
  resolvePackageDefaultSetId,
  type DefaultSetSelectionState,
  type PackageSelectionState,
  type TourDateManagementDialogProps,
  type TourDateObject,
} from "@/components/tours/tourDateManagementModel";
import { useTourDateMutations } from "@/hooks/tours/useTourDateMutations";

export const TourDateManagementDialog: React.FC<TourDateManagementDialogProps> = ({
  open,
  onOpenChange,
  tourId,
  tourDates = [],
  readOnly = false,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { defaultSets } = useTourDefaultSets(tourId || "");

  // Add real-time subscriptions
  const tourDateIds = React.useMemo(() => tourDates.map(d => d.id), [tourDates]);
  useTourDateRealtime(tourId, tourDateIds);

  // Force refresh parent component data when dialog opens
  useEffect(() => {
    if (open && tourId) {
      console.log('ResponsiveDialog opened, refreshing tour data');
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

  const resolveDefaultSetIdForPackageSelection = (
    department: PackageDepartment,
    packageSize: TourPackageSize | null,
    selectedSetId: string | null
  ) => {
    return resolvePackageDefaultSetId(defaultSets, department, packageSize, selectedSetId);
  };

  const buildPackageUpdatePayload = (
    packageSizes: PackageSelectionState,
    defaultSetIds: DefaultSetSelectionState
  ) => createPackageUpdatePayload(defaultSets, packageSizes, defaultSetIds);

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
      [department]: resolveDefaultSetIdForPackageSelection(
        department,
        packageSize,
        prev[department]
      ),
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

  const { handleAddDate, handleDeleteDate, handleEditDate } = useTourDateMutations({
    tourId,
    newLocationDetails,
    editLocationDetails,
    buildPackageUpdatePayload,
    syncTourDefaultDocumentsForDate,
    invalidateTourDocumentQueries,
    editingTourDate,
    foldersExistenceMap,
    isDeletingDate,
    setIsDeletingDate,
  });

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
      <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
        <ResponsiveDialogContent className="max-w-3xl w-[95vw] md:w-full max-h-[95vh] md:max-h-[90vh] flex flex-col gap-0 p-0">
          <ResponsiveDialogHeader className="px-4 pt-4 pb-2 md:px-6 md:pt-6 md:pb-4 border-b">
            <ResponsiveDialogTitle className="text-base md:text-lg">
              {readOnly ? 'Tour Dates' : 'Manage Tour Dates'}
            </ResponsiveDialogTitle>
          </ResponsiveDialogHeader>

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
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
};
