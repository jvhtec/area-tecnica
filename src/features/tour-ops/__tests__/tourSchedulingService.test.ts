import { describe, expect, it } from "vitest";
import { normalizeTourOpsModel } from "@/features/tour-ops/tourSchedulingService";

const rawTour = {
  id: "tour-1",
  name: "Arena Tour",
  description: "Spring run",
  color: "#b91c1c",
  status: "active",
  start_date: "2026-06-01",
  end_date: "2026-06-03",
  default_timezone: "Europe/Madrid",
  tour_contacts: [{ name: "PM", role: "Tour manager", phone: "600000000", notes: "internal" }],
  tour_settings: {},
  scheduling_preferences: {},
  travel_plan: [
    {
      id: "legacy-1",
      fromDateId: "date-1",
      toDateId: "date-2",
      transportType: "bus",
      departureTime: "09:00",
      arrivalTime: "12:00",
      distance: 300,
      duration: 180,
      notes: "legacy travel",
    },
  ],
};

const rawPayload = {
  tour: rawTour,
  tour_dates: [
    {
      id: "date-1",
      date: "2026-06-01",
      start_date: "2026-06-01",
      end_date: "2026-06-01",
      tour_date_type: "show",
      location_id: "loc-1",
      location: { id: "loc-1", name: "Barcelona Arena", formatted_address: "Barcelona", latitude: 41.3, longitude: 2.1 },
    },
    {
      id: "date-2",
      date: "2026-06-02",
      start_date: "2026-06-02",
      end_date: "2026-06-02",
      tour_date_type: "show",
      location_id: "loc-2",
      location: { id: "loc-2", name: "Madrid Arena", formatted_address: "Madrid", latitude: 40.4, longitude: -3.7 },
    },
  ],
  jobs: [
    {
      id: "job-1",
      title: "Barcelona show",
      status: "confirmed",
      tour_date_id: "date-1",
      job_assignments: [
        {
          id: "assign-1",
          technician_id: "tech-1",
          sound_role: "PA",
          profiles: { id: "tech-1", first_name: "Ada", last_name: "Lovelace", phone: "611111111" },
        },
      ],
    },
  ],
  hoja_de_ruta: [
    {
      id: "hdr-1",
      tour_date_id: "date-1",
      job_id: "job-1",
      program_schedule_json: [{ label: "Dia 1", rows: [{ time: "10:00", item: "Load in", dept: "sound" }] }],
      weather_data: [{ condition: "sun" }],
    },
  ],
  timeline_events: [
    { id: "evt-1", tour_id: "tour-1", event_type: "meeting", title: "Internal", date: "2026-06-01", visible_to_crew: false },
    { id: "evt-2", tour_id: "tour-1", event_type: "meeting", title: "Crew call", date: "2026-06-01", visible_to_crew: true },
  ],
  travel_segments: [],
  accommodations: [
    { id: "hotel-1", tour_id: "tour-1", tour_date_id: "date-1", hotel_name: "Hotel One", check_in_date: "2026-06-01", check_out_date: "2026-06-02" },
  ],
  documents: [
    { id: "doc-1", tour_id: "tour-1", file_name: "Internal.pdf", file_path: "a", visible_to_tech: false, visible_to_guest: false },
    { id: "doc-2", tour_id: "tour-1", file_name: "Crew.pdf", file_path: "b", visible_to_tech: true, visible_to_guest: false },
    { id: "doc-3", tour_id: "tour-1", file_name: "Guest.pdf", file_path: "c", visible_to_tech: true, visible_to_guest: true },
  ],
  tour_assignments: [
    { id: "tour-assign-1", technician_id: "tech-2", department: "lights", role: "LX", profiles: { first_name: "Grace", last_name: "Hopper" } },
  ],
};

describe("tour ops normalization", () => {
  it("merges tour dates, jobs, hoja schedule, crew, accommodation, and legacy travel", () => {
    const model = normalizeTourOpsModel(rawPayload, "management");

    expect(model.tour.name).toBe("Arena Tour");
    expect(model.tour.hasLegacyTravelPlan).toBe(true);
    expect(model.dates).toHaveLength(2);
    expect(model.dates[0].jobId).toBe("job-1");
    expect(model.dates[0].program[0].rows[0].item).toBe("Load in");
    expect(model.dates[0].crew.map((member) => member.name)).toContain("Ada Lovelace");
    expect(model.dates[0].accommodations[0].hotelName).toBe("Hotel One");
    expect(model.travelSegments[0]).toMatchObject({
      source: "legacy",
      fromTourDateId: "date-1",
      toTourDateId: "date-2",
      transportationType: "bus",
    });
    expect(model.health.some((issue) => issue.id === "date-2:job")).toBe(true);
  });

  it("filters private data for technician and guest projections", () => {
    const tech = normalizeTourOpsModel(rawPayload, "technician");
    const guest = normalizeTourOpsModel(rawPayload, "guest");

    expect(tech.timelineEvents.map((event) => event.title)).toEqual(["Crew call"]);
    expect(tech.documents.map((doc) => doc.fileName)).toEqual(["Crew.pdf", "Guest.pdf"]);
    expect(tech.dates[0].crew.length).toBeGreaterThan(0);

    expect(guest.timelineEvents.map((event) => event.title)).toEqual(["Crew call"]);
    expect(guest.documents.map((doc) => doc.fileName)).toEqual(["Guest.pdf"]);
    expect(guest.dates[0].crew).toEqual([]);
    expect(guest.health).toEqual([]);
  });

  it("honors external allowed section toggles", () => {
    const guest = normalizeTourOpsModel(rawPayload, "guest", {
      allowedSections: {
        documents: false,
        travel: false,
        accommodations: false,
      },
    });

    expect(guest.documents).toEqual([]);
    expect(guest.travelSegments).toEqual([]);
    expect(guest.dates[0].travelIn).toEqual([]);
    expect(guest.dates[0].accommodations).toEqual([]);
  });
});
