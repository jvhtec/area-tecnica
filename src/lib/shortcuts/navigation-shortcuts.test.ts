import { describe, expect, it } from "vitest";

import { getNavigationShortcutsForRole } from "@/lib/shortcuts/navigation-shortcuts";

describe("navigation shortcuts", () => {
  it("honors assignable technician access for management users", () => {
    const shortcutIds = getNavigationShortcutsForRole({
      userRole: "management",
      assignableAsTech: true,
    }).map((shortcut) => shortcut.id);

    expect(shortcutIds).toContain("nav-tech-app");
    expect(shortcutIds).toContain("nav-technician-dashboard");
  });

  it("keeps technician-only shortcuts hidden without assignable technician access", () => {
    const shortcutIds = getNavigationShortcutsForRole({
      userRole: "management",
      assignableAsTech: false,
    }).map((shortcut) => shortcut.id);

    expect(shortcutIds).not.toContain("nav-tech-app");
    expect(shortcutIds).not.toContain("nav-technician-dashboard");
  });
});
