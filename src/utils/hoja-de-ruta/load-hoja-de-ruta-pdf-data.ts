import { formatInTimeZone } from 'date-fns-tz';

import { supabase } from '@/integrations/supabase/client';
import type { EventData, Transport } from '@/types/hoja-de-ruta';

const MADRID_TIMEZONE = 'Europe/Madrid';

const toDateTimeLocalInMadrid = (value: string | null | undefined): string => {
  if (!value || !value.trim()) return '';

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return formatInTimeZone(date, MADRID_TIMEZONE, "yyyy-MM-dd'T'HH:mm");
  } catch {
    return '';
  }
};

const normalizeTransportType = (value: string | null | undefined): Transport['transport_type'] => {
  const normalized = (value || '').trim().toLowerCase();

  if (normalized === 'trailer' || normalized === '9m' || normalized === '8m' || normalized === '6m' || normalized === '4m' || normalized === 'furgoneta') {
    return normalized;
  }

  return 'furgoneta';
};

const toCoordinate = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

export interface HojaDeRutaPdfData {
  eventData: EventData;
  venueMapPreview: string | null;
}

export const loadHojaDeRutaPdfData = async (jobId: string): Promise<HojaDeRutaPdfData | null> => {
  if (!jobId) return null;

  const { data: mainData, error: mainError } = await supabase
    .from('hoja_de_ruta')
    .select('id,event_name,event_dates,venue_name,venue_address,venue_latitude,venue_longitude,schedule')
    .eq('job_id', jobId)
    .maybeSingle();

  if (mainError) throw mainError;
  if (!mainData) return null;

  const [
    { data: contacts, error: contactsError },
    { data: transportRows, error: transportError },
    { data: images, error: imagesError },
    { data: jobRow, error: jobError },
  ] = await Promise.all([
    supabase.from('hoja_de_ruta_contacts').select('name,role,phone').eq('hoja_de_ruta_id', mainData.id),
    supabase
      .from('hoja_de_ruta_transport')
      .select('id,transport_type,driver_name,driver_phone,license_plate,company,date_time,has_return,return_date_time,source_logistics_event_id,is_hoja_relevant,logistics_categories')
      .eq('hoja_de_ruta_id', mainData.id),
    supabase.from('hoja_de_ruta_images').select('image_path,image_type').eq('hoja_de_ruta_id', mainData.id),
    supabase.from('jobs').select('location_id').eq('id', jobId).maybeSingle(),
  ]);

  if (contactsError) throw contactsError;
  if (transportError) throw transportError;
  if (imagesError) throw imagesError;
  if (jobError) throw jobError;

  let venueFromJob:
    | {
        name?: string;
        address?: string;
        coordinates?: { lat: number; lng: number };
      }
    | undefined;

  if (jobRow?.location_id) {
    const { data: locationData, error: locationError } = await supabase
      .from('locations')
      .select('name,formatted_address,latitude,longitude')
      .eq('id', jobRow.location_id)
      .maybeSingle();

    if (locationError) throw locationError;

    if (locationData) {
      const lat = toCoordinate(locationData.latitude);
      const lng = toCoordinate(locationData.longitude);

      venueFromJob = {
        name: locationData.name || undefined,
        address: locationData.formatted_address || locationData.name || undefined,
        coordinates: lat !== undefined && lng !== undefined ? { lat, lng } : undefined,
      };
    }
  }

  const venueLat = toCoordinate(mainData.venue_latitude);
  const venueLng = toCoordinate(mainData.venue_longitude);
  const mappedVenue = venueFromJob || {
    name: mainData.venue_name || '',
    address: mainData.venue_address || '',
    coordinates: venueLat !== undefined && venueLng !== undefined ? { lat: venueLat, lng: venueLng } : undefined,
  };

  const mappedContacts = (contacts || []).map((contact) => ({
    name: contact.name || '',
    role: contact.role || '',
    phone: contact.phone || '',
  }));

  const mappedTransport: Transport[] = (transportRows || []).map((row) => ({
    id: row.id,
    transport_type: normalizeTransportType(row.transport_type),
    driver_name: row.driver_name || '',
    driver_phone: row.driver_phone || '',
    license_plate: row.license_plate || '',
    company: (row.company || undefined) as Transport['company'] | undefined,
    date_time: toDateTimeLocalInMadrid(row.date_time),
    has_return: Boolean(row.has_return),
    return_date_time: toDateTimeLocalInMadrid(row.return_date_time),
    source_logistics_event_id: row.source_logistics_event_id || undefined,
    is_hoja_relevant: row.is_hoja_relevant ?? true,
    logistics_categories: Array.isArray(row.logistics_categories) ? row.logistics_categories : [],
  }));

  const venueMapPreview =
    (images || []).find((image) => image.image_type === 'venue_map' && typeof image.image_path === 'string' && image.image_path.startsWith('data:image/'))?.image_path || null;

  return {
    eventData: {
      eventName: mainData.event_name || '',
      eventDates: mainData.event_dates || '',
      venue: mappedVenue,
      contacts: mappedContacts,
      logistics: {
        transport: mappedTransport,
      },
      schedule: mainData.schedule || '',
    },
    venueMapPreview,
  };
};
