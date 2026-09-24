import type { DriverAssignmentStatus } from "@/features/logistics/fleet/fleetModel";

/** Same palette as the crew matrix: amber pending, green confirmed, red declined. */
export const assignmentStatusClass = (status: DriverAssignmentStatus): string => {
  switch (status) {
    case "confirmed":
      return "border-green-500/40 bg-green-500/15 text-green-800 dark:text-green-300";
    case "declined":
      return "border-red-500/40 bg-red-500/10 text-red-700 line-through dark:text-red-300";
    default:
      return "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300";
  }
};
