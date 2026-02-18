// @ts-nocheck
import type jsPDF from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { fetchTourLogo } from '@/utils/pdf/tourLogoUtils';
import { supabase } from '@/integrations/supabase/client';
import { getWeatherForJob } from '@/utils/weather/weatherApi';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';

const CORPORATE_RED: [number, number, number] = [125, 1, 1];
const HEADER_HEIGHT = 30;

let jsPDFConstructor: any | null = null;
let autoTable: any | null = null;

const ensurePdfLibs = async () => {
  if (jsPDFConstructor && autoTable) {
    return { jsPDF: jsPDFConstructor, autoTable };
  }

  const libs = await loadPdfLibs();
  jsPDFConstructor = libs.jsPDF as any;
  autoTable = libs.autoTable as any;
  return { jsPDF: jsPDFConstructor, autoTable };
};

/**
 * Load company logo as base64
 */
const loadCompanyLogo = async (): Promise<string | null> => {
  const paths = [
    '/sector pro logo.png',
    './sector pro logo.png',
    'sector pro logo.png',
  ];

  for (const path of paths) {
    try {
      const response = await fetch(path);
      if (!response.ok) continue;

      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to convert image'));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      continue;
    }
  }

  return null;
};

/**
 * Add PDF header
 */
const addPDFHeader = (
  pdf: jsPDF,
  title: string,
  subtitle: string,
  tourLogoUrl?: string
) => {
  const pageWidth = pdf.internal.pageSize.width;

  pdf.setFillColor(...CORPORATE_RED);
  pdf.rect(0, 0, pageWidth, HEADER_HEIGHT, 'F');

  if (tourLogoUrl) {
    try {
      pdf.addImage(tourLogoUrl, 'PNG', 5, 5, 25, 20);
    } catch (error) {
      console.warn('Error adding tour logo:', error);
    }
  }

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.text(title, pageWidth / 2, 15, { align: 'center' });
  pdf.setFontSize(12);
  pdf.text(subtitle, pageWidth / 2, 25, { align: 'center' });
};

/**
 * Add PDF footer
 */
const addPDFFooter = async (pdf: jsPDF, pageNum?: number) => {
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;

  const companyLogo = await loadCompanyLogo();
  if (companyLogo) {
    try {
      const logoWidth = 40;
      const logoHeight = 15;
      const x = (pageWidth - logoWidth) / 2;
      const y = pageHeight - 25;
      pdf.addImage(companyLogo, 'PNG', x, y, logoWidth, logoHeight);
    } catch (error) {
      console.warn('Error adding company logo:', error);
    }
  }

  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  pdf.text(
    `Generado el ${format(new Date(), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}`,
    10,
    pageHeight - 10
  );

  if (pageNum !== undefined) {
    pdf.text(`Página ${pageNum}`, pageWidth - 30, pageHeight - 10);
  }
};

/**
 * Add tour contacts section
 */
const addTourContactsSection = (
  pdf: jsPDF,
  tourContacts: any[],
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

  return (pdf as any).lastAutoTable.finalY + 10;
};

/**
 * Generate Travel Day Sheet (to or from venue)
 */
export const generateTravelDaySheet = async (
  tourData: any,
  travelSegment: any,
  tourDate: any,
  direction: 'to' | 'from'
) => {
  const { jsPDF } = await ensurePdfLibs();
  const pdf = new jsPDF();
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

  currentY = (pdf as any).lastAutoTable.finalY + 15;

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

    currentY = (pdf as any).lastAutoTable.finalY + 15;
  }

  // Tour Contacts
  if (tourData.tour_contacts && tourData.tour_contacts.length > 0) {
    currentY = addTourContactsSection(pdf, tourData.tour_contacts, currentY);
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

        const crewData = assignments.map((a: any) => {
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

        currentY = (pdf as any).lastAutoTable.finalY + 10;
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

  const filename = `${tourData.name}_${format(new Date(tourDate.date), 'yyyy-MM-dd')}_travel_${direction}.pdf`;
  pdf.save(filename);
};

/**
 * Generate Enhanced Event Day Sheet with hotels, rooming, and restaurants
 */
export const generateEnhancedEventDaySheet = async (
  tourData: any,
  tourDate: any
) => {
  const { jsPDF } = await ensurePdfLibs();
  const pdf = new jsPDF();
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

  currentY = (pdf as any).lastAutoTable.finalY + 15;

  // Program Schedule
  try {
    const { data: hojaDeRuta, error: hojaError } = await supabase
      .from('hoja_de_ruta' as any)
      .select('*')
      .eq('tour_date_id', tourDate.id)
      .maybeSingle();

    if (hojaError) {
      console.warn('Error loading hoja de ruta:', hojaError);
    }

    if (hojaDeRuta && hojaDeRuta.program_schedule_json) {
      pdf.setFontSize(14);
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(...CORPORATE_RED);
      pdf.text('Programa del Evento', 10, currentY);
      pdf.setTextColor(0, 0, 0);
      currentY += 10;

      const schedule = Array.isArray(hojaDeRuta.program_schedule_json) 
        ? hojaDeRuta.program_schedule_json 
        : [];

      for (const day of schedule) {
        if (day && day.rows && Array.isArray(day.rows) && day.rows.length > 0) {
          if (day.label) {
            pdf.setFontSize(12);
            pdf.setFont(undefined, 'bold');
            pdf.text(day.label, 10, currentY);
            currentY += 8;
          }

          const scheduleData = day.rows.map((row: any) => [
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

          currentY = (pdf as any).lastAutoTable.finalY + 10;
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
      const hotelText = pdf.splitTextToSize(hojaDeRuta.hotel_info, 190);
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
      const restaurantText = pdf.splitTextToSize(hojaDeRuta.restaurants_info, 190);
      pdf.text(restaurantText, 10, currentY);
      currentY += restaurantText.length * 5 + 10;
    }
  } catch (error) {
    console.error('Error loading event data:', error);
  }

  // Weather
  try {
    const jobQuery = await supabase
      .from('jobs')
      .select('id')
      .eq('tour_date_id', tourDate.id)
      .maybeSingle();

    if (jobQuery.data?.id && tourDate.location?.formatted_address) {
      const weatherData = await getWeatherForJob(
        jobQuery.data.id,
        tourDate.date,
        tourDate.date,
        tourDate.location.formatted_address
      );

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
          w.icon + ' ' + w.condition,
          `${w.maxTemp}°C / ${w.minTemp}°C`,
          `${w.precipitationProbability}%`,
        ]);

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
        });

        currentY = (pdf as any).lastAutoTable.finalY + 10;
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

    currentY = addTourContactsSection(pdf, tourData.tour_contacts, currentY);
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

        const crewData = assignments.map((a: any) => {
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

  const filename = `${tourData.name}_${format(new Date(tourDate.date), 'yyyy-MM-dd')}_event.pdf`;
  pdf.save(filename);
};

/**
 * Generate complete set of day sheets for a tour date
 */
export const generateCompleteDaySheetSet = async (
  tourData: any,
  tourDate: any,
  travelPlan: any[]
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
