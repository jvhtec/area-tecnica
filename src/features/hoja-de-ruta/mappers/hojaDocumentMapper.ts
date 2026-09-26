import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { isAuxiliaryMachineryType } from "@/constants/hojaDeRutaAuxiliaryNeeds";
import type {
  HojaAggregate,
  HojaDocument,
  HojaDocumentSaveInput,
} from "@/features/hoja-de-ruta/model/HojaDocument";
import type {
  Accommodation,
  AuxiliaryMachineryRequirement,
  EventData,
  Restaurant,
  Transport,
  TravelArrangement,
  WeatherData,
} from "@/types/hoja-de-ruta";
import { normalizeHojaDeRutaPrintSections } from "@/utils/hoja-de-ruta/pdf/section-options";

const MADRID_TIMEZONE = "Europe/Madrid";
const PARTIAL_ISO_NO_TZ_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
const ISO_WITH_TZ_REGEX = /([zZ]|[+-]\d{2}:\d{2})$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

export const toDateTimeLocalInMadrid = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim()) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatInTimeZone(date, MADRID_TIMEZONE, "yyyy-MM-dd'T'HH:mm");
};

export const toSafeTimestamptz = (
  value: string | null | undefined,
): string | null => {
  if (!value?.trim()) return null;
  const raw = value.trim();
  const normalized = PARTIAL_ISO_NO_TZ_REGEX.test(raw)
    ? (raw.length === 16 ? `${raw}:00` : raw)
    : raw;
  const date = ISO_WITH_TZ_REGEX.test(normalized)
    ? new Date(normalized)
    : fromZonedTime(normalized, MADRID_TIMEZONE);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const toSafeNonNegativeInt = (value: unknown): number => {
  const parsed = Number.parseInt(String(value ?? 0), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export const normalizeAuxiliaryMachinery = (
  value: unknown,
): AuxiliaryMachineryRequirement[] => {
  if (!Array.isArray(value)) return [];
  const deduped = new Map<AuxiliaryMachineryRequirement["machineType"], number>();
  value.forEach((item) => {
    if (!isRecord(item)) return;
    const rawType = item.machineType ?? item.machine_type;
    if (!isAuxiliaryMachineryType(rawType)) return;
    const quantity = toSafeNonNegativeInt(item.quantity);
    if (quantity > 0) deduped.set(rawType, quantity);
  });
  return Array.from(deduped, ([machineType, quantity]) => ({ machineType, quantity }));
};

export const normalizeTravelTransportationType = (value: unknown): string => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "van";
  if (raw === "RV" || raw === "rv") return "rv";
  if (raw === "bus") return "autobus";
  return raw;
};

const parseRestaurantInfo = (value: unknown): {
  restaurants?: Restaurant[];
  selectedRestaurants?: string[];
} => {
  if (!isRecord(value)) return {};
  return {
    restaurants: Array.isArray(value.restaurants)
      ? value.restaurants as unknown as Restaurant[]
      : undefined,
    selectedRestaurants: Array.isArray(value.selectedRestaurants)
      ? value.selectedRestaurants.filter((item): item is string => typeof item === "string")
      : undefined,
  };
};

export function mapHojaAggregateToDocument(
  jobId: string,
  aggregate: HojaAggregate,
): HojaDocument {
  const main = aggregate.main || {};
  const logistics = aggregate.logistics || {};
  const restaurants = parseRestaurantInfo(main.restaurants_info);

  const eventData: EventData = {
    eventName: String(main.event_name || ""),
    eventDates: String(main.event_dates || ""),
    eventStartDate: typeof main.event_start_date === "string" ? main.event_start_date : undefined,
    eventEndDate: typeof main.event_end_date === "string" ? main.event_end_date : undefined,
    venue: {
      name: String(main.venue_name || ""),
      address: String(main.venue_address || ""),
      coordinates:
        main.venue_latitude != null && main.venue_longitude != null
          ? { lat: Number(main.venue_latitude), lng: Number(main.venue_longitude) }
          : undefined,
    },
    contacts: (aggregate.contacts?.length ? aggregate.contacts : [{}]).map((contact) => ({
      id: typeof contact.id === "string" ? contact.id : crypto.randomUUID(),
      name: String(contact.name || ""),
      role: String(contact.role || ""),
      phone: String(contact.phone || ""),
      email: String(contact.email || ""),
      technician_id: typeof contact.technician_id === "string" ? contact.technician_id : undefined,
    })),
    logistics: {
      transport: (aggregate.transport || []).map((transport) => ({
        id: typeof transport.id === "string" ? transport.id : crypto.randomUUID(),
        transport_type: transport.transport_type as Transport["transport_type"],
        driver_name: typeof transport.driver_name === "string" ? transport.driver_name : undefined,
        driver_phone: typeof transport.driver_phone === "string" ? transport.driver_phone : undefined,
        license_plate: typeof transport.license_plate === "string" ? transport.license_plate : undefined,
        company: transport.company as Transport["company"],
        date_time: toDateTimeLocalInMadrid(transport.date_time),
        has_return: Boolean(transport.has_return),
        return_date_time: toDateTimeLocalInMadrid(transport.return_date_time),
        source_logistics_event_id:
          typeof transport.source_logistics_event_id === "string"
            ? transport.source_logistics_event_id
            : undefined,
        source_logistics_updated_at:
          typeof transport.source_logistics_updated_at === "string"
            ? transport.source_logistics_updated_at
            : undefined,
        origin: typeof transport.origin === "string" ? transport.origin : undefined,
        destination: typeof transport.destination === "string" ? transport.destination : undefined,
        is_hoja_relevant: transport.is_hoja_relevant !== false,
        logistics_categories: Array.isArray(transport.logistics_categories)
          ? transport.logistics_categories as Transport["logistics_categories"]
          : [],
      })),
      loadingDetails: String(logistics.loading_details || ""),
      unloadingDetails: String(logistics.unloading_details || ""),
      equipmentLogistics: String(logistics.equipment_logistics || ""),
    },
    staff: (aggregate.staff?.length ? aggregate.staff : [{}]).map((staff) => ({
      id: typeof staff.id === "string" ? staff.id : crypto.randomUUID(),
      name: String(staff.name || ""),
      surname1: String(staff.surname1 || ""),
      surname2: String(staff.surname2 || ""),
      position: String(staff.position || ""),
      dni: String(staff.dni || ""),
      department: String(staff.department || ""),
      technician_id: typeof staff.technician_id === "string" ? staff.technician_id : undefined,
    })),
    schedule: String(main.schedule || ""),
    programScheduleDays: Array.isArray(main.program_schedule_json)
      ? main.program_schedule_json as unknown as EventData["programScheduleDays"]
      : undefined,
    powerRequirements: String(main.power_requirements || ""),
    powerRequirementsSourceUpdatedAt:
      typeof main.power_requirements_source_updated_at === "string"
        ? main.power_requirements_source_updated_at
        : undefined,
    auxiliaryNeeds: String(main.auxiliary_needs || ""),
    auxiliaryStaffSetupQty: toSafeNonNegativeInt(main.aux_staff_setup_qty),
    auxiliaryStaffDismantleQty: toSafeNonNegativeInt(main.aux_staff_dismantle_qty),
    auxiliaryMachinery: normalizeAuxiliaryMachinery(main.aux_machinery_requirements),
    weather: Array.isArray(main.weather_data)
      ? main.weather_data as unknown as WeatherData[]
      : undefined,
    weatherFetchedAt:
      typeof main.weather_fetched_at === "string" ? main.weather_fetched_at : undefined,
    restaurants: restaurants.restaurants,
    selectedRestaurants: restaurants.selectedRestaurants,
    printExcludedSections: normalizeHojaDeRutaPrintSections(main.print_excluded_sections),
  };

  const travelArrangements: TravelArrangement[] = (aggregate.travelArrangements || []).map((travel) => ({
    id: typeof travel.id === "string" ? travel.id : crypto.randomUUID(),
    transportation_type: normalizeTravelTransportationType(travel.transportation_type),
    pickup_address: String(travel.pickup_address || ""),
    pickup_time: toDateTimeLocalInMadrid(travel.pickup_time),
    flight_train_number: String(travel.flight_train_number || ""),
    departure_time: toDateTimeLocalInMadrid(travel.departure_time),
    arrival_time: toDateTimeLocalInMadrid(travel.arrival_time),
    driver_name: String(travel.driver_name || ""),
    driver_phone: String(travel.driver_phone || ""),
    plate_number: String(travel.plate_number || ""),
    notes: String(travel.notes || ""),
  }));

  const accommodations: Accommodation[] = (aggregate.accommodations || []).map((accommodation) => ({
    id: typeof accommodation.id === "string" ? accommodation.id : crypto.randomUUID(),
    hotel_name: String(accommodation.hotel_name || ""),
    address: String(accommodation.address || ""),
    check_in: toDateTimeLocalInMadrid(accommodation.check_in),
    check_out: toDateTimeLocalInMadrid(accommodation.check_out),
    coordinates:
      accommodation.latitude != null && accommodation.longitude != null
        ? { lat: Number(accommodation.latitude), lng: Number(accommodation.longitude) }
        : undefined,
    rooms: asArray(accommodation.rooms).map((room) => ({
      id: typeof room.id === "string" ? room.id : crypto.randomUUID(),
      room_type: String(room.room_type || "single"),
      room_number: String(room.room_number || ""),
      staff_member1_id:
        typeof room.staff_member1_hoja_staff_id === "string"
          ? room.staff_member1_hoja_staff_id
          : "",
      staff_member2_id:
        typeof room.staff_member2_hoja_staff_id === "string"
          ? room.staff_member2_hoja_staff_id
          : "",
    })),
  }));

  return {
    id: String(main.id || ""),
    jobId,
    document_version: Number(main.document_version || 0),
    created_by: typeof main.created_by === "string" ? main.created_by : undefined,
    approved_by: typeof main.approved_by === "string" ? main.approved_by : undefined,
    status:
      main.status === "review" || main.status === "approved" || main.status === "final"
        ? main.status
        : "draft",
    approved_at: typeof main.approved_at === "string" ? main.approved_at : undefined,
    created_at: typeof main.created_at === "string" ? main.created_at : undefined,
    updated_at: typeof main.updated_at === "string" ? main.updated_at : undefined,
    last_modified: typeof main.last_modified === "string" ? main.last_modified : undefined,
    last_modified_by:
      typeof main.last_modified_by === "string" ? main.last_modified_by : undefined,
    eventData,
    travelArrangements,
    accommodations,
    images: (aggregate.images || []).map((image) => ({
      id: typeof image.id === "string" ? image.id : crypto.randomUUID(),
      image_path: String(image.image_path || ""),
      image_type: String(image.image_type || "venue"),
      sort_order: Number(image.sort_order || 0),
    })),
  };
}

export function buildHojaSavePayload(input: HojaDocumentSaveInput): Record<string, unknown> {
  return {
    eventData: {
      ...input.eventData,
      contacts: input.eventData.contacts.map((contact, sortOrder) => ({
        ...contact,
        id: contact.id || crypto.randomUUID(),
        sort_order: sortOrder,
      })),
      staff: input.eventData.staff.map((staff, sortOrder) => ({
        ...staff,
        id: staff.id || crypto.randomUUID(),
        sort_order: sortOrder,
      })),
      logistics: {
        ...input.eventData.logistics,
        transport: input.eventData.logistics.transport.map((transport, sortOrder) => ({
          ...transport,
          id: transport.id || crypto.randomUUID(),
          date_time: toSafeTimestamptz(transport.date_time),
          return_date_time: toSafeTimestamptz(transport.return_date_time),
          sort_order: sortOrder,
        })),
      },
      auxiliaryStaffSetupQty: toSafeNonNegativeInt(input.eventData.auxiliaryStaffSetupQty),
      auxiliaryStaffDismantleQty: toSafeNonNegativeInt(input.eventData.auxiliaryStaffDismantleQty),
      auxiliaryMachinery: normalizeAuxiliaryMachinery(input.eventData.auxiliaryMachinery),
      printExcludedSections: normalizeHojaDeRutaPrintSections(input.eventData.printExcludedSections),
    },
    travelArrangements: input.travelArrangements.map((travel, sortOrder) => ({
      ...travel,
      id: travel.id || crypto.randomUUID(),
      transportation_type: normalizeTravelTransportationType(travel.transportation_type),
      pickup_time: toSafeTimestamptz(travel.pickup_time),
      departure_time: toSafeTimestamptz(travel.departure_time),
      arrival_time: toSafeTimestamptz(travel.arrival_time),
      sort_order: sortOrder,
    })),
    accommodations: input.accommodations.map((accommodation, sortOrder) => ({
      ...accommodation,
      id: accommodation.id || crypto.randomUUID(),
      latitude: accommodation.coordinates?.lat ?? null,
      longitude: accommodation.coordinates?.lng ?? null,
      coordinates: undefined,
      check_in: toSafeTimestamptz(accommodation.check_in),
      check_out: toSafeTimestamptz(accommodation.check_out),
      sort_order: sortOrder,
      rooms: accommodation.rooms.map((room, roomOrder) => ({
        id: room.id || crypto.randomUUID(),
        room_type: room.room_type || "single",
        room_number: room.room_number || "",
        staff_member1_hoja_staff_id: room.staff_member1_id || null,
        staff_member2_hoja_staff_id: room.staff_member2_id || null,
        sort_order: roomOrder,
      })),
    })),
    images: input.images,
    removedImageIds: input.removedImageIds || [],
  };
}
