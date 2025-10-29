import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { fetchTourLogo } from '@/utils/pdf/tourLogoUtils';
import { supabase } from '@/integrations/supabase/client';
import { getWeatherForJob } from '@/utils/weather/weatherApi';

const CORPORATE_RED: [number, number, number] = [125, 1, 1];
const HEADER_HEIGHT = 30;
const FOOTER_HEIGHT = 30;

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
 * Add PDF header with logo and title
 */
const addPDFHeader = (
  pdf: jsPDF,
  title: string,
  subtitle: string,
  tourLogoUrl?: string
) => {
  const pageWidth = pdf.internal.pageSize.width;

  // Red header background
  pdf.setFillColor(...CORPORATE_RED);
  pdf.rect(0, 0, pageWidth, HEADER_HEIGHT, 'F');

  // Add tour logo if available
  if (tourLogoUrl) {
    try {
      pdf.addImage(tourLogoUrl, 'PNG', 5, 5, 25, 20);
    } catch (error) {
      console.warn('Error adding tour logo:', error);
    }
  }

  // Header text
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.text(title, pageWidth / 2, 15, { align: 'center' });
  pdf.setFontSize(12);
  pdf.text(subtitle, pageWidth / 2, 25, { align: 'center' });
};

/**
 * Add PDF footer with company logo and timestamp
 */
const addPDFFooter = async (pdf: jsPDF, pageNum?: number) => {
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;

  // Add company logo
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

  // Add timestamp
  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  pdf.text(
    `Generado el ${format(new Date(), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}`,
    10,
    pageHeight - 10
  );

  // Add page number if provided
  if (pageNum !== undefined) {
    pdf.text(
      `Página ${pageNum}`,
      pageWidth - 30,
      pageHeight - 10
    );
  }
};

/**
 * Generate a single day sheet for a tour date
 */
export const generateTourDaySheet = async (
  tourData: any,
  tourDate: any
) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.width;
  let currentY = 40;

  // Load tour logo
  let tourLogoUrl: string | undefined;
  try {
    tourLogoUrl = await fetchTourLogo(tourData.id);
  } catch (error) {
    console.warn('Could not load tour logo:', error);
  }

  // Add header
  addPDFHeader(
    pdf,
    tourData.name,
    `Day Sheet - ${format(new Date(tourDate.date), "d 'de' MMMM 'de' yyyy", { locale: es })}`,
    tourLogoUrl
  );

  // Reset text color
  pdf.setTextColor(0, 0, 0);

  // Date and Location Section
  pdf.setFontSize(14);
  pdf.setFont(undefined, 'bold');
  pdf.text('Información del Evento', 10, currentY);
  currentY += 10;

  const dateInfo = [
    ['Fecha', format(new Date(tourDate.date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })],
    ['Ubicación', tourDate.location?.name || 'Por confirmar'],
    ['Dirección', tourDate.location?.address || 'Por confirmar'],
  ];

  autoTable(pdf, {
    body: dateInfo,
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

  // Load hoja de ruta for this date
  try {
    const { data: hojaDeRuta, error } = await supabase
      .from('hoja_de_ruta')
      .select('*')
      .eq('tour_date_id', tourDate.id)
      .maybeSingle();

    if (hojaDeRuta && hojaDeRuta.program_schedule_json) {
      // Schedule Section
      pdf.setFontSize(14);
      pdf.setFont(undefined, 'bold');
      pdf.text('Programa del Día', 10, currentY);
      currentY += 10;

      const schedule = hojaDeRuta.program_schedule_json;

      // Process all program days
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

    // Load weather data
    const jobQuery = await supabase
      .from('jobs')
      .select('id')
      .eq('tour_date_id', tourDate.id)
      .maybeSingle();

    if (jobQuery.data?.id && tourDate.location?.address) {
      try {
        const weatherData = await getWeatherForJob(
          jobQuery.data.id,
          tourDate.date,
          tourDate.date,
          tourDate.location.address
        );

        if (weatherData && weatherData.length > 0) {
          // Check if we need a new page
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
              0: { cellWidth: 35 },
              1: { cellWidth: 60 },
              2: { cellWidth: 40, halign: 'center' },
              3: { cellWidth: 30, halign: 'center' },
            },
            margin: { left: 10, right: 10 },
          });

          currentY = (pdf as any).lastAutoTable.finalY + 10;
        }
      } catch (weatherError) {
        console.warn('Could not load weather data:', weatherError);
      }
    }

    // Load crew assignments
    if (jobQuery.data?.id) {
      const { data: assignments, error: assignmentsError } = await supabase
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
        // Check if we need a new page
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
      }
    }
  } catch (error) {
    console.error('Error loading day sheet data:', error);
  }

  // Add footer
  await addPDFFooter(pdf);

  // Save PDF
  const filename = `${tourData.name}_${format(new Date(tourDate.date), 'yyyy-MM-dd', { locale: es })}_daysheet.pdf`;
  pdf.save(filename);
};

