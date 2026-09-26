import { describe, expect, it } from "vitest";

import {
  buildHojaSavePayload,
  mapHojaAggregateToDocument,
} from "@/features/hoja-de-ruta/mappers/hojaDocumentMapper";
import type { HojaAggregate } from "@/features/hoja-de-ruta/model/HojaDocument";
import {
  HOJA_PRINT_PART_DEFINITIONS,
  HOJA_SECTION_DEFINITIONS,
} from "@/features/hoja-de-ruta/model/sectionDefinitions";
import { HOJA_SECTION_REGISTRY } from "@/features/hoja-de-ruta/sections/sectionRegistry";
import type { EventData } from "@/types/hoja-de-ruta";
import { createHojaDocumentSnapshot } from "@/utils/hoja-de-ruta/documentSnapshot";

const JOB_ID = "a1000000-0000-0000-0000-000000000001";
const CONTACT_ID = "a2000000-0000-0000-0000-000000000001";
const STAFF_ID = "a3000000-0000-0000-0000-000000000001";
const TRANSPORT_ID = "a4000000-0000-0000-0000-000000000001";
const TRAVEL_ID = "a5000000-0000-0000-0000-000000000001";
const ACCOMMODATION_ID = "a6000000-0000-0000-0000-000000000001";
const ROOM_ID = "a7000000-0000-0000-0000-000000000001";
const IMAGE_ID = "a8000000-0000-0000-0000-000000000001";

const aggregateFixture: HojaAggregate = {
  main: {
    id: "a0000000-0000-0000-0000-000000000001",
    document_version: 4,
    status: "review",
    event_name: "Gira Madrid",
    event_dates: "1 febrero 2032",
    event_start_date: "2032-02-01",
    event_end_date: "2032-02-02",
    venue_name: "Sala Test",
    venue_address: "Madrid",
    venue_latitude: "40.4168",
    venue_longitude: "-3.7038",
    aux_staff_setup_qty: -2,
    aux_staff_dismantle_qty: "3",
    aux_machinery_requirements: [
      { machineType: "carretilla_elevadora", quantity: 1 },
      { machine_type: "carretilla_elevadora", quantity: 2 },
      { machineType: "invalid", quantity: 9 },
    ],
    print_excluded_sections: ["weather", "unknown", "weather"],
    restaurants_info: {
      restaurants: [{ id: "restaurant-1", name: "Bar Test", isSelected: true }],
      selectedRestaurants: ["restaurant-1"],
    },
  },
  logistics: {
    loading_details: "Carga norte",
    unloading_details: "Descarga sur",
    equipment_logistics: "Carretilla",
  },
  contacts: [{
    id: CONTACT_ID,
    name: "Produccion",
    role: "Promotor",
    phone: "+34123456789",
    email: "prod@example.com",
  }],
  staff: [{
    id: STAFF_ID,
    name: "Ana",
    surname1: "Tecnica",
    position: "SND-PA",
    dni: "12345678Z",
  }],
  transport: [{
    id: TRANSPORT_ID,
    transport_type: "sleeper_bus",
    date_time: "2032-02-01T09:00:00Z",
    return_date_time: "2032-02-02T20:00:00Z",
    is_hoja_relevant: true,
    logistics_categories: ["staff"],
  }],
  travelArrangements: [{
    id: TRAVEL_ID,
    transportation_type: "RV",
    pickup_time: "2032-02-01T08:00:00Z",
  }],
  accommodations: [{
    id: ACCOMMODATION_ID,
    hotel_name: "Hotel Test",
    address: "Madrid",
    check_in: "2032-02-01T14:00:00Z",
    check_out: "2032-02-02T10:00:00Z",
    latitude: 40.4,
    longitude: -3.7,
    rooms: [{
      id: ROOM_ID,
      room_type: "single",
      room_number: "101",
      staff_member1_hoja_staff_id: STAFF_ID,
    }],
  }],
  images: [{
    id: IMAGE_ID,
    image_path: `${JOB_ID}/venue/test.jpg`,
    image_type: "venue",
    sort_order: 0,
  }],
};

