/**
 * Per-recipient notification destinations.
 *
 * A broadcast builds one destination URL for the event, but its audience mixes
 * roles: a "job updated" push goes to management *and* to the freelance
 * technicians on the job. Freelancers cannot open management routes such as
 * `/festival-management/:jobId`, so the app's route guard silently bounces them
 * to `/tech-app` and the deep link is lost. This module rewrites the event URL
 * per recipient role into the closest destination that role can actually open.
 *
 * DESTINATION_ACCESS mirrors the role gate of each app route the push function
 * links to. `src/routes/__tests__/pushDestinationAccess.test.ts` checks every
 * entry against the real route manifest, so the two cannot drift silently.
 */

const ADMIN_MANAGEMENT = ["admin", "management"] as const;
const MANAGEMENT_AND_HOUSE_TECH = ["admin", "management", "house_tech"] as const;
const PROJECT_OPERATIONS = ["admin", "management", "logistics"] as const;
const DASHBOARD = ["admin", "management", "logistics", "oscar"] as const;
const PERSONAL = ["admin", "management", "logistics", "house_tech"] as const;
const TASKS = ["admin", "management", "logistics", "house_tech", "oscar"] as const;

export type DestinationAccess = {
  /** react-router style path template, e.g. `/festival-management/:jobId`. */
  path: string;
  /** Roles allowed through the route guard; `null` means any signed-in user. */
  roles: readonly string[] | null;
};

export const DESTINATION_ACCESS: readonly DestinationAccess[] = [
  { path: "/", roles: null },
  { path: "/tech-app", roles: ["technician"] },
  { path: "/technician-dashboard", roles: ["house_tech"] },
  { path: "/dashboard", roles: DASHBOARD },
  { path: "/festival-management/:jobId", roles: MANAGEMENT_AND_HOUSE_TECH },
  { path: "/festival-management/:jobId/artists", roles: MANAGEMENT_AND_HOUSE_TECH },
  { path: "/tour-management/:tourId", roles: MANAGEMENT_AND_HOUSE_TECH },
  { path: "/tours", roles: MANAGEMENT_AND_HOUSE_TECH },
  { path: "/logistics", roles: MANAGEMENT_AND_HOUSE_TECH },
  { path: "/soundvision-files", roles: MANAGEMENT_AND_HOUSE_TECH },
  { path: "/job-assignment-matrix", roles: ADMIN_MANAGEMENT },
  { path: "/incident-reports", roles: ADMIN_MANAGEMENT },
  { path: "/disponibilidad", roles: ADMIN_MANAGEMENT },
  { path: "/project-management", roles: PROJECT_OPERATIONS },
  { path: "/gastos", roles: PROJECT_OPERATIONS },
  { path: "/personal", roles: PERSONAL },
  { path: "/tasks", roles: TASKS },
  { path: "/announcements", roles: ["admin"] },
  { path: "/timesheets", roles: null },
  { path: "/feedback", roles: null },
  { path: "/morning-summary", roles: null },
  { path: "/notifications", roles: null },
  { path: "/profile", roles: null },
];

function matchesTemplate(template: string, pathname: string): boolean {
  const templateParts = template.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  if (templateParts.length !== pathParts.length) return false;
  return templateParts.every((part, index) => part.startsWith(":") || part === pathParts[index]);
}

function splitUrl(url: string): { pathname: string; params: URLSearchParams } {
  const parsed = new URL(url, "https://sector-pro.invalid");
  return { pathname: parsed.pathname, params: parsed.searchParams };
}

/**
 * Whether `role` gets through the route guard for `url`. Unknown paths are
 * treated as open: the push function only links to the routes listed above,
 * and an unrecognised path is better left untouched than rewritten blindly.
 */
export function canRoleOpenDestination(url: string, role: string | null | undefined): boolean {
  const { pathname } = splitUrl(url);
  const entry = DESTINATION_ACCESS.find((candidate) => matchesTemplate(candidate.path, pathname));
  if (!entry || entry.roles === null) return true;
  return Boolean(role && entry.roles.includes(role));
}

function homeForRole(role: string | null | undefined): string {
  if (role === "technician") return "/tech-app";
  if (role === "house_tech") return "/technician-dashboard";
  return "/dashboard";
}

/** Tech-app deep link that opens a job the freelancer is working. */
function techAppJobUrl(jobId: string, open: "details" | "artists", extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({ tab: "jobs", jobId, open, ...extra });
  return `/tech-app?${params.toString()}`;
}

export type DestinationContext = {
  jobId?: string | null;
  /** The event's own job page, used for roles that can open it. */
  jobUrl?: string | null;
};

/**
 * Returns the URL `role` should receive for an event whose shared destination
 * is `url`. When the role can open `url` it is returned unchanged.
 */
export function destinationForRole(
  url: string,
  role: string | null | undefined,
  context: DestinationContext = {},
): string {
  if (canRoleOpenDestination(url, role)) return url;

  const { pathname, params } = splitUrl(url);
  const jobId = context.jobId || pathname.match(/^\/festival-management\/([^/]+)/)?.[1] || null;

  if (role === "technician") {
    if (pathname.endsWith("/artists") && jobId) {
      const date = params.get("date");
      return techAppJobUrl(jobId, "artists", date ? { date } : {});
    }
    if (jobId) return techAppJobUrl(jobId, "details");
    if (pathname === "/personal" || pathname === "/disponibilidad") return "/tech-app?tab=availability";
    return "/tech-app";
  }

  if (context.jobUrl && canRoleOpenDestination(context.jobUrl, role)) {
    return context.jobUrl;
  }
  return homeForRole(role);
}
