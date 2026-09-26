import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/react-query";
import type {
  Accommodation,
  AuxiliaryMachineryRequirement,
  EventData,
  HojaDeRutaImageRecord,
  ProgramDay,
  Restaurant,
  Transport,
  TravelArrangement,
  WeatherData,
} from "@/types/hoja-de-ruta";
import { isAuxiliaryMachineryType } from "@/constants/hojaDeRutaAuxiliaryNeeds";
import { normalizeHojaDeRutaPrintSections } from "@/utils/hoja-de-ruta/pdf/section-options";

const MADRID_TIMEZONE = "Europe/Madrid";
const PARTIAL_ISO_NO_TZ_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
const ISO_WITH_TZ_REGEX = /([zZ]|[+-]\d{2}:\d{2})$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const toDateTimeLocalInMadrid = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim()) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatInTimeZone(date, MADRID_TIMEZONE, "yyyy-MM-dd'T'HH:mm");
};

const toSafeTimestamptz = (value: string | null | undefined): string | null => {
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

const toSafeNonNegativeInt = (value: unknown): number => {
  const parsed = Number.parseInt(String(value ?? 0), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const normalizeAuxiliaryMachinery = (value: unknown): AuxiliaryMachineryRequirement[] => {
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

const normalizeTravelTransportationType = (value: unknown): string => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "van";
  if (raw === "RV" || raw === "rv") return "rv";
  if (raw === "bus") return "autobus";
  return raw;
};

const stableProgramIds = (days: unknown): ProgramDay[] | undefined => {
  if (!Array.isArray(days)) return undefined;
  return days.map((rawDay, dayIndex) => {
    const day = isRecord(rawDay) ? rawDay : {};
    const rows = Array.isArray(day.rows) ? day.rows : [];
    return {
      ...(day as unknown as ProgramDay),
      rows: rows.map((rawRow, rowIndex) => {
        const row = isRecord(rawRow) ? rawRow : {};
        return {
          ...row,
          id: typeof row.id === "string" && row.id
            ? row.id
            : `legacy-${dayIndex}-${rowIndex}`,
        };
      }) as ProgramDay["rows"],
    };
  });
};

const parseRestaurantInfo = (value: unknown): {
  restaurants?: Restaurant[];
  selectedRestaurants?: string[];
} => {
  if (!isRecord(value)) return {};
  return {
    restaurants: Array.isArray(value.restaurants) ? value.restaurants as unknown as Restaurant[] : undefined,
    selectedRestaurants: Array.isArray(value.selectedRestaurants)
      ? value.selectedRestaurants.filter((item): item is string => typeof item === "string")
      : undefined,
  };
};

type Aggregate = {
  main: Record<string, unknown>;
  logistics?: Record<string, unknown>;
  contacts?: Record<string, unknown>[];
  staff?: Record<string, unknown>[];
  transport?: Record<string, unknown>[];
  travelArrangements?: Record<string, unknown>[];
  accommodations?: Array<Record<string, unknown> & { rooms?: Record<string, unknown>[] }>;
  images?: Record<string, unknown>[];
};

export type SaveHojaPayload = {
  eventData: EventData;
  travelArrangements: TravelArrangement[];
  accommodations: Accommodation[];
  images: HojaDeRutaImageRecord[];
  expectedVersion: number;
};

interface SaveCallbacks {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
  onSettled?: () => void;
}

export const useHojaDeRutaPersistence = (
  jobId: string,
  callbacks: SaveCallbacks = {},
) => {
  const queryClient = useQueryClient();
  const { onSuccess, onError, onSettled } = callbacks;
  const queryKey = queryKeys.scope("hoja-de-ruta", jobId);

  const {
    data: hojaDeRuta,
    isLoading,
    isFetching,
    error: fetchError,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!jobId) return null;

      const { data, error } = await supabase.rpc("get_hoja_de_ruta", {
        p_job_id: jobId,
      });
      if (error) throw error;
      if (!data) return null;

      const aggregate = data as unknown as Aggregate;
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
          technician_id: typeof staff.technician_id === "string" ? staff.technician_id : undefined,
        })),
        schedule: String(main.schedule || ""),
        programScheduleDays: stableProgramIds(main.program_schedule_json),
        powerRequirements: String(main.power_requirements || ""),
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
              : String(room.staff_member1_id || ""),
          staff_member2_id:
            typeof room.staff_member2_hoja_staff_id === "string"
              ? room.staff_member2_hoja_staff_id
              : String(room.staff_member2_id || ""),
        })),
      }));

      const images: HojaDeRutaImageRecord[] = (aggregate.images || []).map((image) => ({
        id: typeof image.id === "string" ? image.id : crypto.randomUUID(),
        image_path: String(image.image_path || ""),
        image_type: String(image.image_type || "venue"),
        sort_order: Number(image.sort_order || 0),
      }));

      return {
        ...main,
        id: String(main.id || ""),
        document_version: Number(main.document_version || 0),
        eventData,
        travelArrangements,
        accommodations,
        images,
      };
    },
    enabled: Boolean(jobId),
    staleTime: 60_000,
    retry: 1,
  });

  const saveAll = useMutation({
    mutationFn: async ({
      eventData,
      travelArrangements,
      accommodations,
      images,
      expectedVersion,
    }: SaveHojaPayload) => {
      if (!jobId) throw new Error("No hay un trabajo seleccionado");

      const payload = {
        eventData: {
          ...eventData,
          contacts: (eventData.contacts || []).map((contact, sortOrder) => ({
            ...contact,
            id: contact.id || crypto.randomUUID(),
            sort_order: sortOrder,
          })),
          staff: (eventData.staff || []).map((staff, sortOrder) => ({
            ...staff,
            id: staff.id || crypto.randomUUID(),
            sort_order: sortOrder,
          })),
          logistics: {
            ...eventData.logistics,
            transport: (eventData.logistics?.transport || []).map((transport, sortOrder) => ({
              ...transport,
              id: transport.id || crypto.randomUUID(),
              date_time: toSafeTimestamptz(transport.date_time),
              return_date_time: toSafeTimestamptz(transport.return_date_time),
              sort_order: sortOrder,
            })),
          },
          auxiliaryStaffSetupQty: toSafeNonNegativeInt(eventData.auxiliaryStaffSetupQty),
          auxiliaryStaffDismantleQty: toSafeNonNegativeInt(eventData.auxiliaryStaffDismantleQty),
          auxiliaryMachinery: normalizeAuxiliaryMachinery(eventData.auxiliaryMachinery),
          printExcludedSections: normalizeHojaDeRutaPrintSections(eventData.printExcludedSections),
        },
        travelArrangements: travelArrangements.map((travel, sortOrder) => ({
          ...travel,
          id: travel.id || crypto.randomUUID(),
          transportation_type: normalizeTravelTransportationType(travel.transportation_type),
          pickup_time: toSafeTimestamptz(travel.pickup_time),
          departure_time: toSafeTimestamptz(travel.departure_time),
          arrival_time: toSafeTimestamptz(travel.arrival_time),
          sort_order: sortOrder,
        })),
        accommodations: accommodations.map((accommodation, sortOrder) => ({
          ...accommodation,
          id: accommodation.id || crypto.randomUUID(),
          latitude: accommodation.coordinates?.lat ?? null,
          longitude: accommodation.coordinates?.lng ?? null,
          coordinates: undefined,
          check_in: toSafeTimestamptz(accommodation.check_in),
          check_out: toSafeTimestamptz(accommodation.check_out),
          sort_order: sortOrder,
          rooms: (accommodation.rooms || []).map((room, roomOrder) => ({
            id: room.id || crypto.randomUUID(),
            room_type: room.room_type || "single",
            room_number: room.room_number || "",
            staff_member1_hoja_staff_id: room.staff_member1_id || null,
            staff_member2_hoja_staff_id: room.staff_member2_id || null,
            sort_order: roomOrder,
          })),
        })),
        images,
      } satisfies Record<string, unknown>;

      const { data, error } = await supabase.rpc("save_hoja_de_ruta", {
        p_job_id: jobId,
        p_expected_version: expectedVersion,
        p_payload: payload as unknown as Json,
      });

      if (error) throw error;
      const saved = data?.[0];
      if (!saved) throw new Error("El servidor no devolvió la Hoja de Ruta guardada");
      return saved;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKey, (current: typeof hojaDeRuta) => current
        ? { ...current, document_version: saved.document_version }
        : current);
      void queryClient.invalidateQueries({ queryKey });
      onSuccess?.();
    },
    onError,
    onSettled,
  });

  const forceRefetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
    return refetch();
  }, [queryClient, queryKey, refetch]);

  return {
    hojaDeRuta,
    isLoading,
    isFetching,
    fetchError,
    saveAll: saveAll.mutateAsync,
    isSaving: saveAll.isPending,
    forceRefetch,
  };
};
