import { describe, expect, it } from "vitest";

import { hojaDocumentSchema } from "@/features/hoja-de-ruta/model/hojaDocumentSchema";

const validDocument = {
  eventData: {
    eventName: "Evento",
    eventDates: "1 febrero 2032",
    venue: { name: "Sala", address: "Madrid" },
    contacts: [{ phone: "+34 600 000 000", email: "prod@example.com" }],
    staff: [{ dni: "12345678Z", phone: "+34 611 111 111" }],
    auxiliaryStaffSetupQty: 0,
    auxiliaryStaffDismantleQty: 2,
  },
  travelArrangements: [{
    departure_time: "2032-02-01T10:00:00Z",
    arrival_time: "2032-02-01T12:00:00Z",
  }],
  accommodations: [{
    check_in: "2032-02-01T14:00:00Z",
    check_out: "2032-02-02T10:00:00Z",
  }],
};

describe("Hoja document validation", () => {
  it("accepts a complete, chronologically valid document", () => {
    expect(hojaDocumentSchema.safeParse(validDocument).success).toBe(true);
  });

  it("reports required, privacy-field, and chronology errors", () => {
    const result = hojaDocumentSchema.safeParse({
      ...validDocument,
      eventData: {
        ...validDocument.eventData,
        eventName: "",
        venue: { name: "", address: "" },
        staff: [{ dni: "not-a-dni", phone: "12" }],
      },
      travelArrangements: [{
        departure_time: "2032-02-02T10:00:00Z",
        arrival_time: "2032-02-01T12:00:00Z",
      }],
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.error.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(expect.arrayContaining([
      "eventData.eventName",
      "eventData.venue.name",
      "eventData.venue.address",
      "eventData.staff.0.dni",
      "eventData.staff.0.phone",
      "travelArrangements.0.arrival_time",
    ]));
  });
});
