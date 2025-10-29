import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, addDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { fetchTourLogo } from '@/utils/pdf/tourLogoUtils';
import { supabase } from '@/integrations/supabase/client';
import { getWeatherForJob } from '@/utils/weather/weatherApi';

const CORPORATE_RED: [number, number, number] = [125, 1, 1];

const loadCompanyLogo = async (): Promise<string | null> => {
  const paths = ['/sector pro logo.png', './sector pro logo.png', 'sector pro logo.png'];
  for (const path of paths) {
    try {
      const response = await fetch(path);
      if (!response.ok) continue;
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed'));
        reader.readAsDataURL(blob);
      });
    } catch { continue; }
  }
  return null;
};

const addPDFHeader = (pdf: jsPDF, title: string, subtitle: string, tourLogoUrl?: string) => {
  const pageWidth = pdf.internal.pageSize.width;
  pdf.setFillColor(...CORPORATE_RED);
  pdf.rect(0, 0, pageWidth, 30, 'F');

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

const addPDFFooter = async (pdf: jsPDF, pageNum?: number) => {
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;

  const companyLogo = await loadCompanyLogo();
  if (companyLogo) {
    try {
      pdf.addImage(companyLogo, 'PNG', (pageWidth - 40) / 2, pageHeight - 25, 40, 15);
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

const addTourContactsSection = (pdf: jsPDF, tourContacts: any[], currentY: number) => {
  if (!tourContacts || tourContacts.length === 0) return currentY;

  pdf.setFontSize(14);
  pdf.setFont(undefined, 'bold');
  pdf.text('Contactos del Tour', 10, currentY);
  currentY += 10;

  const contactsData = tourContacts.map(contact => [
    contact.name || '',
    contact.role || '',
    contact.phone || '',
    contact.email || '',
    contact.company || '',
  ]);

  autoTable(pdf, {
    head: [['Nombre', 'Rol', 'Teléfono', 'Email', 'Empresa']],
    body: contactsData,
    startY: currentY,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: {
      fillColor: CORPORATE_RED,
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 30 },
      2: { cellWidth: 30 },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 30 },
    },
    margin: { left: 10, right: 10 },
  });

  return (pdf as any).lastAutoTable.finalY + 15;
};

/**
 * Generate a travel day sheet (for travel TO or FROM venue)
 */
export const generateTravelDaySheet = async (
  tourData: any,
  travelSegment: any,
  direction: 'to' | 'from'
) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.width;
  let currentY = 40;

  let tourLogoUrl: string | undefined;
  try {
    tourLogoUrl = await fetchTourLogo(tourData.id);
  } catch (error) {
    console.warn('Could not load tour logo:', error);
  }

  const travelDate = direction === 'to' ? travelSegment.departureDate : travelSegment.arrivalDate;
  addPDFHeader(
    pdf,
    tourData.name,
    `Day Sheet - Viaje ${direction === 'to' ? 'IDA' : 'VUELTA'} - ${format(new Date(travelDate), "d 'de' MMMM 'de' yyyy", { locale: es })}`,
    tourLogoUrl
  );

  pdf.setTextColor(0, 0, 0);

  // Travel Information Section
  pdf.setFontSize(14);
  pdf.setFont(undefined, 'bold');
  pdf.text('Información del Viaje', 10, currentY);
  currentY += 10;

  const travelInfo = [
    ['Tipo de Día', `Viaje ${direction === 'to' ? 'de ida' : 'de vuelta'}`],
    ['Fecha', format(new Date(travelDate), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })],
    ['Origen', travelSegment.fromLocation],
    ['Destino', travelSegment.toLocation],
    ['Tipo de Transporte', travelSegment.transportType],
    ['Hora de Salida', travelSegment.departureTime || 'Por confirmar'],
    ['Hora de Llegada Estimada', travelSegment.arrivalTime || 'Por confirmar'],
    ['Distancia', `${travelSegment.distance} km`],
    ['Duración Estimada', `${Math.floor(travelSegment.duration / 60)}h ${travelSegment.duration % 60}m`],
  ];

  if (travelSegment.notes) {
    travelInfo.push(['Notas', travelSegment.notes]);
  }

  autoTable(pdf, {
    body: travelInfo,
    startY: currentY,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 10, right: 10 },
  });

  currentY = (pdf as any).lastAutoTable.finalY + 15;

  // Tour Contacts
  if (tourData.tour_contacts) {
    currentY = addTourContactsSection(pdf, tourData.tour_contacts, currentY);
  }

  // Crew Assignments
  // Note: For travel days, we might want to show all crew or specific travel crew
  try {
    const { data: assignments, error } = await supabase
      .from('tour_assignments')
      .select(`
        *,
        profiles!tour_assignments_technician_id_fkey (
          first_name,
          last_name,
          phone
        )
      `)
      .eq('tour_id', tourData.id);

    if (assignments && assignments.length > 0) {
      if (currentY > 220) {
        pdf.addPage();
        addPDFHeader(pdf, tourData.name, 'Day Sheet (continuación)', tourLogoUrl);
        currentY = 40;
      }

      pdf.setFontSize(14);
      pdf.setFont(undefined, 'bold');
      pdf.text('Personal del Tour', 10, currentY);
      currentY += 10;

      const crewData = assignments.map((a: any) => {
        const profile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
        return [
          `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
          a.department || '-',
          profile?.phone || '-',
        ];
      });

      autoTable(pdf, {
        head: [['Nombre', 'Departamento', 'Teléfono']],
        body: crewData,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: {
          fillColor: CORPORATE_RED,
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 40 },
          2: { cellWidth: 40 },
        },
        margin: { left: 10, right: 10 },
      });
    }
  } catch (error) {
    console.error('Error loading crew assignments:', error);
  }

  await addPDFFooter(pdf);

  const filename = `${tourData.name}_${format(new Date(travelDate), 'yyyy-MM-dd')}_${direction === 'to' ? 'viaje_ida' : 'viaje_vuelta'}.pdf`;
  pdf.save(filename);
};

/**
 * Generate an event day sheet (for the actual event date)
 */
export const generateEventDaySheet = async (
  tourData: any,
  tourDate: any,
  dayNumber?: number
) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.width;
  let currentY = 40;

  let tourLogoUrl: string | undefined;
  try {
    tourLogoUrl = await fetchTourLogo(tourData.id);
  } catch (error) {
    console.warn('Could not load tour logo:', error);
  }

  const dayLabel = dayNumber ? `Día ${dayNumber}` : 'Evento';
  addPDFHeader(
    pdf,
    tourData.name,
    `Day Sheet - ${dayLabel} - ${format(new Date(tourDate.date), "d 'de' MMMM 'de' yyyy", { locale: es })}`,
    tourLogoUrl
  );

  pdf.setTextColor(0, 0, 0);

  // Event Information Section
  pdf.setFontSize(14);
  pdf.setFont(undefined, 'bold');
  pdf.text('Información del Evento', 10, currentY);
  currentY += 10;

  const dateInfo = [
    ['Fecha', format(new Date(tourDate.date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })],
    ['Ubicación', tourDate.location?.name || 'Por confirmar'],
    ['Dirección', tourDate.location?.address || 'Por confirmar'],
  ];

  if (tourDate.notes) {
    dateInfo.push(['Notas', tourDate.notes]);
  }

  autoTable(pdf, {
    body: dateInfo,
    startY: currentY,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 10, right: 10 },
  });

  currentY = (pdf as any).lastAutoTable.finalY + 15;

  // Load and add schedule
  try {
    const { data: hojaDeRuta } = await supabase
      .from('hoja_de_ruta')
      .select('*')
      .eq('tour_date_id', tourDate.id)
      .maybeSingle();

    if (hojaDeRuta && hojaDeRuta.program_schedule_json) {
      pdf.setFontSize(14);
      pdf.setFont(undefined, 'bold');
      pdf.text('Programa del Día', 10, currentY);
      currentY += 10;

      const schedule = hojaDeRuta.program_schedule_json;

      for (const day of schedule) {
        if (day.rows && day.rows.length > 0) {
          if (day.label) {
            pdf.setFontSize(12);
            pdf.setFont(undefined, 'bold');
            pdf.setTextColor(...CORPORATE_RED);
            pdf.text(day.label, 10, currentY);
            pdf.setTextColor(0, 0, 0);
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
            styles: { fontSize: 9, cellPadding: 3 },
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
  } catch (error) {
    console.error('Error loading schedule:', error);
  }

  // Weather
  try {
    const jobQuery = await supabase
      .from('jobs')
      .select('id')
      .eq('tour_date_id', tourDate.id)
      .maybeSingle();

    if (jobQuery.data?.id && tourDate.location?.address) {
      const weatherData = await getWeatherForJob(
        jobQuery.data.id,
        tourDate.date,
        tourDate.date,
        tourDate.location.address
      );

      if (weatherData && weatherData.length > 0) {
        if (currentY > 250) {
          pdf.addPage();
          addPDFHeader(pdf, tourData.name, 'Day Sheet (continuación)', tourLogoUrl);
          currentY = 40;
        }

        pdf.setFontSize(14);
        pdf.setFont(undefined, 'bold');
        pdf.text('Pronóstico del Tiempo', 10, currentY);
        currentY += 10;

        const weatherTableData = weatherData.map(w => [
          format(new Date(w.date), "EEE d MMM", { locale: es }),
          w.icon + ' ' + w.condition,
          `${w.maxTemp}°C / ${w.minTemp}°C`,
          `${w.precipitationProbability}%`,
        ]);

        autoTable(pdf, {
          head: [['Fecha', 'Condición', 'Temperatura', 'Lluvia']],
          body: weatherTableData,
          startY: currentY,
          theme: 'grid',
          styles: { fontSize: 9, cellPadding: 3 },
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
    console.warn('Could not load weather data:', error);
  }

  // Accommodation & Rooming
  try {
    const { data: hojaDeRuta } = await supabase
      .from('hoja_de_ruta')
      .select('*')
      .eq('tour_date_id', tourDate.id)
      .maybeSingle();

    if (hojaDeRuta) {
      // Hotels and Accommodations
      if (hojaDeRuta.accommodations_json && hojaDeRuta.accommodations_json.length > 0) {
        if (currentY > 200) {
          pdf.addPage();
          addPDFHeader(pdf, tourData.name, 'Day Sheet (continuación)', tourLogoUrl);
          currentY = 40;
        }

        pdf.setFontSize(14);
        pdf.setFont(undefined, 'bold');
        pdf.text('Alojamiento', 10, currentY);
        currentY += 10;

        const accommodations = hojaDeRuta.accommodations_json;

        for (const acc of accommodations) {
          // Hotel info
          pdf.setFontSize(12);
          pdf.setFont(undefined, 'bold');
          pdf.setTextColor(...CORPORATE_RED);
          pdf.text(acc.hotel_name || 'Hotel', 10, currentY);
          pdf.setTextColor(0, 0, 0);
          currentY += 6;

          const hotelInfo: string[][] = [];
          if (acc.address) hotelInfo.push(['Dirección', acc.address]);
          if (acc.check_in) hotelInfo.push(['Check-in', acc.check_in]);
          if (acc.check_out) hotelInfo.push(['Check-out', acc.check_out]);

          if (hotelInfo.length > 0) {
            autoTable(pdf, {
              body: hotelInfo,
              startY: currentY,
              theme: 'plain',
              styles: { fontSize: 9, cellPadding: 2 },
              columnStyles: {
                0: { cellWidth: 30, fontStyle: 'bold' },
                1: { cellWidth: 'auto' },
              },
              margin: { left: 15, right: 10 },
            });
            currentY = (pdf as any).lastAutoTable.finalY + 5;
          }

          // Rooming list
          if (acc.rooms && acc.rooms.length > 0) {
            const roomData = acc.rooms.map((room: any) => [
              room.room_number || '-',
              room.room_type || '-',
              room.staff_member1_id || '-',
              room.staff_member2_id || '-',
            ]);

            autoTable(pdf, {
              head: [['Habitación', 'Tipo', 'Ocupante 1', 'Ocupante 2']],
              body: roomData,
              startY: currentY,
              theme: 'grid',
              styles: { fontSize: 8, cellPadding: 2 },
              headStyles: {
                fillColor: [200, 200, 200],
                textColor: [0, 0, 0],
                fontSize: 9,
                fontStyle: 'bold',
              },
              columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 30 },
                2: { cellWidth: 'auto' },
                3: { cellWidth: 'auto' },
              },
              margin: { left: 15, right: 10 },
            });

            currentY = (pdf as any).lastAutoTable.finalY + 10;
          }
        }
      }

      // Restaurants
      if (hojaDeRuta.restaurants_json && hojaDeRuta.restaurants_json.length > 0) {
        const selectedRestaurants = hojaDeRuta.restaurants_json.filter((r: any) => r.isSelected);

        if (selectedRestaurants.length > 0) {
          if (currentY > 200) {
            pdf.addPage();
            addPDFHeader(pdf, tourData.name, 'Day Sheet (continuación)', tourLogoUrl);
            currentY = 40;
          }

          pdf.setFontSize(14);
          pdf.setFont(undefined, 'bold');
          pdf.text('Restaurantes Recomendados', 10, currentY);
          currentY += 10;

          const restaurantData = selectedRestaurants.map((r: any) => [
            r.name || '',
            r.cuisine?.join(', ') || '-',
            r.address || '',
            r.phone || '-',
            r.rating ? `${r.rating} ⭐` : '-',
          ]);

          autoTable(pdf, {
            head: [['Nombre', 'Tipo', 'Dirección', 'Teléfono', 'Rating']],
            body: restaurantData,
            startY: currentY,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 3 },
            headStyles: {
              fillColor: CORPORATE_RED,
              textColor: [255, 255, 255],
              fontSize: 9,
              fontStyle: 'bold',
            },
            columnStyles: {
              0: { cellWidth: 40 },
              1: { cellWidth: 25 },
              2: { cellWidth: 'auto' },
              3: { cellWidth: 25 },
              4: { cellWidth: 15 },
            },
            margin: { left: 10, right: 10 },
          });

          currentY = (pdf as any).lastAutoTable.finalY + 15;
        }
      }
    }
  } catch (error) {
    console.error('Error loading accommodation/restaurants:', error);
  }

  // Tour Contacts
  if (tourData.tour_contacts) {
    if (currentY > 220) {
      pdf.addPage();
      addPDFHeader(pdf, tourData.name, 'Day Sheet (continuación)', tourLogoUrl);
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
        if (currentY > 220) {
          pdf.addPage();
          addPDFHeader(pdf, tourData.name, 'Day Sheet (continuación)', tourLogoUrl);
          currentY = 40;
        }

        pdf.setFontSize(14);
        pdf.setFont(undefined, 'bold');
        pdf.text('Personal Asignado', 10, currentY);
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
          styles: { fontSize: 9, cellPadding: 3 },
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
      }
    }
  } catch (error) {
    console.error('Error loading crew assignments:', error);
  }

  await addPDFFooter(pdf);

  const filename = `${tourData.name}_${format(new Date(tourDate.date), 'yyyy-MM-dd')}_evento${dayNumber ? `_dia${dayNumber}` : ''}.pdf`;
  pdf.save(filename);
};

/**
 * Generate all day sheets for a tour date (travel to + event + travel from)
 */
export const generateCompleteDaySheets = async (
  tourData: any,
  tourDate: any,
  travelPlan: any[],
  dayNumber?: number
) => {
  // Find travel segments for this date
  const travelTo = travelPlan.find(seg =>
    seg.toDateId === tourDate.id && seg.type !== 'venue_to_home'
  );

  const travelFrom = travelPlan.find(seg =>
    seg.fromDateId === tourDate.id && seg.type === 'venue_to_home'
  );

  // Generate travel TO day sheet
  if (travelTo) {
    await generateTravelDaySheet(tourData, travelTo, 'to');
  }

  // Generate event day sheet
  await generateEventDaySheet(tourData, tourDate, dayNumber);

  // Generate travel FROM day sheet
  if (travelFrom) {
    await generateTravelDaySheet(tourData, travelFrom, 'from');
  }
};
