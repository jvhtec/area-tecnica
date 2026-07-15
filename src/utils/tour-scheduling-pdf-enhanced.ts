import type jsPDF from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { fetchTourLogo } from '@/utils/pdf/logoUtils';
import { supabase } from '@/integrations/supabase/client';
import { getWeatherForJob } from '@/utils/weather/weatherApi';
import { createWeatherTableIconHooks } from '@/utils/pdf/weatherPdfIcons';
import type { AutoTableFn } from '@/utils/pdf/lazyPdf';
import {
  createPdfExportDocument,
  drawCorporatePdfHeader,
  drawGeneratedPdfFooter,
  getLastAutoTableY,
  loadCompanyLogoDataUrl,
  SECTOR_PRO_RED,
} from '@/utils/pdf/exportHelpers';
import { buildReadableFilename } from '@/utils/fileName';

const CORPORATE_RED = SECTOR_PRO_RED;

interface TourContact {
  name?: string | null;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  isPrimary?: boolean | null;
}

interface TourLocation {
  name?: string | null;
  formatted_address?: string | null;
  city?: string | null;
  state?: string | null;
}

interface TourData {
  id: string;
  name: string;
  tour_settings?: {
    homeBase?: {
      name?: string | null;
    } | null;
  } | null;
  tour_contacts?: TourContact[] | null;
}

interface TourDateData {
  id: string;
  date: string;
  call_time?: string | null;
  showtime?: string | null;
  location?: TourLocation | null;
}

interface TravelSegment {
  fromDateId?: string | null;
  fromType?: string | null;
  toDateId?: string | null;
  toType?: string | null;
  transportType?: string | null;
  departureTime?: string | null;
  arrivalTime?: string | null;
  distance?: number | null;
  duration?: number | null;
  notes?: string | null;
}

interface ProgramRow {
  time?: string | null;
  item?: string | null;
  dept?: string | null;
  notes?: string | null;
}

interface ProgramDay {
  label?: string | null;
  rows?: ProgramRow[];
}

interface CrewProfile {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
}

interface CrewAssignment {
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
  profiles?: CrewProfile | CrewProfile[] | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const asProgramDays = (value: unknown): ProgramDay[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((day): ProgramDay => ({
      label: typeof day.label === 'string' ? day.label : null,
      rows: Array.isArray(day.rows)
        ? day.rows.filter(isRecord).map((row): ProgramRow => ({
            time: typeof row.time === 'string' ? row.time : null,
            item: typeof row.item === 'string' ? row.item : null,
            dept: typeof row.dept === 'string' ? row.dept : null,
            notes: typeof row.notes === 'string' ? row.notes : null,
          }))
        : [],
    }));
};

const asCrewAssignments = (value: unknown): CrewAssignment[] => (Array.isArray(value) ? (value as CrewAssignment[]) : []);

/**
 * Add PDF header
 */
const addPDFHeader = (
  pdf: jsPDF,
  title: string,
  subtitle: string,
  tourLogoUrl?: string
) => {
  drawCorporatePdfHeader(pdf, {
    title,
    subtitle,
    logo: tourLogoUrl,
  });
};

/**
 * Add PDF footer
 */
const addPDFFooter = async (pdf: jsPDF, pageNum?: number) => {
  drawGeneratedPdfFooter(pdf, {
    pageNumber: pageNum,
    logo: await loadCompanyLogoDataUrl(),
  });
};

/**
 * Add tour contacts section
 */
const addTourContactsSection = (
  pdf: jsPDF,
  autoTable: AutoTableFn,
  tourContacts: TourContact[],
  startY: number
): number => {
  if (!tourContacts || tourContacts.length === 0) return startY;

  pdf.setFontSize(14);
  pdf.setFont(undefined, 'bold');
  pdf.setTextColor(...CORPORATE_RED);
  pdf.text('Contactos del Tour', 10, startY);
  pdf.setTextColor(0, 0, 0);
  startY += 8;

  const contactsData = tourContacts.map((contact) => {
    const details = [];
    if (contact.phone) details.push(`Tel: ${contact.phone}`);
    if (contact.email) details.push(`Email: ${contact.email}`);

    return [
      `${contact.name}${contact.isPrimary ? ' ⭐' : ''}`,
      contact.role,
      details.join('\n') || '-',
    ];
  });

  autoTable(pdf, {
    body: contactsData,
    startY: startY,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: CORPORATE_RED,
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 45 },
      2: { cellWidth: 'auto' },
    },
    margin: { left: 10, right: 10 },
  });

  return getLastAutoTableY(pdf, startY) + 10;
};

