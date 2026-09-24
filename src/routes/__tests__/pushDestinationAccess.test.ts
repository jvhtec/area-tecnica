import { describe, expect, it } from "vitest";
import { generatePath } from "react-router-dom";

import { accessPolicies, matchAppRoute } from "@/routes/app-route-manifest";
import { DESTINATION_ACCESS } from "../../../supabase/functions/push/recipientDestinations";

// The push function rewrites each recipient's deep link from a copy of the
// route role gates (it runs in Deno and cannot import the manifest). This test
// fails when a route's access changes without that copy being updated.
describe("push destination access table", () => {
  it.each(DESTINATION_ACCESS.map((entry) => [entry.path, entry] as const))(
    "%s matches the route manifest",
    (_path, entry) => {
      const samplePath = generatePath(entry.path, { jobId: "job-1", tourId: "tour-1" });
      const route = matchAppRoute(samplePath);
      expect(route?.path).toBe(entry.path);
      if (!route) return;

      const policy: { allowedRoles?: readonly string[] } = accessPolicies[route.access];
      const manifestRoles = policy.allowedRoles ? [...policy.allowedRoles].sort() : null;
      const tableRoles = entry.roles ? [...entry.roles].sort() : null;
      expect(tableRoles).toEqual(manifestRoles);
    },
  );
});
