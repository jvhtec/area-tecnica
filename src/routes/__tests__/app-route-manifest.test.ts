import { describe, expect, it } from "vitest";

import {
  appRoutes,
  getBreadcrumbsForPathname,
  getSubscriptionConfigForPathname,
  matchAppRoute,
  navigationShortcuts,
  publicRoutes,
} from "@/routes/app-route-manifest";

describe("app route manifest", () => {
  it("keeps route paths unique", () => {
    const paths = appRoutes.map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("keeps route ids and nav ids unique", () => {
    const routeIds = appRoutes.map((route) => route.id);
    const navIds = appRoutes.flatMap((route) => (route.nav ? [route.nav.id] : []));

    expect(new Set(routeIds).size).toBe(routeIds.length);
    expect(new Set(navIds).size).toBe(navIds.length);
  });

  it("keeps public access on public layout routes only", () => {
    const publicRouteIds = new Set(publicRoutes.map((route) => route.id));

    appRoutes.forEach((route) => {
      if (route.access === "public") {
        expect(publicRouteIds.has(route.id)).toBe(true);
      } else {
        expect(route.layout).not.toBe("public");
      }
    });
  });

  it("keeps duplicate subscription route keys on the same profile", () => {
    const profilesByRouteKey = new Map<string, string>();

    appRoutes.forEach((route) => {
      if (!route.subscriptions) {
        return;
      }

      const routeKey = route.subscriptionRouteKey ?? route.path;
      const existingProfile = profilesByRouteKey.get(routeKey);

      if (existingProfile) {
        expect(route.subscriptions, routeKey).toBe(existingProfile);
      } else {
        profilesByRouteKey.set(routeKey, route.subscriptions);
      }
    });
  });

  it("resolves subscriptions from dynamic manifest routes", () => {
    expect(getSubscriptionConfigForPathname("/festival-management/job-1/artists")).toMatchObject({
      routeKey: "/festival-management/artists",
      tables: expect.arrayContaining([
        expect.objectContaining({ table: "festival_artists", priority: "high" }),
      ]),
    });

    expect(getSubscriptionConfigForPathname("/tour-management/tour-1")).toMatchObject({
      routeKey: "/tour-management",
      tables: expect.arrayContaining([
        expect.objectContaining({ table: "tour_dates", priority: "high" }),
      ]),
    });
  });

  it("keeps navigation shortcuts pointed at manifest routes", () => {
    navigationShortcuts.forEach((shortcut) => {
      expect(matchAppRoute(shortcut.route), shortcut.id).not.toBeNull();
    });
  });

  it("resolves breadcrumb metadata from the manifest", () => {
    expect(getBreadcrumbsForPathname("/festival-management/job-1/gear")).toEqual([
      { label: "Festivales", path: "/festivals" },
      { label: "Equipamiento", path: "/festival-management/job-1/gear" },
    ]);
  });
});
