import { ESTRUCTURA_DEPARTMENT } from "@/domain/estructura";
import { supabase } from "@/integrations/supabase/client";
import { createFlexFolder } from "@/utils/flex-folders/api";
import {
  DEPARTMENT_IDS,
  DEPARTMENT_SUFFIXES,
  FLEX_FOLDER_IDS,
} from "@/utils/flex-folders/constants";

interface TourEstructuraRecord {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  flex_main_folder_id: string | null;
  flex_estructura_folder_id: string | null;
  tour_dates: Array<{ date: string }> | null;
}

export interface TourEstructuraRoot {
  elementId: string;
  trackingId: string;
}

const toFlexDate = (value: string): string =>
  `${new Date(value).toISOString().split(".")[0]}.000Z`;

const resolveTourRange = (tour: TourEstructuraRecord) => {
  const tourDates = (tour.tour_dates ?? [])
    .map(({ date }) => date)
    .filter(Boolean)
    .sort();
  const startDate = tour.start_date ?? tourDates[0];
  const endDate = tour.end_date ?? tourDates.at(-1);

  if (!startDate || !endDate) {
    throw new Error("La gira no tiene fechas válidas para crear la carpeta Estructura.");
  }

  return {
    documentNumber: new Date(startDate).toISOString().slice(2, 10).replace(/-/g, ""),
    plannedEndDate: toFlexDate(endDate),
    plannedStartDate: toFlexDate(startDate),
  };
};

const findTrackingByElement = async (elementId: string) => {
  const { data, error } = await supabase
    .from("flex_folders")
    .select("id, element_id")
    .eq("element_id", elementId)
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
};

const findTrackingByParent = async (parentElementId: string) => {
  const { data, error } = await supabase
    .from("flex_folders")
    .select("id, element_id")
    .eq("parent_id", parentElementId)
    .eq("department", ESTRUCTURA_DEPARTMENT)
    .eq("folder_type", "tour_department")
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
};

const persistTourRoot = async (tourId: string, elementId: string) => {
  const { data, error } = await supabase
    .from("tours")
    .update({ flex_estructura_folder_id: elementId })
    .eq("id", tourId)
    .select("flex_estructura_folder_id")
    .single();

  if (error || data?.flex_estructura_folder_id !== elementId) {
    throw new Error(
      `No se pudo guardar la carpeta Estructura en la gira: ${error?.message ?? "la actualización no fue confirmada"}.`,
    );
  }
};

const ensureTracking = async (tour: TourEstructuraRecord, elementId: string) => {
  const existing = await findTrackingByElement(elementId);
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("flex_folders")
    .insert({
      job_id: null,
      parent_id: tour.flex_main_folder_id,
      element_id: elementId,
      department: ESTRUCTURA_DEPARTMENT,
      folder_type: "tour_department",
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(
      `Se creó la carpeta Estructura, pero no se pudo registrar: ${error?.message ?? "sin fila devuelta"}.`,
    );
  }
  return data.id;
};

/**
 * Reconciles the tour-level Estructura root from client workflows.
 *
 * The tracking lookup makes retries safe when an earlier attempt persisted only
 * part of the local state. Callers receive both Flex and local tracking IDs and
 * must not continue until both have been confirmed.
 */
export async function ensureTourEstructuraRoot(tourId: string): Promise<TourEstructuraRoot> {
  const { data, error } = await supabase
    .from("tours")
    .select(`
      id,
      name,
      start_date,
      end_date,
      flex_main_folder_id,
      flex_estructura_folder_id,
      tour_dates (date)
    `)
    .eq("id", tourId)
    .single();
  if (error || !data) {
    throw new Error(`No se pudo cargar la gira para reconciliar Estructura: ${error?.message ?? "gira no encontrada"}.`);
  }

  const tour = data as TourEstructuraRecord;
  if (!tour.flex_main_folder_id) {
    throw new Error("La gira no tiene una carpeta raíz de Flex.");
  }

  if (tour.flex_estructura_folder_id) {
    return {
      elementId: tour.flex_estructura_folder_id,
      trackingId: await ensureTracking(tour, tour.flex_estructura_folder_id),
    };
  }

  const trackedRoot = await findTrackingByParent(tour.flex_main_folder_id);
  if (trackedRoot) {
    await persistTourRoot(tour.id, trackedRoot.element_id);
    return { elementId: trackedRoot.element_id, trackingId: trackedRoot.id };
  }

  const range = resolveTourRange(tour);
  const created = await createFlexFolder({
    definitionId: FLEX_FOLDER_IDS.subFolder,
    parentElementId: tour.flex_main_folder_id,
    open: true,
    locked: false,
    name: `${tour.name} - Estructura`,
    plannedStartDate: range.plannedStartDate,
    plannedEndDate: range.plannedEndDate,
    locationId: FLEX_FOLDER_IDS.location,
    departmentId: DEPARTMENT_IDS.estructura,
    documentNumber: `${range.documentNumber}${DEPARTMENT_SUFFIXES.estructura}`,
    personResponsibleId: FLEX_FOLDER_IDS.mainResponsible,
  });

  await persistTourRoot(tour.id, created.elementId);
  return {
    elementId: created.elementId,
    trackingId: await ensureTracking(tour, created.elementId),
  };
}
