export type CorporateEmailRole =
  | "admin"
  | "user"
  | "management"
  | "logistics"
  | "technician"
  | "house_tech"
  | "wallboard"
  | "oscar";

export type LegacyCorporateEmailRole = "staff" | "freelance";
export type CorporateEmailTechFilter = "autonomos";

export interface RecipientCriteria {
  profileIds?: string[];
  /** Direct recipient emails (bypass profiles lookup). */
  emails?: string[];
  departments?: string[];
  roles?: Array<CorporateEmailRole | LegacyCorporateEmailRole | string>;
  techFilters?: Array<CorporateEmailTechFilter | string>;
}

export interface NormalizedRecipientCriteria {
  departments: string[];
  roles: CorporateEmailRole[];
  autonomosOnly: boolean;
  roleCriteriaProvided: boolean;
  ignoredRoles: string[];
  ignoredTechFilters: string[];
}

const VALID_ROLES = new Set<CorporateEmailRole>([
  "admin",
  "user",
  "management",
  "logistics",
  "technician",
  "house_tech",
  "wallboard",
  "oscar",
]);

export function normalizeRecipientCriteria(criteria: RecipientCriteria): NormalizedRecipientCriteria {
  const departments = Array.from(
    new Set((criteria.departments ?? []).map((department) => String(department).trim()).filter(Boolean)),
  );
  const roleCriteriaProvided = Array.isArray(criteria.roles) && criteria.roles.length > 0;
  const roles = new Set<CorporateEmailRole>();
  const ignoredRoles: string[] = [];
  let autonomosOnly = false;

  for (const rawRole of criteria.roles ?? []) {
    const role = String(rawRole).trim();
    if (!role) continue;

    if (role === "staff") {
      roles.add("technician");
      continue;
    }

    if (role === "freelance") {
      roles.add("technician");
      autonomosOnly = true;
      continue;
    }

    if (VALID_ROLES.has(role as CorporateEmailRole)) {
      roles.add(role as CorporateEmailRole);
      continue;
    }

    ignoredRoles.push(role);
  }

  const ignoredTechFilters: string[] = [];
  for (const rawFilter of criteria.techFilters ?? []) {
    const filter = String(rawFilter).trim();
    if (!filter) continue;

    if (filter === "autonomos") {
      autonomosOnly = true;
      continue;
    }

    ignoredTechFilters.push(filter);
  }

  return {
    departments,
    roles: Array.from(roles),
    autonomosOnly,
    roleCriteriaProvided,
    ignoredRoles,
    ignoredTechFilters,
  };
}
