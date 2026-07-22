import { getDateTypeMeta, type DateType } from "@/constants/dateTypes";
import type { TourDefaultSet } from "@/hooks/useTourDefaultSets";
import type { PackageDepartment, TourPackageSize } from "@/utils/tourPackages";

export interface TourDateObject {
  id: string;
  date: string;
  tour_id: string;
  location_id: string | null;
  location?: { id: string; name: string };
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

export interface TourDateManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string | null;
  tourDates: TourDateObject[];
  readOnly?: boolean;
}

export type PackageSelectionState = Record<PackageDepartment, TourPackageSize | null>;
export type DefaultSetSelectionState = Record<PackageDepartment, string | null>;

export const emptyPackageSelection = (): PackageSelectionState => ({ sound: null, lights: null, video: null });
export const emptyDefaultSetSelection = (): DefaultSetSelectionState => ({ sound: null, lights: null, video: null });
export const packageSelectValue = (value: TourPackageSize | null): string => value ?? "unassigned";
export const defaultSetSelectValue = (value: string | null): string => value ?? "auto";

export const buildTourDateJobTitle = (tourName: string, location: string, tourDateType: DateType): string => {
  const safeLocation = location || "Sin ubicación";
  return tourDateType === "show"
    ? `${tourName} (${safeLocation})`
    : `${tourName} - ${getDateTypeMeta(tourDateType)?.labelEs || tourDateType} (${safeLocation})`;
};

export const resolvePackageDefaultSetId = (
  defaultSets: TourDefaultSet[],
  department: PackageDepartment,
  packageSize: TourPackageSize | null,
  selectedSetId: string | null,
): string | null => {
  const selectedSet = selectedSetId ? defaultSets.find((set) => set.id === selectedSetId) : null;
  if (selectedSet && selectedSet.department === department && (!packageSize || !selectedSet.package_size || selectedSet.package_size === packageSize)) {
    return selectedSetId;
  }
  if (!packageSize) return null;
  const matches = defaultSets.filter((set) => set.department === department && set.package_size === packageSize);
  return matches.length === 1 ? matches[0].id : null;
};

export const buildPackageUpdatePayload = (
  defaultSets: TourDefaultSet[],
  packageSizes: PackageSelectionState,
  defaultSetIds: DefaultSetSelectionState,
) => ({
  sound_package_size: packageSizes.sound,
  lights_package_size: packageSizes.lights,
  video_package_size: packageSizes.video,
  sound_default_set_id: resolvePackageDefaultSetId(defaultSets, "sound", packageSizes.sound, defaultSetIds.sound),
  lights_default_set_id: resolvePackageDefaultSetId(defaultSets, "lights", packageSizes.lights, defaultSetIds.lights),
  video_default_set_id: resolvePackageDefaultSetId(defaultSets, "video", packageSizes.video, defaultSetIds.video),
});
