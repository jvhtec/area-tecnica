export type TourPackageSize = "xl" | "l" | "m" | "s";
export type PackageDepartment = "sound" | "lights" | "video";

export const TOUR_PACKAGE_SIZES: TourPackageSize[] = ["xl", "l", "m", "s"];
export const PACKAGE_DEPARTMENTS: PackageDepartment[] = ["sound", "lights", "video"];

export const TOUR_PACKAGE_LABELS: Record<TourPackageSize, string> = {
  xl: "XL",
  l: "L",
  m: "M",
  s: "S",
};

export const DEPARTMENT_PACKAGE_LABELS: Record<PackageDepartment, string> = {
  sound: "Sound",
  lights: "Lights",
  video: "Video",
};

export const DEPARTMENT_PACKAGE_PREFIX: Record<PackageDepartment, string> = {
  sound: "SX",
  lights: "LX",
  video: "VX",
};

export interface TourPackageDateLike {
  tour_id?: string | null;
  is_tour_pack_only?: boolean | null;
  sound_package_size?: TourPackageSize | string | null;
  lights_package_size?: TourPackageSize | string | null;
  video_package_size?: TourPackageSize | string | null;
  sound_default_set_id?: string | null;
  lights_default_set_id?: string | null;
  video_default_set_id?: string | null;
}

export interface TourDefaultSetLike {
  id: string;
  tour_id: string;
  department: string | null;
  name?: string | null;
  package_size?: TourPackageSize | string | null;
}

export type ResolveDefaultSetResult<TSet extends TourDefaultSetLike = TourDefaultSetLike> =
  | {
      status: "resolved";
      set: TSet;
      source: "explicit" | "package_size" | "legacy_tour_pack" | "single_set_fallback";
      packageSize: TourPackageSize | null;
      department: PackageDepartment;
    }
  | {
      status: "missing";
      packageSize: TourPackageSize | null;
      department: PackageDepartment;
    }
  | {
      status: "ambiguous";
      packageSize: TourPackageSize | null;
      department: PackageDepartment;
      matches: TSet[];
    }
  | {
      status: "invalid_explicit";
      packageSize: TourPackageSize | null;
      department: PackageDepartment;
      setId: string;
      reason: "not_found" | "wrong_tour" | "wrong_department" | "package_mismatch";
      set?: TSet;
    };

export const isTourPackageSize = (value: unknown): value is TourPackageSize =>
  value === "xl" || value === "l" || value === "m" || value === "s";

export const isPackageDepartment = (value: unknown): value is PackageDepartment =>
  value === "sound" || value === "lights" || value === "video";

const packageFieldByDepartment: Record<PackageDepartment, keyof TourPackageDateLike> = {
  sound: "sound_package_size",
  lights: "lights_package_size",
  video: "video_package_size",
};

const defaultSetFieldByDepartment: Record<PackageDepartment, keyof TourPackageDateLike> = {
  sound: "sound_default_set_id",
  lights: "lights_default_set_id",
  video: "video_default_set_id",
};

export const getDepartmentPackageSize = (
  tourDate: TourPackageDateLike | null | undefined,
  department: PackageDepartment
): TourPackageSize | null => {
  if (!tourDate) return null;

  const value = tourDate[packageFieldByDepartment[department]];
  if (isTourPackageSize(value)) return value;

  if (tourDate.is_tour_pack_only === true) {
    return "s";
  }

  return null;
};

export const getExplicitDepartmentPackageSize = (
  tourDate: TourPackageDateLike | null | undefined,
  department: PackageDepartment
): TourPackageSize | null => {
  if (!tourDate) return null;
  const value = tourDate[packageFieldByDepartment[department]];
  return isTourPackageSize(value) ? value : null;
};

export const getDepartmentDefaultSetId = (
  tourDate: TourPackageDateLike | null | undefined,
  department: PackageDepartment
): string | null => {
  if (!tourDate) return null;
  const value = tourDate[defaultSetFieldByDepartment[department]];
  return typeof value === "string" && value.length > 0 ? value : null;
};

export const getPackageBadgeLabel = ({
  department,
  packageSize,
  mobile = false,
}: {
  department: PackageDepartment;
  packageSize: TourPackageSize;
  defaultSet?: TourDefaultSetLike | null;
  mobile?: boolean;
}) => {
  const departmentLabel = mobile
    ? DEPARTMENT_PACKAGE_PREFIX[department]
    : DEPARTMENT_PACKAGE_LABELS[department];

  return `${departmentLabel} ${TOUR_PACKAGE_LABELS[packageSize]}`;
};