/**
 * Generate Travel Day Sheet (to or from venue)
 */
export const generateTravelDaySheet = async (
  tourData: TourData,
  travelSegment: TravelSegment,
  tourDate: TourDateData,
  direction: 'to' | 'from'
) => {
  const { pdf, autoTable } = await createPdfExportDocument();
  let currentY = 40;

  let tourLogoUrl: string | undefined;
  try {
    tourLogoUrl = await fetchTourLogo(tourData.id);
  } catch (error) {
    console.warn('Could not load tour logo:', error);
  }

  const dateStr = format(new Date(tourDate.date), "d 'de' MMMM 'de' yyyy", { locale: es });
  const title = direction === 'to' ? `Viaje HACIA el Venue` : `Viaje DESDE el Venue`;

  addPDFHeader(pdf, tourData.name, `${title} - ${dateStr}`, tourLogoUrl);

  pdf.setTextColor(0, 0, 0);

  // Travel Information Section
  pdf.setFontSize(14);
  pdf.setFont(undefined, 'bold');
  pdf.text('Información del Viaje', 10, currentY);
  currentY += 10;

  const homeBase = tourData?.tour_settings?.homeBase;
  const fromLocation = direction === 'to' ? homeBase?.name : tourDate.location?.name;
  const toLocation = direction === 'to' ? tourDate.location?.name : homeBase?.name;

  const travelInfo = [
    ['Fecha de Viaje', dateStr],
    ['Origen', fromLocation || 'Por confirmar'],
    ['Destino', toLocation || 'Por confirmar'],
    ['Tipo de Transporte', travelSegment?.transportType?.toUpperCase() || 'BUS'],
    ['Hora de Salida', travelSegment?.departureTime || 'Por confirmar'],
    ['Hora de Llegada Estimada', travelSegment?.arrivalTime || 'Por confirmar'],
    ['Distancia', `${travelSegment?.distance || 0} km`],
    ['Duración Estimada', `${Math.round((travelSegment?.duration || 0) / 60)} horas`],
  ];

  autoTable(pdf, {
    body: travelInfo,
    startY: currentY,
    theme: 'plain',
    styles: {
      fontSize: 10,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: 'bold', fillColor: [240, 240, 240] },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 10, right: 10 },
  });

  currentY = getLastAutoTableY(pdf, currentY) + 15;

  // Route Details
  if (direction === 'to') {
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(...CORPORATE_RED);
    pdf.text('Detalles del Destino', 10, currentY);
    pdf.setTextColor(0, 0, 0);
    currentY += 8;

    const venueInfo = [
      ['Venue', tourDate.location?.name || 'Por confirmar'],
      ['Dirección', tourDate.location?.formatted_address || 'Por confirmar'],
      ['Ciudad', `${tourDate.location?.city || ''}, ${tourDate.location?.state || ''}`],
      ['Call Time', tourDate.call_time || 'Por confirmar'],
    ];

    autoTable(pdf, {
      body: venueInfo,
      startY: currentY,
      theme: 'plain',
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
      },
      margin: { left: 10, right: 10 },
    });

    currentY = getLastAutoTableY(pdf, currentY) + 15;
  }

  // Tour Contacts
  if (tourData.tour_contacts && tourData.tour_contacts.length > 0) {
    currentY = addTourContactsSection(pdf, autoTable, tourData.tour_contacts, currentY);
  }

  // Load crew roster
  try {
    const jobQuery = await supabase
      .from('jobs')
      .select('id')
      .eq('tour_date_id', tourDate.id)
      .maybeSingle();

    if (jobQuery.data?.id) {
      const { data: assignments } = await supabase
        .from('job_assignments')
        .select(`
          *,
          profiles!job_assignments_technician_id_fkey (
            first_name,
            last_name,
            phone
          )
        `)
        .eq('job_id', jobQuery.data.id);

      if (assignments && assignments.length > 0) {
        if (currentY > 220) {
          pdf.addPage();
          addPDFHeader(pdf, tourData.name, `${title} (continuación)`, tourLogoUrl);
          currentY = 40;
        }

        pdf.setFontSize(14);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(...CORPORATE_RED);
        pdf.text('Roster de Crew', 10, currentY);
        pdf.setTextColor(0, 0, 0);
        currentY += 10;

        const crewData = asCrewAssignments(assignments).map((a) => {
          const profile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
          const roles = [];
          if (a.sound_role) roles.push(`Sound: ${a.sound_role}`);
          if (a.lights_role) roles.push(`Lights: ${a.lights_role}`);
          if (a.video_role) roles.push(`Video: ${a.video_role}`);

          return [
            `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
            roles.join(', ') || '-',
            profile?.phone || '-',
          ];
        });

        autoTable(pdf, {
          head: [['Nombre', 'Roles', 'Teléfono']],
          body: crewData,
          startY: currentY,
          theme: 'grid',
          styles: {
            fontSize: 9,
            cellPadding: 3,
          },
          headStyles: {
            fillColor: CORPORATE_RED,
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: 'bold',
          },
          columnStyles: {
            0: { cellWidth: 60 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 40 },
          },
          margin: { left: 10, right: 10 },
        });

        currentY = getLastAutoTableY(pdf, currentY) + 10;
      }
    }
  } catch (error) {
    console.error('Error loading crew data:', error);
  }

  // Notes
  if (travelSegment?.notes) {
    if (currentY > 250) {
      pdf.addPage();
      addPDFHeader(pdf, tourData.name, `${title} (continuación)`, tourLogoUrl);
      currentY = 40;
    }

    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(...CORPORATE_RED);
    pdf.text('Notas', 10, currentY);
    pdf.setTextColor(0, 0, 0);
    currentY += 8;

    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    const splitNotes = pdf.splitTextToSize(travelSegment.notes, 190);
    pdf.text(splitNotes, 10, currentY);
  }

  await addPDFFooter(pdf);

  const filename = buildReadableFilename([
    tourData.name,
    format(new Date(tourDate.date), 'yyyy-MM-dd'),
    'travel',
    direction,
  ]);
  pdf.save(filename);
};

/**
 * Generate Enhanced Event Day Sheet with hotels, rooming, and restaurants
 */
export const generateEnhancedEventDaySheet = async (
  tourData: TourData,
  tourDate: TourDateData
) => {
  const { pdf, autoTable } = await createPdfExportDocument();
  let currentY = 40;

  let tourLogoUrl: string | undefined;
  try {
    tourLogoUrl = await fetchTourLogo(tourData.id);
  } catch (error) {
    console.warn('Could not load tour logo:', error);
  }

  addPDFHeader(
    pdf,
    tourData.name,
    `Event Day Sheet - ${format(new Date(tourDate.date), "d 'de' MMMM 'de' yyyy", { locale: es })}`,
    tourLogoUrl
  );

  pdf.setTextColor(0, 0, 0);

  // Event Information
  pdf.setFontSize(14);
  pdf.setFont(undefined, 'bold');
  pdf.text('Información del Evento', 10, currentY);
  currentY += 10;

  const eventInfo = [
    ['Fecha', format(new Date(tourDate.date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })],
    ['Venue', tourDate.location?.name || 'Por confirmar'],
    ['Dirección', tourDate.location?.formatted_address || 'Por confirmar'],
    ['Ciudad', `${tourDate.location?.city || ''}, ${tourDate.location?.state || ''}`],
    ['Call Time', tourDate.call_time || 'Por confirmar'],
    ['Showtime', tourDate.showtime || 'Por confirmar'],
  ];

  autoTable(pdf, {
    body: eventInfo,
    startY: currentY,
    theme: 'plain',
    styles: {
      fontSize: 10,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold', fillColor: [240, 240, 240] },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 10, right: 10 },
  });

  currentY = getLastAutoTableY(pdf, currentY) + 15;

  // Program Schedule
  try {
    const { data: hojaDeRuta } = await supabase
      .from('hoja_de_ruta')
      .select('*')
      .eq('tour_date_id', tourDate.id)
      .maybeSingle();

    if (hojaDeRuta && hojaDeRuta.program_schedule_json) {
      pdf.setFontSize(14);
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(...CORPORATE_RED);
      pdf.text('Programa del Evento', 10, currentY);
      pdf.setTextColor(0, 0, 0);
      currentY += 10;

      const schedule = asProgramDays(hojaDeRuta.program_schedule_json);

      for (const day of schedule) {
        if (day.rows && day.rows.length > 0) {
          if (day.label) {
            pdf.setFontSize(12);
            pdf.setFont(undefined, 'bold');
            pdf.text(day.label, 10, currentY);
            currentY += 8;
          }

          const scheduleData = day.rows.map((row) => [
            row.time || '',
            row.item || '',
            row.dept || '',
            row.notes || '',
          ]);

          autoTable(pdf, {
            head: [['Hora', 'Actividad', 'Dpto', 'Notas']],
            body: scheduleData,
            startY: currentY,
            theme: 'grid',
            styles: {
              fontSize: 9,
              cellPadding: 3,
            },
            headStyles: {
              fillColor: CORPORATE_RED,
              textColor: [255, 255, 255],
              fontSize: 10,
              fontStyle: 'bold',
            },
            columnStyles: {
              0: { cellWidth: 25, halign: 'center' },
              1: { cellWidth: 'auto' },
              2: { cellWidth: 25, halign: 'center' },
              3: { cellWidth: 50 },
            },
            margin: { left: 10, right: 10 },
          });

          currentY = getLastAutoTableY(pdf, currentY) + 10;
        }
      }
    }

    // Hotels & Rooming
    if (hojaDeRuta?.hotel_info) {
      if (currentY > 200) {
        pdf.addPage();
        addPDFHeader(pdf, tourData.name, 'Event Day Sheet (continuación)', tourLogoUrl);
        currentY = 40;
      }

      pdf.setFontSize(14);
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(...CORPORATE_RED);
      pdf.text('Alojamiento', 10, currentY);
      pdf.setTextColor(0, 0, 0);
      currentY += 10;

      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      const hotelInfo = typeof hojaDeRuta.hotel_info === 'string' ? hojaDeRuta.hotel_info : String(hojaDeRuta.hotel_info);
      const hotelText = pdf.splitTextToSize(hotelInfo, 190);
      pdf.text(hotelText, 10, currentY);
      currentY += hotelText.length * 5 + 10;
    }

    // Restaurants
    if (hojaDeRuta?.restaurants_info) {
      if (currentY > 220) {
        pdf.addPage();
        addPDFHeader(pdf, tourData.name, 'Event Day Sheet (continuación)', tourLogoUrl);
        currentY = 40;
      }

      pdf.setFontSize(14);
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(...CORPORATE_RED);
      pdf.text('Restaurantes Recomendados', 10, currentY);
      pdf.setTextColor(0, 0, 0);
      currentY += 10;

      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      const restaurantsInfo =
        typeof hojaDeRuta.restaurants_info === 'string' ? hojaDeRuta.restaurants_info : String(hojaDeRuta.restaurants_info);
      const restaurantText = pdf.splitTextToSize(restaurantsInfo, 190);
      pdf.text(restaurantText, 10, currentY);
      currentY += restaurantText.length * 5 + 10;
    }
  } catch (error) {
    console.error('Error loading event data:', error);
  }

  // Weather
  try {
    if (tourDate.location?.formatted_address) {
      const weatherData = await getWeatherForJob({ address: tourDate.location.formatted_address }, tourDate.date);

      if (weatherData && weatherData.length > 0) {
        if (currentY > 230) {
          pdf.addPage();
          addPDFHeader(pdf, tourData.name, 'Event Day Sheet (continuación)', tourLogoUrl);
          currentY = 40;
        }

        pdf.setFontSize(14);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(...CORPORATE_RED);
        pdf.text('Pronóstico del Tiempo', 10, currentY);
        pdf.setTextColor(0, 0, 0);
        currentY += 10;

        const weatherTableData = weatherData.map((w) => [
          format(new Date(w.date), 'EEE d MMM', { locale: es }),
          w.condition,
          `${w.maxTemp}°C / ${w.minTemp}°C`,
          `${w.precipitationProbability}%`,
        ]);
        const weatherIconHooks = createWeatherTableIconHooks(pdf, weatherData);

        autoTable(pdf, {
          head: [['Fecha', 'Condición', 'Temperatura', 'Lluvia']],
          body: weatherTableData,
          startY: currentY,
          theme: 'grid',
          styles: {
            fontSize: 9,
            cellPadding: 3,
          },
          headStyles: {
            fillColor: CORPORATE_RED,
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: 'bold',
          },
          margin: { left: 10, right: 10 },
          ...weatherIconHooks,
        });

        currentY = getLastAutoTableY(pdf, currentY) + 10;
      }
    }
  } catch (error) {
    console.warn('Could not load weather:', error);
  }

  // Tour Contacts
  if (tourData.tour_contacts && tourData.tour_contacts.length > 0) {
    if (currentY > 200) {
      pdf.addPage();
      addPDFHeader(pdf, tourData.name, 'Event Day Sheet (continuación)', tourLogoUrl);
      currentY = 40;
    }

    currentY = addTourContactsSection(pdf, autoTable, tourData.tour_contacts, currentY);
  }

  // Crew Assignments
  try {
    const jobQuery = await supabase
      .from('jobs')
      .select('id')
      .eq('tour_date_id', tourDate.id)
      .maybeSingle();

    if (jobQuery.data?.id) {
      const { data: assignments } = await supabase
        .from('job_assignments')
        .select(`
          *,
          profiles!job_assignments_technician_id_fkey (
            first_name,
            last_name,
            phone
          )
        `)
        .eq('job_id', jobQuery.data.id);

      if (assignments && assignments.length > 0) {
        if (currentY > 200) {
          pdf.addPage();
          addPDFHeader(pdf, tourData.name, 'Event Day Sheet (continuación)', tourLogoUrl);
          currentY = 40;
        }

        pdf.setFontSize(14);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(...CORPORATE_RED);
        pdf.text('Crew Asignado al Evento', 10, currentY);
        pdf.setTextColor(0, 0, 0);
        currentY += 10;

        const crewData = asCrewAssignments(assignments).map((a) => {
          const profile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
          const roles = [];
          if (a.sound_role) roles.push(`Sound: ${a.sound_role}`);
          if (a.lights_role) roles.push(`Lights: ${a.lights_role}`);
          if (a.video_role) roles.push(`Video: ${a.video_role}`);

          return [
            `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
            roles.join(', ') || '-',
            profile?.phone || '-',
          ];
        });

        autoTable(pdf, {
          head: [['Nombre', 'Roles', 'Teléfono']],
          body: crewData,
          startY: currentY,
          theme: 'grid',
          styles: {
            fontSize: 9,
            cellPadding: 3,
          },
          headStyles: {
            fillColor: CORPORATE_RED,
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: 'bold',
          },
          margin: { left: 10, right: 10 },
        });
      }
    }
  } catch (error) {
    console.error('Error loading crew:', error);
  }

  await addPDFFooter(pdf);

  const filename = buildReadableFilename([
    tourData.name,
    format(new Date(tourDate.date), 'yyyy-MM-dd'),
    'event',
  ]);
  pdf.save(filename);
};

/**
 * Generate complete set of day sheets for a tour date
 */
export const generateCompleteDaySheetSet = async (
  tourData: TourData,
  tourDate: TourDateData,
  travelPlan: TravelSegment[]
) => {
  // Find travel segments for this date
  const travelToVenue = travelPlan.find(
    (seg) => seg.toDateId === tourDate.id && seg.toType === 'venue'
  );

  const travelFromVenue = travelPlan.find(
    (seg) => seg.fromDateId === tourDate.id && seg.fromType === 'venue'
  );

  // Generate travel TO venue
  if (travelToVenue) {
    await generateTravelDaySheet(tourData, travelToVenue, tourDate, 'to');
  }

  // Generate event day sheet
  await generateEnhancedEventDaySheet(tourData, tourDate);

  // Generate travel FROM venue
  if (travelFromVenue) {
    await generateTravelDaySheet(tourData, travelFromVenue, tourDate, 'from');
  }
};
