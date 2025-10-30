import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { fetchTourLogo } from '@/utils/pdf/tourLogoUtils';
import { HojaDeRutaCompleta } from '@/types/daySheetExtended';

const CORPORATE_RED: [number, number, number] = [125, 1, 1];
const HEADER_HEIGHT = 25;
const FOOTER_HEIGHT = 15;
const MARGIN = 10;
const SMALL_FONT = 7;
const TINY_FONT = 6;

/**
 * Genera una hoja de ruta completa y compacta en formato de una página
 */
export async function generateComprehensiveDaySheet(
  tourData: any,
  tourDate: any,
  hojaDeRuta: HojaDeRutaCompleta,
  tourLogoPath?: string
) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;
  let currentY = HEADER_HEIGHT + 5;

  // Cargar logo del tour si existe
  let tourLogoUrl: string | null = null;
  if (tourLogoPath) {
    tourLogoUrl = await fetchTourLogo(tourLogoPath);
  }

  // ============================================================================
  // ENCABEZADO
  // ============================================================================
  pdf.setFillColor(...CORPORATE_RED);
  pdf.rect(0, 0, pageWidth, HEADER_HEIGHT, 'F');

  if (tourLogoUrl) {
    try {
      pdf.addImage(tourLogoUrl, 'PNG', 5, 3, 20, 19);
    } catch (error) {
      console.warn('Error adding tour logo:', error);
    }
  }

  // Título principal
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.setFont(undefined, 'bold');
  const tourName = hojaDeRuta.encabezado_info?.nombre_tour || tourData.name || 'HOJA DE RUTA';
  pdf.text(tourName, pageWidth / 2, 10, { align: 'center' });

  // Subtítulo
  pdf.setFontSize(9);
  pdf.setFont(undefined, 'normal');
  const dateStr = format(new Date(tourDate.date), "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
  const venueStr = `${tourDate.location?.city || ''} - ${tourDate.location?.name || ''}`;
  pdf.text(dateStr, pageWidth / 2, 16, { align: 'center' });
  pdf.text(venueStr, pageWidth / 2, 21, { align: 'center' });

  pdf.setTextColor(0, 0, 0);

  // ============================================================================
  // SECCIÓN: AT A GLANCE (3 columnas)
  // ============================================================================
  pdf.setFontSize(9);
  pdf.setFont(undefined, 'bold');
  pdf.setTextColor(...CORPORATE_RED);
  pdf.text('VISTAZO RÁPIDO', MARGIN, currentY);
  currentY += 5;

  const colWidth = (pageWidth - 3 * MARGIN) / 3;
  const tiempos = hojaDeRuta.tiempos_show || {};
  const hotel = hojaDeRuta.hotel_info || {};
  const contactos = hojaDeRuta.local_contacts || [];

  // Columna 1: Tiempos
  pdf.setFontSize(SMALL_FONT);
  pdf.setFont(undefined, 'bold');
  pdf.setTextColor(0, 0, 0);
  let col1Y = currentY;
  pdf.text('TIEMPOS', MARGIN, col1Y);
  col1Y += 4;
  pdf.setFont(undefined, 'normal');

  const tiemposData = [
    ['Soundcheck', tiempos.soundcheck || '-'],
    ['Puertas', tiempos.puertas || '-'],
    ['Soporte', tiempos.soporte_inicio || '-'],
    ['Headliner', tiempos.headliner_inicio || '-'],
    ['Curfew', tiempos.curfew || '-'],
    ['Bus Call', tiempos.bus_call || '-'],
  ];

  tiemposData.forEach(([label, value]) => {
    pdf.setFont(undefined, 'bold');
    pdf.text(`${label}:`, MARGIN, col1Y);
    pdf.setFont(undefined, 'normal');
    pdf.text(value, MARGIN + 20, col1Y);
    col1Y += 3.5;
  });

  // Columna 2: Hotel & Logística
  let col2Y = currentY;
  const col2X = MARGIN + colWidth;
  pdf.setFont(undefined, 'bold');
  pdf.text('HOTEL & LOGÍSTICA', col2X, col2Y);
  col2Y += 4;
  pdf.setFont(undefined, 'normal');

  if (hotel.name) {
    pdf.setFontSize(TINY_FONT);
    pdf.text(hotel.name, col2X, col2Y, { maxWidth: colWidth - 5 });
    col2Y += 3;
    if (hotel.telefono_recepcion) {
      pdf.text(`Tel: ${hotel.telefono_recepcion}`, col2X, col2Y);
      col2Y += 3;
    }
    if (hotel.distancia_venue_km) {
      pdf.text(`Distancia: ${hotel.distancia_venue_km} km`, col2X, col2Y);
      col2Y += 3;
    }
  }

  // Columna 3: Contactos principales
  let col3Y = currentY;
  const col3X = MARGIN + 2 * colWidth;
  pdf.setFontSize(SMALL_FONT);
  pdf.setFont(undefined, 'bold');
  pdf.text('CONTACTOS CLAVE', col3X, col3Y);
  col3Y += 4;
  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(TINY_FONT);

  const contactosClave = contactos.filter(c =>
    ['promoter_rep', 'venue_ops', 'tour_manager', 'security_chief'].includes(c.role)
  ).slice(0, 4);

  contactosClave.forEach((contacto) => {
    pdf.setFont(undefined, 'bold');
    pdf.text(contacto.name, col3X, col3Y, { maxWidth: colWidth - 5 });
    col3Y += 3;
    pdf.setFont(undefined, 'normal');
    if (contacto.mobile || contacto.phone) {
      pdf.text(contacto.mobile || contacto.phone || '', col3X, col3Y);
      col3Y += 3;
    }
  });

  currentY = Math.max(col1Y, col2Y, col3Y) + 3;

  // ============================================================================
  // SECCIÓN: PROGRAMA (Schedule)
  // ============================================================================
  if (hojaDeRuta.program_schedule_json && hojaDeRuta.program_schedule_json.length > 0) {
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(...CORPORATE_RED);
    pdf.text('PROGRAMA DEL DÍA', MARGIN, currentY);
    currentY += 5;

    const programa = hojaDeRuta.program_schedule_json[0];
    const rows = programa?.rows || [];

    if (rows.length > 0) {
      const scheduleData = rows.slice(0, 15).map((row: any) => [
        row.time || '',
        row.item || '',
        row.dept || '',
      ]);

      autoTable(pdf, {
        body: scheduleData,
        startY: currentY,
        theme: 'plain',
        styles: {
          fontSize: SMALL_FONT,
          cellPadding: 1,
        },
        columnStyles: {
          0: { cellWidth: 15, fontStyle: 'bold' },
          1: { cellWidth: pageWidth - 50 },
          2: { cellWidth: 20, halign: 'right' },
        },
        margin: { left: MARGIN, right: MARGIN },
      });

      currentY = (pdf as any).lastAutoTable.finalY + 3;
    }
  }

  // Verificar espacio disponible
  const remainingSpace = pageHeight - FOOTER_HEIGHT - currentY;

  // ============================================================================
  // SECCIÓN: PRODUCCIÓN (Compacto, 2 columnas)
  // ============================================================================
  if (remainingSpace > 30) {
    pdf.setFontSize(8);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(...CORPORATE_RED);
    pdf.text('PRODUCCIÓN', MARGIN, currentY);
    currentY += 4;

    const produccion = hojaDeRuta.detalles_produccion || {};
    pdf.setFontSize(TINY_FONT);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'normal');

    let prodY = currentY;
    const prodCol1X = MARGIN;
    const prodCol2X = pageWidth / 2;

    // Columna 1
    if (produccion.escenario) {
      const esc = produccion.escenario;
      if (esc.ancho_m || esc.profundidad_m || esc.altura_m) {
        pdf.text(
          `Escenario: ${esc.ancho_m || '-'}x${esc.profundidad_m || '-'}x${esc.altura_m || '-'}m`,
          prodCol1X,
          prodY
        );
        prodY += 3;
      }
    }

    if (produccion.rigging?.altura_grid_m) {
      pdf.text(`Grid: ${produccion.rigging.altura_grid_m}m`, prodCol1X, prodY);
      prodY += 3;
    }

    if (produccion.audio?.foh_distancia_m) {
      pdf.text(`FOH: ${produccion.audio.foh_distancia_m}m`, prodCol1X, prodY);
      prodY += 3;
    }

    // Columna 2
    let prodY2 = currentY;
    if (produccion.audio?.limite_spl_db) {
      pdf.text(`SPL Límite: ${produccion.audio.limite_spl_db} dB`, prodCol2X, prodY2);
      prodY2 += 3;
    }

    if (produccion.rigging?.carga_maxima_kg) {
      pdf.text(`Carga Máx: ${produccion.rigging.carga_maxima_kg} kg`, prodCol2X, prodY2);
      prodY2 += 3;
    }

    currentY = Math.max(prodY, prodY2) + 3;
  }

  // ============================================================================
  // SECCIÓN: HOSPITALIDAD + MERCH + SEGURIDAD (Grid 3 columnas)
  // ============================================================================
  if (remainingSpace > 20) {
    pdf.setFontSize(8);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(...CORPORATE_RED);
    pdf.text('OTROS DETALLES', MARGIN, currentY);
    currentY += 4;

    pdf.setFontSize(TINY_FONT);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'normal');

    const detailsY = currentY;
    const detailColWidth = (pageWidth - 4 * MARGIN) / 3;

    // Col 1: Hospitalidad
    let hospY = detailsY;
    const hospitalidad = hojaDeRuta.hospitalidad;
    if (hospitalidad?.catering) {
      const cat = hospitalidad.catering;
      pdf.setFont(undefined, 'bold');
      pdf.text('Catering', MARGIN, hospY);
      hospY += 3;
      pdf.setFont(undefined, 'normal');
      if (cat.almuerzo_personas) {
        pdf.text(`Almuerzo: ${cat.almuerzo_personas}p`, MARGIN, hospY);
        hospY += 3;
      }
      if (cat.cena_personas) {
        pdf.text(`Cena: ${cat.cena_personas}p`, MARGIN, hospY);
        hospY += 3;
      }
    }

    // Col 2: Merchandising
    let merchY = detailsY;
    const merchX = MARGIN + detailColWidth;
    const merch = hojaDeRuta.merchandising;
    if (merch?.porcentaje_venta) {
      pdf.setFont(undefined, 'bold');
      pdf.text('Merch', merchX, merchY);
      merchY += 3;
      pdf.setFont(undefined, 'normal');
      pdf.text(`Comisión: ${merch.porcentaje_venta}%`, merchX, merchY);
      merchY += 3;
      if (merch.ubicacion_mesa) {
        pdf.text(merch.ubicacion_mesa, merchX, merchY, { maxWidth: detailColWidth - 5 });
        merchY += 3;
      }
    }

    // Col 3: Seguridad
    let segY = detailsY;
    const segX = MARGIN + 2 * detailColWidth;
    const seguridad = hojaDeRuta.seguridad;
    if (seguridad?.medicos_en_sitio || seguridad?.postura_seguridad) {
      pdf.setFont(undefined, 'bold');
      pdf.text('Seguridad', segX, segY);
      segY += 3;
      pdf.setFont(undefined, 'normal');
      if (seguridad.medicos_en_sitio) {
        pdf.text('Médicos en sitio', segX, segY);
        segY += 3;
      }
      if (seguridad.postura_seguridad) {
        pdf.text(seguridad.postura_seguridad, segX, segY, { maxWidth: detailColWidth - 5 });
        segY += 3;
      }
    }

    currentY = Math.max(hospY, merchY, segY) + 3;
  }

  // ============================================================================
  // SECCIÓN: NOTAS ESPECIALES
  // ============================================================================
  if (hojaDeRuta.notas_especiales && remainingSpace > 15) {
    const notas = hojaDeRuta.notas_especiales;
    const notasText = [
      notas.invitados_especiales ? `Invitados: ${notas.invitados_especiales}` : '',
      notas.peculiaridades_venue ? `Venue: ${notas.peculiaridades_venue}` : '',
      notas.no_repetir ? `⚠️ No repetir: ${notas.no_repetir}` : '',
    ].filter(Boolean).join(' | ');

    if (notasText) {
      pdf.setFontSize(TINY_FONT);
      pdf.setFont(undefined, 'italic');
      pdf.setTextColor(100, 100, 100);
      pdf.text(notasText, MARGIN, currentY, { maxWidth: pageWidth - 2 * MARGIN });
      currentY += 4;
    }
  }

  // ============================================================================
  // FOOTER
  // ============================================================================
  const footerY = pageHeight - FOOTER_HEIGHT + 5;
  pdf.setFontSize(TINY_FONT);
  pdf.setTextColor(100, 100, 100);
  pdf.text(
    `Generado el ${format(new Date(), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}`,
    MARGIN,
    footerY
  );

  // Logo de la empresa (si existe)
  try {
    const companyLogo = await loadCompanyLogo();
    if (companyLogo) {
      const logoWidth = 30;
      const logoHeight = 10;
      const logoX = (pageWidth - logoWidth) / 2;
      pdf.addImage(companyLogo, 'PNG', logoX, pageHeight - FOOTER_HEIGHT, logoWidth, logoHeight);
    }
  } catch (error) {
    console.warn('Error adding company logo:', error);
  }

  // Guardar PDF
  const fileName = `Hoja_de_Ruta_${tourName.replace(/\s+/g, '_')}_${format(new Date(tourDate.date), 'yyyy-MM-dd')}.pdf`;
  pdf.save(fileName);
}

/**
 * Carga el logo de la empresa
 */
async function loadCompanyLogo(): Promise<string | null> {
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
}