describe("Hoja document contracts", () => {
  it("maps an aggregate and builds a save payload without losing stable identity", () => {
    const document = mapHojaAggregateToDocument(JOB_ID, aggregateFixture);

    expect(document.document_version).toBe(4);
    expect(document.eventData.contacts[0]?.id).toBe(CONTACT_ID);
    expect(document.eventData.staff[0]?.id).toBe(STAFF_ID);
    expect(document.eventData.logistics.transport[0]?.date_time).toBe("2032-02-01T10:00");
    expect(document.travelArrangements[0]?.transportation_type).toBe("rv");
    expect(document.accommodations[0]?.rooms[0]?.staff_member1_id).toBe(STAFF_ID);
    expect(document.eventData.printExcludedSections).toEqual(["weather"]);

    const payload = buildHojaSavePayload({
      eventData: document.eventData,
      travelArrangements: document.travelArrangements,
      accommodations: document.accommodations,
      images: document.images,
      expectedVersion: document.document_version || 0,
    });
    const eventData = payload.eventData as Record<string, unknown>;
    const logistics = eventData.logistics as Record<string, unknown>;
    const transport = logistics.transport as Array<Record<string, unknown>>;
    const travel = payload.travelArrangements as Array<Record<string, unknown>>;
    const accommodations = payload.accommodations as Array<Record<string, unknown>>;
    const rooms = accommodations[0]?.rooms as Array<Record<string, unknown>>;

    expect((eventData.contacts as Array<Record<string, unknown>>)[0]?.id).toBe(CONTACT_ID);
    expect((eventData.staff as Array<Record<string, unknown>>)[0]?.id).toBe(STAFF_ID);
    expect(transport[0]).toMatchObject({
      id: TRANSPORT_ID,
      date_time: "2032-02-01T09:00:00.000Z",
      sort_order: 0,
    });
    expect(travel[0]).toMatchObject({
      id: TRAVEL_ID,
      transportation_type: "rv",
      pickup_time: "2032-02-01T08:00:00.000Z",
      sort_order: 0,
    });
    expect(accommodations[0]).toMatchObject({
      id: ACCOMMODATION_ID,
      latitude: 40.4,
      longitude: -3.7,
      sort_order: 0,
    });
    expect(rooms[0]).toMatchObject({
      id: ROOM_ID,
      staff_member1_hoja_staff_id: STAFF_ID,
      sort_order: 0,
    });
    expect(payload.images).toEqual(aggregateFixture.images);
  });

  it("normalizes quantities, machinery, and exclusions in the save payload", () => {
    const document = mapHojaAggregateToDocument(JOB_ID, aggregateFixture);
    const payload = buildHojaSavePayload({
      eventData: document.eventData,
      travelArrangements: [],
      accommodations: [],
      images: [],
      expectedVersion: 4,
    });
    const eventData = payload.eventData as Record<string, unknown>;

    expect(eventData.auxiliaryStaffSetupQty).toBe(0);
    expect(eventData.auxiliaryStaffDismantleQty).toBe(3);
    expect(eventData.auxiliaryMachinery).toEqual([
      { machineType: "carretilla_elevadora", quantity: 2 },
    ]);
    expect(eventData.printExcludedSections).toEqual(["weather"]);
  });

  it("does not reinterpret legacy room references as Hoja staff UUIDs", () => {
    const document = mapHojaAggregateToDocument(JOB_ID, {
      ...aggregateFixture,
      accommodations: [{
        ...aggregateFixture.accommodations![0],
        rooms: [{
          id: ROOM_ID,
          room_type: "single",
          room_number: "101",
          staff_member1_id: "legacy-index-0",
          staff_member2_id: "legacy-index-1",
        }],
      }],
    });

    expect(document.accommodations[0]?.rooms[0]).toMatchObject({
      staff_member1_id: "",
      staff_member2_id: "",
    });
  });

  it("produces the same dirty snapshot regardless of object key insertion order", () => {
    const eventA: EventData = {
      eventName: "Evento",
      eventDates: "1 febrero",
      venue: { name: "Sala", address: "Madrid" },
      contacts: [{ id: CONTACT_ID, name: "Ana", role: "Produccion" }],
      staff: [],
      logistics: { transport: [], loadingDetails: "Carga" },
    };
    const eventB: EventData = {
      logistics: { loadingDetails: "Carga", transport: [] },
      staff: [],
      contacts: [{ role: "Produccion", name: "Ana", id: CONTACT_ID }],
      venue: { address: "Madrid", name: "Sala" },
      eventDates: "1 febrero",
      eventName: "Evento",
    };

    expect(createHojaDocumentSnapshot(eventA, [], [])).toBe(
      createHojaDocumentSnapshot(eventB, [], []),
    );
  });

  it("changes the dirty snapshot when a nested persisted value changes", () => {
    const eventData = mapHojaAggregateToDocument(JOB_ID, aggregateFixture).eventData;
    const initial = createHojaDocumentSnapshot(eventData, [], []);
    const changed = createHojaDocumentSnapshot({
      ...eventData,
      venue: { ...eventData.venue, address: "Barcelona" },
    }, [], []);

    expect(changed).not.toBe(initial);
  });

  it("registers every section and print part exactly once", () => {
    const definitionIds = HOJA_SECTION_DEFINITIONS.map((section) => section.id);
    const registryIds = HOJA_SECTION_REGISTRY.map((section) => section.id);
    const definedPrintParts = HOJA_PRINT_PART_DEFINITIONS.map((part) => part.id).sort();
    const registeredPrintParts = HOJA_SECTION_REGISTRY
      .flatMap((section) => section.printParts)
      .sort();

    expect(registryIds).toEqual(definitionIds);
    expect(new Set(registryIds).size).toBe(registryIds.length);
    expect(registeredPrintParts).toEqual(definedPrintParts);
    expect(new Set(registeredPrintParts).size).toBe(registeredPrintParts.length);
  });
});