export const getPackageSetLabel = (
  department: PackageDepartment,
  packageSize: TourPackageSize | null,
  defaultSet?: TourDefaultSetLike | null
) => {
  const packageLabel = packageSize ? getPackageBadgeLabel({ department, packageSize }) : DEPARTMENT_PACKAGE_LABELS[department];
  return defaultSet?.name ? `${packageLabel} - ${defaultSet.name}` : packageLabel;
};

const setMatchesTour = (tourDate: TourPackageDateLike, set: TourDefaultSetLike) =>
  !tourDate.tour_id || set.tour_id === tourDate.tour_id;

const setMatchesDepartment = (set: TourDefaultSetLike, department: PackageDepartment) =>
  set.department === department;

export const resolveDefaultSetForTourDate = <TSet extends TourDefaultSetLike>({
  tourDate,
  department,
  defaultSets,
}: {
  tourDate: TourPackageDateLike;
  department: PackageDepartment;
  defaultSets: TSet[];
}): ResolveDefaultSetResult<TSet> => {
  const explicitPackageSize = getExplicitDepartmentPackageSize(tourDate, department);
  const packageSize = getDepartmentPackageSize(tourDate, department);
  const explicitSetId = getDepartmentDefaultSetId(tourDate, department);

  if (explicitSetId) {
    const explicitSet = defaultSets.find((set) => set.id === explicitSetId);
    if (!explicitSet) {
      return {
        status: "invalid_explicit",
        packageSize,
        department,
        setId: explicitSetId,
        reason: "not_found",
      };
    }

    if (!setMatchesTour(tourDate, explicitSet)) {
      return {
        status: "invalid_explicit",
        packageSize,
        department,
        setId: explicitSetId,
        reason: "wrong_tour",
        set: explicitSet,
      };
    }

    if (!setMatchesDepartment(explicitSet, department)) {
      return {
        status: "invalid_explicit",
        packageSize,
        department,
        setId: explicitSetId,
        reason: "wrong_department",
        set: explicitSet,
      };
    }

    if (
      explicitPackageSize &&
      explicitSet.package_size &&
      explicitSet.package_size !== explicitPackageSize
    ) {
      return {
        status: "invalid_explicit",
        packageSize,
        department,
        setId: explicitSetId,
        reason: "package_mismatch",
        set: explicitSet,
      };
    }

    return {
      status: "resolved",
      set: explicitSet,
      source: "explicit",
      packageSize,
      department,
    };
  }

  const departmentSets = defaultSets.filter(
    (set) => setMatchesTour(tourDate, set) && setMatchesDepartment(set, department)
  );

  if (packageSize) {
    const matches = departmentSets.filter((set) => set.package_size === packageSize);
    if (matches.length === 1) {
      return {
        status: "resolved",
        set: matches[0],
        source: explicitPackageSize ? "package_size" : "legacy_tour_pack",
        packageSize,
        department,
      };
    }

    if (matches.length > 1) {
      return {
        status: "ambiguous",
        packageSize,
        department,
        matches,
      };
    }

    return {
      status: "missing",
      packageSize,
      department,
    };
  }

  if (departmentSets.length === 1) {
    return {
      status: "resolved",
      set: departmentSets[0],
      source: "single_set_fallback",
      packageSize: null,
      department,
    };
  }

  if (departmentSets.length > 1) {
    return {
      status: "ambiguous",
      packageSize: null,
      department,
      matches: departmentSets,
    };
  }

  return {
    status: "missing",
    packageSize: null,
    department,
  };
};

export const getPackageResolutionMessage = (
  result: ResolveDefaultSetResult,
  typeLabel = "default set"
) => {
  const departmentLabel = DEPARTMENT_PACKAGE_LABELS[result.department];
  const packageLabel = result.packageSize ? ` ${TOUR_PACKAGE_LABELS[result.packageSize]}` : "";

  if (result.status === "missing") {
    return `${departmentLabel}${packageLabel} is selected for this tour date, but no ${departmentLabel}${packageLabel} ${typeLabel} exists yet.`;
  }

  if (result.status === "ambiguous") {
    return `Multiple ${departmentLabel}${packageLabel} ${typeLabel}s exist. Select the exact set for this date.`;
  }

  if (result.status === "invalid_explicit") {
    return `The selected ${departmentLabel} ${typeLabel} is no longer valid for this tour date.`;
  }

  return null;
};