/**
 * Generate a comprehensive tour book for all tour dates
 */
export const generateTourBook = async (
  tourData: any,
  tourDates: any[]
) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.width;
  let pageNum = 1;

  // Load tour logo
  let tourLogoUrl: string | undefined;
  try {
    tourLogoUrl = await fetchTourLogo(tourData.id);
  } catch (error) {
    console.warn('Could not load tour logo:', error);
  }

  // Sort dates
  const sortedDates = [...tourDates].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // === COVER PAGE ===
  pdf.setFillColor(...CORPORATE_RED);
  pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.height, 'F');

  // Tour logo on cover
  if (tourLogoUrl) {
    try {
      pdf.addImage(tourLogoUrl, 'PNG', (pageWidth - 80) / 2, 40, 80, 60);
    } catch (error) {
      console.warn('Error adding logo to cover:', error);
    }
  }

  // Cover title
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(32);
  pdf.text(tourData.name, pageWidth / 2, 130, { align: 'center' });

  pdf.setFontSize(18);
  pdf.text('Tour Book', pageWidth / 2, 145, { align: 'center' });

  if (sortedDates.length > 0) {
    pdf.setFontSize(14);
    pdf.text(
      `${format(new Date(sortedDates[0].date), "d 'de' MMMM", { locale: es })} - ${format(new Date(sortedDates[sortedDates.length - 1].date), "d 'de' MMMM 'de' yyyy", { locale: es })}`,
      pageWidth / 2,
      160,
      { align: 'center' }
    );
  }

  // === TABLE OF CONTENTS ===
  pdf.addPage();
  pageNum++;
  addPDFHeader(pdf, tourData.name, 'Índice', tourLogoUrl);

  let currentY = 45;
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(16);
  pdf.setFont(undefined, 'bold');
  pdf.text('Contenido', 10, currentY);
  currentY += 15;

  pdf.setFontSize(11);
  pdf.setFont(undefined, 'normal');

  const tocItems = [
    'Resumen del Tour',
    'Calendario Completo',
    ...sortedDates.map((d, i) =>
      `Día ${i + 1}: ${format(new Date(d.date), "d 'de' MMMM", { locale: es })} - ${d.location?.name || 'TBC'}`
    ),
  ];

  tocItems.forEach((item, index) => {
    pdf.text(`${index + 1}. ${item}`, 15, currentY);
    currentY += 8;
  });

  await addPDFFooter(pdf, pageNum);

  // === TOUR SUMMARY ===
  pdf.addPage();
  pageNum++;
  addPDFHeader(pdf, tourData.name, 'Resumen del Tour', tourLogoUrl);

  currentY = 45;
  pdf.setTextColor(0, 0, 0);

  const summaryData = [
    ['Nombre del Tour', tourData.name],
    ['Descripción', tourData.description || 'N/A'],
    ['Número de Fechas', sortedDates.length.toString()],
    ['Fecha de Inicio', format(new Date(sortedDates[0].date), "d 'de' MMMM 'de' yyyy", { locale: es })],
    ['Fecha de Fin', format(new Date(sortedDates[sortedDates.length - 1].date), "d 'de' MMMM 'de' yyyy", { locale: es })],
    ['Duración', `${Math.ceil((new Date(sortedDates[sortedDates.length - 1].date).getTime() - new Date(sortedDates[0].date).getTime()) / (1000 * 60 * 60 * 24))} días`],
    ['Estado', tourData.status === 'active' ? 'Activo' : tourData.status === 'cancelled' ? 'Cancelado' : 'Completado'],
  ];

  autoTable(pdf, {
    body: summaryData,
    startY: currentY,
    theme: 'plain',
    styles: {
      fontSize: 10,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold', fillColor: [240, 240, 240] },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 10, right: 10 },
  });

  await addPDFFooter(pdf, pageNum);

  // === FULL CALENDAR ===
  pdf.addPage();
  pageNum++;
  addPDFHeader(pdf, tourData.name, 'Calendario Completo', tourLogoUrl);

  currentY = 45;

  const calendarData = sortedDates.map((date, index) => [
    `Día ${index + 1}`,
    format(new Date(date.date), "EEE d MMM yyyy", { locale: es }),
    date.location?.name || 'Por confirmar',
    date.location?.address || '-',
  ]);

  autoTable(pdf, {
    head: [['Día', 'Fecha', 'Venue', 'Dirección']],
    body: calendarData,
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
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 35 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 50 },
    },
    margin: { left: 10, right: 10 },
  });

  await addPDFFooter(pdf, pageNum);

  // === INDIVIDUAL DAY PAGES ===
  for (let i = 0; i < sortedDates.length; i++) {
    const tourDate = sortedDates[i];

    pdf.addPage();
    pageNum++;

    addPDFHeader(
      pdf,
      tourData.name,
      `Día ${i + 1} - ${format(new Date(tourDate.date), "d 'de' MMMM", { locale: es })}`,
      tourLogoUrl
    );

    currentY = 45;
    pdf.setTextColor(0, 0, 0);

    // Date info
    const dayInfo = [
      ['Fecha', format(new Date(tourDate.date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })],
      ['Venue', tourDate.location?.name || 'Por confirmar'],
      ['Dirección', tourDate.location?.address || 'Por confirmar'],
      ['Notas', tourDate.notes || '-'],
    ];

    autoTable(pdf, {
      body: dayInfo,
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

    // Load and add schedule if available
    try {
      const { data: hojaDeRuta } = await supabase
        .from('hoja_de_ruta')
        .select('program_schedule_json')
        .eq('tour_date_id', tourDate.id)
        .maybeSingle();

      if (hojaDeRuta && hojaDeRuta.program_schedule_json) {
        pdf.setFontSize(12);
        pdf.setFont(undefined, 'bold');
        pdf.text('Programa', 10, currentY);
        currentY += 8;

        const schedule = hojaDeRuta.program_schedule_json;

        for (const day of schedule) {
          if (day.rows && day.rows.length > 0) {
            const scheduleData = day.rows.map((row: any) => [
              row.time || '',
              row.item || '',
              row.dept || '',
            ]);

            autoTable(pdf, {
              head: [['Hora', 'Actividad', 'Departamento']],
              body: scheduleData,
              startY: currentY,
              theme: 'striped',
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
                2: { cellWidth: 30, halign: 'center' },
              },
              margin: { left: 10, right: 10 },
            });

            currentY = (pdf as any).lastAutoTable.finalY + 5;
          }
        }
      }
    } catch (error) {
      console.warn(`Could not load schedule for day ${i + 1}:`, error);
    }

    await addPDFFooter(pdf, pageNum);
  }

  // Save PDF
  const filename = `${tourData.name}_tourbook.pdf`;
  pdf.save(filename);
};
