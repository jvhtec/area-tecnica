export type FlexProvisioningOperation = "job" | "tour-date" | "tour-root" | "dryhire-year" | "festival-artist-extras";

export const allowedRolesForProvisioningOperation = (operation: FlexProvisioningOperation): string[] =>
  operation === "job" || operation === "tour-date" || operation === "tour-root"
    ? ["admin", "management", "logistics"]
    : ["admin", "management"];
