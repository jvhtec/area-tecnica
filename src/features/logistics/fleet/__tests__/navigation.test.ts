import { describe, expect, it } from "vitest";

import { buildNavigationLinks, describeTimeUntil, isAppleDevice, navigationQuery } from "../navigation";

const liceu = { lat: 41.38, lng: 2.17, address: "La Rambla 51, Barcelona", name: "Liceu" };

describe("navigation links", () => {
  it("prefers coordinates for every map app and keeps driving mode", () => {
    const links = buildNavigationLinks(liceu);
    expect(links?.google).toBe("https://www.google.com/maps/dir/?api=1&destination=41.38%2C2.17&travelmode=driving");
    expect(links?.waze).toBe("https://waze.com/ul?ll=41.38%2C2.17&navigate=yes");
    expect(links?.apple).toBe("https://maps.apple.com/?daddr=41.38%2C2.17&dirflg=d");
    expect(links?.route).toBeNull();
  });

  it("falls back to name + address when there are no coordinates", () => {
    const links = buildNavigationLinks({ ...liceu, lat: null, lng: null });
    expect(links?.google).toContain("destination=Liceu%2C%20La%20Rambla%2051%2C%20Barcelona");
    expect(links?.waze).toBe("https://waze.com/ul?q=Liceu%2C%20La%20Rambla%2051%2C%20Barcelona&navigate=yes");
    // A name already contained in the address is not repeated.
    expect(navigationQuery({ lat: null, lng: null, address: "Gran Teatre del Liceu, Barcelona", name: "Liceu" }))
      .toBe("Gran Teatre del Liceu, Barcelona");
    expect(buildNavigationLinks({ lat: null, lng: null, address: null, name: null })).toBeNull();
  });

  it("adds a full-route link when the transport request names an origin", () => {
    expect(buildNavigationLinks(liceu, "Almacén Sector Pro")?.route)
      .toBe("https://www.google.com/maps/dir/?api=1&origin=Almac%C3%A9n%20Sector%20Pro&destination=41.38%2C2.17&travelmode=driving");
    expect(buildNavigationLinks(liceu, "   ")?.route).toBeNull();
  });

  it("detects Apple devices from the user agent", () => {
    expect(isAppleDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isAppleDevice("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe(false);
  });
});

describe("time until departure", () => {
  const now = "2026-10-01T06:00:00.000Z";

  it("counts down in minutes, then hours and minutes", () => {
    expect(describeTimeUntil("2026-10-01T06:45:00Z", "2026-10-01T08:00:00Z", now)).toBe("Empieza en 45 min");
    expect(describeTimeUntil("2026-10-01T08:15:00Z", "2026-10-01T10:00:00Z", now)).toBe("Empieza en 2 h 15 min");
    expect(describeTimeUntil("2026-10-01T09:00:00Z", "2026-10-01T10:00:00Z", now)).toBe("Empieza en 3 h");
  });

  it("names the day and local time beyond 24 hours, in the transport timezone", () => {
    expect(describeTimeUntil("2026-10-02T07:00:00Z", "2026-10-02T09:00:00Z", now, "Europe/Madrid"))
      .toBe("Empieza el viernes 2 de octubre a las 09:00");
    expect(describeTimeUntil("2026-10-02T07:00:00Z", "2026-10-02T09:00:00Z", now, "Europe/London"))
      .toBe("Empieza el viernes 2 de octubre a las 08:00");
  });

  it("reports a running or finished window", () => {
    expect(describeTimeUntil("2026-10-01T05:00:00Z", "2026-10-01T08:00:00Z", now)).toBe("En curso");
    expect(describeTimeUntil("2026-10-01T03:00:00Z", "2026-10-01T05:00:00Z", now)).toBe("Finalizado");
  });
});
