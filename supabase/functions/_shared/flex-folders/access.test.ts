import { expect, it } from "vitest";
import { allowedRolesForProvisioningOperation } from "./access.ts";

it.each(["job", "tour-date", "tour-root"] as const)("allows logistics for %s provisioning", (operation) => {
  expect(allowedRolesForProvisioningOperation(operation)).toContain("logistics");
});

it.each(["dryhire-year", "festival-artist-extras"] as const)("keeps %s restricted to management", (operation) => {
  expect(allowedRolesForProvisioningOperation(operation)).toEqual(["admin", "management"]);
});
