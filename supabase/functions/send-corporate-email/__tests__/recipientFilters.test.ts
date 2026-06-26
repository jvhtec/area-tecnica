import { describe, expect, it } from "vitest";

import { normalizeRecipientCriteria } from "../recipientFilters.ts";

describe("corporate email recipient filters", () => {
  it("maps legacy freelance role selections to autonomous technicians", () => {
    expect(normalizeRecipientCriteria({ roles: ["freelance"] })).toMatchObject({
      roles: ["technician"],
      autonomosOnly: true,
      ignoredRoles: [],
    });
  });

  it("maps legacy staff role selections to technicians", () => {
    expect(normalizeRecipientCriteria({ roles: ["staff"] })).toMatchObject({
      roles: ["technician"],
      autonomosOnly: false,
      ignoredRoles: [],
    });
  });

  it("keeps the autonomos option separate from app roles", () => {
    expect(normalizeRecipientCriteria({ departments: ["sound"], techFilters: ["autonomos"] })).toMatchObject({
      departments: ["sound"],
      roles: ["technician"],
      autonomosOnly: true,
      ignoredTechFilters: [],
    });
  });

  it("makes autonomos override conflicting role selections", () => {
    expect(normalizeRecipientCriteria({ roles: ["logistics"], techFilters: ["autonomos"] })).toMatchObject({
      roles: ["technician"],
      autonomosOnly: true,
      ignoredRoles: [],
    });
  });

  it("preserves valid department filters when role values are unsupported", () => {
    expect(normalizeRecipientCriteria({ roles: ["not_a_role"], departments: ["sound"] })).toMatchObject({
      departments: ["sound"],
      roles: [],
      autonomosOnly: false,
      ignoredRoles: ["not_a_role"],
    });
  });

  it("ignores unsupported role values instead of passing them to the database enum", () => {
    expect(normalizeRecipientCriteria({ roles: ["freelance", "not_a_role"] })).toMatchObject({
      roles: ["technician"],
      autonomosOnly: true,
      ignoredRoles: ["not_a_role"],
    });
  });
});
