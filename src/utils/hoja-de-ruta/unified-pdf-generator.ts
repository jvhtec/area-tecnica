import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as QRCode from 'qrcode';
import { uploadPdfToJob } from './pdf-upload';
import { supabase } from '@/integrations/supabase/client';
import { fetchJobLogo } from '@/utils/pdf/logoUtils';

// Types
interface AutoTableJsPDF extends jsPDF {
  lastAutoTable: { finalY: number };
}

interface WeatherData {
  date: string;
  condition: string;
  weatherCode: number;
  maxTemp: number;
  minTemp: number;
  precipitationProbability: number;
  icon: string;
}

interface EventData {
  eventName?: string;
  eventCode?: string;
  eventType?: string;
  clientName?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  setupTime?: string;
  dismantleTime?: string;
  estimatedAttendees?: number;
  actualAttendees?: number;
  budget?: number;
  actualCost?: number;
  currency?: string;
  eventStatus?: string;
  venue?: {
    name?: string;
    address?: string;
  };
  venueType?: string;
  venueCapacity?: number;
  venueContact?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  contacts?: Array<{
    name?: string;
    role?: string;
    phone?: string;
    email?: string;
  }>;
  staff?: Array<{
    id?: string;
    name?: string;
    surname1?: string;
    surname2?: string;
    position?: string;
    phone?: string;
    dni?: string;
    department?: string;
    role?: string;
  }>;
  logistics?: {
    transport?: Array<{
      transport_type?: string;
      driver_name?: string;
      driver_phone?: string;
      license_plate?: string;
      departure_time?: string;
      arrival_time?: string;
    }>;
    loadingDetails?: string;
    unloadingDetails?: string;
    equipmentLogistics?: string;
  };
  schedule?: string;
  powerRequirements?: string;
  auxiliaryNeeds?: string;
  weather?: WeatherData[];
}

interface TravelArrangement {
  transportation_type?: string;
  pickup_address?: string;
  pickup_time?: string;
  departure_time?: string;
  arrival_time?: string;
  flight_train_number?: string;
  company?: string;
  driver_name?: string;
  driver_phone?: string;
  plate_number?: string;
  notes?: string;
}

interface RoomAssignment {
  room_type?: string;
  room_number?: string;
  staff_member1_id?: string;
  staff_member2_id?: string;
}

interface ImagePreviews {
  venue: string[];
}

interface Accommodation {
  hotel_name?: string;
  address?: string;
  check_in?: string;
  check_out?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  rooms: RoomAssignment[];
}

// Constants
const DEPARTURE_ADDRESS = "Calle Puerto Rico 6, 28971, Spain";

// Helper functions
const generateRouteUrl = (origin: string, destination: string): string => {
  const baseUrl = "https://www.google.com/maps/dir/";
  const encodedOrigin = encodeURIComponent(origin);
  const encodedDestination = encodeURIComponent(destination);
  return `${baseUrl}${encodedOrigin}/${encodedDestination}`;
};

const generateQRCode = async (text: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(text, {
      width: 200,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' }
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};

const formatCurrency = (amount: number, currency: string = 'EUR'): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

const formatPhone = (phone: string): string => {
  if (!phone) return 'N/A';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
};

// Translation function for transportation types
const translateTransportType = (type: string | undefined): string => {
  if (!type) return 'N/A';
  
  const translations: Record<string, string> = {
    'van': 'Furgoneta',
    'sleeper_bus': 'Autobús Cama',
    'train': 'Tren',
    'plane': 'Avión',
    'RV': 'Autocaravana',
    'trailer': 'Trailer',
    '9m': '9m',
    '8m': '8m',
    '6m': '6m',
    '4m': '4m',
    'furgoneta': 'Furgoneta'
  };
  
  return translations[type] || type;
};

const formatTime = (time: string): string => {
  if (!time) return 'N/A';
  try {
    return format(new Date(`2000-01-01T${time}`), 'HH:mm');
  } catch {
    return time;
  }
};

// Helper function to get staff name by ID
const getStaffName = (staffId: string, staffData?: any[]): string => {
  if (!staffId || !staffData) return 'Por asignar';
  
  // Check if staffId is a numeric string (array index)
  const numericIndex = parseInt(staffId);
  if (!isNaN(numericIndex) && numericIndex >= 0 && numericIndex < staffData.length) {
    const staff = staffData[numericIndex];
    if (staff) {
      // Try to get name from different possible structures
      if (staff.profiles) {
        return `${staff.profiles.first_name || ''} ${staff.profiles.last_name || ''}`.trim();
      }
      if (staff.name || staff.surname1) {
        return `${staff.name || ''} ${staff.surname1 || ''} ${staff.surname2 || ''}`.trim();
      }
      if (staff.first_name || staff.last_name) {
        return `${staff.first_name || ''} ${staff.last_name || ''}`.trim();
      }
    }
  }
  
  // Try to find by exact ID match
  let staff = staffData.find(s => s.id === staffId || s.id?.toString() === staffId);
  
  // If not found, try different ID fields that might be used
  if (!staff) {
    staff = staffData.find(s => 
      s.user_id === staffId || 
      s.technician_id === staffId ||
      s.staff_id === staffId ||
      s.user_id?.toString() === staffId ||
      s.technician_id?.toString() === staffId ||
      s.staff_id?.toString() === staffId
    );
  }
  
  // Try to find by profile data if staff has profiles
  if (!staff) {
    staff = staffData.find(s => 
      s.profiles?.id === staffId || 
      s.profiles?.user_id === staffId ||
      s.profiles?.id?.toString() === staffId ||
      s.profiles?.user_id?.toString() === staffId
    );
  }
  
  // If not found, try to find by name (in case staffId is actually a name)
  if (!staff && typeof staffId === 'string' && staffId !== 'Por asignar') {
    staff = staffData.find(s => {
      const fullName = `${s.name || ''} ${s.surname1 || ''} ${s.surname2 || ''}`.trim();
      const profileName = s.profiles ? 
        `${s.profiles.first_name || ''} ${s.profiles.last_name || ''}`.trim() : '';
      
      return fullName.toLowerCase() === staffId.toLowerCase() ||
             s.name?.toLowerCase() === staffId.toLowerCase() ||
             profileName.toLowerCase() === staffId.toLowerCase();
    });
  }
  
  if (staff) {
    // Try to get name from different possible structures
    if (staff.profiles) {
      return `${staff.profiles.first_name || ''} ${staff.profiles.last_name || ''}`.trim();
    }
    if (staff.name || staff.surname1) {
      return `${staff.name || ''} ${staff.surname1 || ''} ${staff.surname2 || ''}`.trim();
    }
    if (staff.first_name || staff.last_name) {
      return `${staff.first_name || ''} ${staff.last_name || ''}`.trim();
    }
  }
  
  // If staffId looks like a name (contains letters), return it as is, otherwise show "Por asignar"
  if (typeof staffId === 'string' && /[a-zA-Z]/.test(staffId)) {
    return staffId;
  }
  
  return 'Por asignar';
};

// Data validation helpers
const hasMeaningfulTravelData = (arrangement: TravelArrangement): boolean => {
  return !!(arrangement.transportation_type?.trim() && (
    arrangement.pickup_address?.trim() ||
    arrangement.pickup_time?.trim() ||
    arrangement.departure_time?.trim() ||
    arrangement.arrival_time?.trim() ||
    arrangement.flight_train_number?.trim()
  ));
};

const hasMeaningfulRoomData = (room: RoomAssignment): boolean => {
  return !!(room.room_type?.trim() && (
    room.room_number?.trim() ||
    room.staff_member1_id?.trim() ||
    room.staff_member2_id?.trim()
  ));
};

export const generatePDF = async (
  eventData: EventData,
  travelArrangements: TravelArrangement[],
  roomAssignments: RoomAssignment[],
  imagePreviews: ImagePreviews,
  venueMapPreview: string | null,
  selectedJobId: string,
  jobTitle: string,
  toast: any,
  accommodations?: Accommodation[]
): Promise<void> => {
  const doc = new jsPDF() as AutoTableJsPDF;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const createdDate = new Date().toLocaleDateString('es-ES');
  const footerSpace = 40;

  // Load job logo using the proper utility function
  let jobLogo: HTMLImageElement | null = null;
  try {
    const logoUrl = await fetchJobLogo(selectedJobId);
    console.log('Fetched logo URL:', logoUrl);
    
    if (logoUrl) {
      jobLogo = new Image();
      jobLogo.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        if (jobLogo) {
          jobLogo.onload = () => {
            console.log('Logo loaded successfully:', logoUrl);
            resolve(null);
          };
          jobLogo.onerror = (error) => {
            console.log('Logo failed to load:', error);
            resolve(null); // Fail silently
          };
          jobLogo.src = logoUrl;
        } else {
          resolve(null);
        }
      });
    }
  } catch (error) {
    console.log('No job logo found, continuing without it:', error);
  }

  // Format job date
  const jobDateStr = format(new Date(), 'dd/MM/yyyy', { locale: es });

  // Generate route URL and QR code
  let routeUrl = '';
  let qrCodeDataUrl = '';

  if (eventData.venue?.address) {
    routeUrl = generateRouteUrl(DEPARTURE_ADDRESS, eventData.venue.address);
    try {
      qrCodeDataUrl = await generateQRCode(routeUrl);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    }
  }

  // Enhanced header setup
  const setupHeader = (pageTitle?: string) => {
    // Main header background
    doc.setFillColor(125, 1, 1);
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    // Status indicator
    if (eventData.eventStatus) {
      const statusColors = {
        draft: [255, 193, 7],
        confirmed: [40, 167, 69],
        cancelled: [220, 53, 69],
        completed: [108, 117, 125]
      };
      const color = statusColors[eventData.eventStatus] || [128, 128, 128];
      doc.setFillColor(color[0], color[1], color[2]);
      doc.roundedRect(pageWidth - 65, 5, 55, 10, 2, 2, 'F');
      
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(eventData.eventStatus.toUpperCase(), pageWidth - 37.5, 11, { align: 'center' });
    }

    // Job logo
    if (jobLogo) {
      const logoHeight = 8;
      const logoWidth = logoHeight * (jobLogo.width / jobLogo.height);
      try {
        doc.addImage(jobLogo, 'PNG', 10, 8, logoWidth, logoHeight);
      } catch (error) {
        console.error("Error adding job logo to header:", error);
      }
    }

    // Header text
    doc.setFontSize(26);
    doc.setTextColor(255, 255, 255);
    doc.text(pageTitle || 'Hoja de Ruta', pageWidth / 2, 22, { align: 'center' });

    doc.setFontSize(16);
    doc.text(eventData.eventName || jobTitle || 'Evento sin título', pageWidth / 2, 32, { align: 'center' });

    doc.setFontSize(11);
    doc.text(jobDateStr, pageWidth / 2, 41, { align: 'center' });
  };

  // Page break management
  const checkPageBreak = (currentY: number, requiredHeight: number = 25): number => {
    if (currentY + requiredHeight > pageHeight - footerSpace) {
      doc.addPage();
      setupHeader();
      return 75;
    }
    return currentY;
  };

  // Enhanced section header
  const addSectionHeader = (title: string, yPosition: number): number => {
    doc.setFillColor(248, 249, 250);
    doc.rect(14, yPosition - 5, pageWidth - 28, 15, 'F');
    
    doc.setDrawColor(125, 1, 1);
    doc.setLineWidth(0.8);
    doc.line(14, yPosition - 5, pageWidth - 14, yPosition - 5);
    
    doc.setFontSize(14);
    doc.setTextColor(125, 1, 1);
    doc.text(title, 20, yPosition + 4);
    
    return yPosition + 20;
  };

  // Generate cover page
  const generateCoverPage = () => {
    // Background gradient effect
    doc.setFillColor(125, 1, 1);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    
    // Add decorative elements
    doc.setFillColor(255, 255, 255, 0.1);
    doc.circle(pageWidth - 30, 30, 50, 'F');
    doc.circle(30, pageHeight - 50, 40, 'F');

    // Job logo on cover
    if (jobLogo) {
      const logoHeight = 30;
      const logoWidth = logoHeight * (jobLogo.width / jobLogo.height);
      try {
        doc.addImage(jobLogo, 'PNG', (pageWidth - logoWidth) / 2, 40, logoWidth, logoHeight);
      } catch (error) {
        console.error("Error adding job logo to cover:", error);
      }
    }

    // Main title
    doc.setFontSize(32);
    doc.setTextColor(255, 255, 255);
    doc.text('HOJA DE RUTA', pageWidth / 2, 100, { align: 'center' });
    
    // Event name
    doc.setFontSize(24);
    doc.text(eventData.eventName || jobTitle || 'Evento', pageWidth / 2, 125, { align: 'center' });
    
    // Date
    doc.setFontSize(16);
    doc.text(jobDateStr, pageWidth / 2, 145, { align: 'center' });
    
    // Client
    if (eventData.clientName) {
      doc.setFontSize(14);
      doc.text(`Cliente: ${eventData.clientName}`, pageWidth / 2, 165, { align: 'center' });
    }

    // Footer info
    doc.setFontSize(10);
    doc.text(`Generado: ${createdDate}`, pageWidth / 2, pageHeight - 30, { align: 'center' });
    doc.text('Documento confidencial', pageWidth / 2, pageHeight - 20, { align: 'center' });
  };

  // Event overview section
  const addEventOverview = (yPosition: number): number => {
    yPosition = checkPageBreak(yPosition, 80);
    yPosition = addSectionHeader('Resumen del Evento', yPosition);

    const overviewData = [];
    
    if (eventData.eventCode) overviewData.push(['Código del Evento', eventData.eventCode]);
    if (eventData.eventType) overviewData.push(['Tipo de Evento', eventData.eventType]);
    if (eventData.clientName) overviewData.push(['Cliente', eventData.clientName]);
    overviewData.push(['Fecha', jobDateStr]);
    if (eventData.eventStartTime || eventData.eventEndTime) {
      overviewData.push(['Horario', `${formatTime(eventData.eventStartTime)} - ${formatTime(eventData.eventEndTime)}`]);
    }
    if (eventData.setupTime) overviewData.push(['Hora de Montaje', formatTime(eventData.setupTime)]);
    if (eventData.dismantleTime) overviewData.push(['Hora de Desmontaje', formatTime(eventData.dismantleTime)]);
    if (eventData.estimatedAttendees) overviewData.push(['Asistentes Estimados', eventData.estimatedAttendees.toString()]);
    if (eventData.actualAttendees) overviewData.push(['Asistentes Reales', eventData.actualAttendees.toString()]);
    if (eventData.budget) overviewData.push(['Presupuesto', formatCurrency(eventData.budget, eventData.currency)]);
    if (eventData.actualCost) overviewData.push(['Coste Real', formatCurrency(eventData.actualCost, eventData.currency)]);

    if (overviewData.length > 0) {
      autoTable(doc, {
        startY: yPosition,
        body: overviewData,
        theme: 'striped',
        styles: {
          fontSize: 10,
          cellPadding: 5,
          lineColor: [220, 220, 230],
          lineWidth: 0.1,
        },
        alternateRowStyles: { fillColor: [250, 250, 255] },
        columnStyles: {
          0: { cellWidth: 60, fontStyle: 'bold', textColor: [125, 1, 1] },
          1: { cellWidth: 120 }
        }
      });
      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }

    return yPosition;
  };

  // Route information section
  const addRouteSection = (yPosition: number): number => {
    if (!routeUrl || !qrCodeDataUrl) return yPosition;

    yPosition = checkPageBreak(yPosition, 120);
    yPosition = addSectionHeader('Información de Ruta', yPosition);

    doc.setFontSize(11);
    doc.setTextColor(51, 51, 51);
    doc.text(`Origen: ${DEPARTURE_ADDRESS}`, 25, yPosition);
    yPosition += 7;
    doc.text(`Destino: ${eventData.venue?.address || 'N/A'}`, 25, yPosition);
    yPosition += 15;

    try {
      const qrSize = 50;
      doc.addImage(qrCodeDataUrl, 'PNG', 25, yPosition, qrSize, qrSize);
      
      // Information box
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.rect(85, yPosition, 110, qrSize);
      doc.setFillColor(248, 249, 250);
      doc.rect(85, yPosition, 110, 15, 'F');
      
      doc.setFontSize(10);
      doc.setTextColor(125, 1, 1);
      doc.text('Navegación GPS', 90, yPosition + 10);
      
      doc.setFontSize(9);
      doc.setTextColor(51, 51, 51);
      doc.text('• Escanea el QR con tu móvil', 90, yPosition + 22);
      doc.text('• Se abre Google Maps automáticamente', 90, yPosition + 30);
      doc.text('• Navegación paso a paso incluida', 90, yPosition + 38);
      
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 255);
      doc.textWithLink('🔗 Abrir en navegador', 90, yPosition + 46, { url: routeUrl });
      
      yPosition += qrSize + 25;
    } catch (error) {
      console.error('Error adding QR code:', error);
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 255);
      doc.textWithLink('Ver ruta en Google Maps', 25, yPosition, { url: routeUrl });
      yPosition += 20;
    }

    return yPosition;
  };

  // Venue section
  const addVenueSection = (yPosition: number): number => {
    yPosition = checkPageBreak(yPosition);
    yPosition = addSectionHeader('Información del Lugar', yPosition);

    const venueData = [];
    if (eventData.venue?.name) venueData.push(['Nombre', eventData.venue.name]);
    if (eventData.venue?.address) venueData.push(['Dirección', eventData.venue.address]);
    if (eventData.venueType) venueData.push(['Tipo', eventData.venueType]);
    if (eventData.venueCapacity) venueData.push(['Capacidad', eventData.venueCapacity.toString() + ' personas']);
    
    if (eventData.venueContact) {
      venueData.push(['Contacto', eventData.venueContact.name]);
      venueData.push(['Teléfono', formatPhone(eventData.venueContact.phone)]);
      venueData.push(['Email', eventData.venueContact.email]);
    }

    if (venueData.length > 0) {
      autoTable(doc, {
        startY: yPosition,
        body: venueData,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
          0: { cellWidth: 40, fontStyle: 'bold', textColor: [125, 1, 1] },
          1: { cellWidth: 140 }
        }
      });
      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }

    // Route section
    yPosition = addRouteSection(yPosition);

    // Venue map
    if (venueMapPreview) {
      yPosition = checkPageBreak(yPosition, 85);
      try {
        const mapWidth = 160;
        const mapHeight = 80;
        doc.addImage(venueMapPreview, 'JPEG', 25, yPosition, mapWidth, mapHeight);
        yPosition += mapHeight + 15;
      } catch (error) {
        console.error("Error adding venue map:", error);
      }
    }

    return yPosition;
  };

  // Contacts section
  const addContactsSection = (yPosition: number): number => {
    if (!eventData.contacts || eventData.contacts.length === 0) return yPosition;

    yPosition = checkPageBreak(yPosition, 60);
    yPosition = addSectionHeader('Contactos', yPosition);

    const contactsTableData = eventData.contacts.map(contact => [
      contact.name || 'N/A',
      contact.role || 'N/A',
      formatPhone(contact.phone) || 'N/A',
      contact.email || 'N/A'
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Nombre', 'Rol', 'Teléfono', 'Email']],
      body: contactsTableData,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 35 },
        2: { cellWidth: 35 },
        3: { cellWidth: 65 }
      }
    });

    return (doc as any).lastAutoTable.finalY + 15;
  };

  // Staff section
  const addStaffSection = (yPosition: number): number => {
    const staff = eventData.staff;
    if (!staff || staff.length === 0) return yPosition;

    yPosition = checkPageBreak(yPosition, 80);
    yPosition = addSectionHeader('Personal Asignado', yPosition);

    const staffTableData = staff.map(person => [
      `${person.name} ${person.surname1} ${person.surname2 || ''}`.trim(),
      person.position || 'N/A',
      person.dni || 'N/A',
      person.department || 'N/A',
      formatPhone(person.phone || ''),
      person.role || person.position || 'N/A'
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Nombre Completo', 'Puesto', 'DNI', 'Departamento', 'Teléfono', 'Rol en Evento']],
      body: staffTableData,
      theme: 'grid',
      styles: { 
        fontSize: 8, 
        cellPadding: 3,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
        5: { cellWidth: 35 }
      }
    });

    return (doc as any).lastAutoTable.finalY + 15;
  };

  // Travel arrangements section
  const addTravelSection = (yPosition: number): Promise<number> => {
    return new Promise(async (resolve) => {
      const validTravelArrangements = travelArrangements.filter(hasMeaningfulTravelData);

      if (validTravelArrangements.length === 0) {
        resolve(yPosition);
        return;
      }

      yPosition = checkPageBreak(yPosition, 60);
      yPosition = addSectionHeader('Viaje', yPosition);

      for (const arrangement of validTravelArrangements) {
        yPosition = checkPageBreak(yPosition, 120);
        
        // Travel arrangement header
        doc.setFontSize(12);
        doc.setTextColor(125, 1, 1);
        doc.text(`${translateTransportType(arrangement.transportation_type) || 'Transporte'}`, 20, yPosition);
        yPosition += 15;

        // Travel details table with all fields
        const travelData = [];
        if (arrangement.transportation_type) travelData.push(['Tipo', translateTransportType(arrangement.transportation_type)]);
        if (arrangement.pickup_address) travelData.push(['Dirección Recogida', arrangement.pickup_address]);
        if (arrangement.pickup_time) travelData.push(['Hora Recogida', arrangement.pickup_time]);
        if (arrangement.departure_time) travelData.push(['Hora Salida', arrangement.departure_time]);
        if (arrangement.arrival_time) travelData.push(['Hora Llegada', arrangement.arrival_time]);
        if (arrangement.flight_train_number) travelData.push(['Vuelo/Tren', arrangement.flight_train_number]);
        if (arrangement.company) travelData.push(['Compañía', arrangement.company]);
        if (arrangement.driver_name) travelData.push(['Conductor', arrangement.driver_name]);
        if (arrangement.driver_phone) travelData.push(['Teléfono Conductor', formatPhone(arrangement.driver_phone)]);
        if (arrangement.plate_number) travelData.push(['Matrícula', arrangement.plate_number]);

        if (travelData.length > 0) {
          autoTable(doc, {
            startY: yPosition,
            body: travelData,
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 4 },
            columnStyles: {
              0: { cellWidth: 50, fontStyle: 'bold', textColor: [125, 1, 1] },
              1: { cellWidth: 130 }
            }
          });
          yPosition = (doc as any).lastAutoTable.finalY + 10;
        }

        // Notes section
        if (arrangement.notes) {
          yPosition = checkPageBreak(yPosition, 40);
          doc.setFontSize(11);
          doc.setTextColor(125, 1, 1);
          doc.text('Notas:', 20, yPosition);
          yPosition += 10;

          doc.setFontSize(10);
          doc.setTextColor(51, 51, 51);
          const notesLines = doc.splitTextToSize(arrangement.notes, pageWidth - 40);
          doc.text(notesLines, 20, yPosition);
          yPosition += notesLines.length * 7 + 15;
        }
      }

      resolve(yPosition);
    });
  };

  // Accommodation section with proper name resolution
  const addAccommodationSection = async (yPosition: number): Promise<number> => {
    if (!accommodations || accommodations.length === 0) return yPosition;

    yPosition = checkPageBreak(yPosition, 80);
    yPosition = addSectionHeader('Alojamiento', yPosition);

    for (const accommodation of accommodations) {
      yPosition = checkPageBreak(yPosition, 120);
      
      // Hotel header
      doc.setFontSize(12);
      doc.setTextColor(125, 1, 1);
      doc.text(accommodation.hotel_name || 'Hotel sin nombre', 20, yPosition);
      yPosition += 15;

      // Hotel details table
      const hotelData = [];
      if (accommodation.hotel_name) hotelData.push(['Hotel', accommodation.hotel_name]);
      if (accommodation.address) hotelData.push(['Dirección', accommodation.address]);
      if (accommodation.check_in) hotelData.push(['Check-in', accommodation.check_in]);
      if (accommodation.check_out) hotelData.push(['Check-out', accommodation.check_out]);

      if (hotelData.length > 0) {
        autoTable(doc, {
          startY: yPosition,
          body: hotelData,
          theme: 'plain',
          styles: { fontSize: 10, cellPadding: 4 },
          columnStyles: {
            0: { cellWidth: 40, fontStyle: 'bold', textColor: [125, 1, 1] },
            1: { cellWidth: 140 }
          }
        });
        yPosition = (doc as any).lastAutoTable.finalY + 10;
      }

      // Hotel location map and QR code
      console.log('Checking hotel location data:', {
        coordinates: accommodation.coordinates,
        address: accommodation.address,
        hasCoordinates: !!accommodation.coordinates,
        hasAddress: !!accommodation.address
      });
      
      if (accommodation.coordinates && accommodation.address) {
        yPosition = checkPageBreak(yPosition, 200);
        
        try {
          // Generate hotel location URL (not route)
          const hotelLocationUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(accommodation.address)}`;
          
          // Generate QR code for hotel location
          const hotelQrCode = await generateQRCode(hotelLocationUrl);
          
          // Generate hotel map image
          const lat = accommodation.coordinates.lat;
          const lng = accommodation.coordinates.lng;
          console.log('Hotel coordinates:', { lat, lng });
          
          // Fetch Google Maps API key securely
          const { data: secretData, error: secretError } = await supabase.functions.invoke('get-secret', {
            body: { secretName: 'GOOGLE_MAPS_API_KEY' }
          });
          if (secretError) {
            console.error('Failed to fetch Google Maps API key:', secretError);
          }
          const apiKey = (secretData && (secretData as any).GOOGLE_MAPS_API_KEY) || '';
          const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=640x320&markers=color:red%7C${lat},${lng}&key=${apiKey}`;
          console.log('Hotel map URL:', mapUrl);
          
          let hotelMapImage = null;
          try {
            console.log('Fetching hotel map from:', mapUrl);
            const mapResponse = await fetch(mapUrl);
            console.log('Hotel map response status:', mapResponse.status, mapResponse.statusText);
            
            if (mapResponse.ok) {
              const mapBlob = await mapResponse.blob();
              console.log('Hotel map blob size:', mapBlob.size);
              hotelMapImage = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                  console.log('Hotel map image data URL created');
                  resolve(reader.result as string);
                };
                reader.onerror = reject;
                reader.readAsDataURL(mapBlob);
              });
            } else {
              console.error('Failed to fetch hotel map:', mapResponse.status, mapResponse.statusText);
            }
          } catch (mapError) {
            console.error('Error loading hotel map image:', mapError);
          }
          
          doc.setFontSize(11);
          doc.setTextColor(125, 1, 1);
          doc.text('Ubicación del Hotel:', 20, yPosition);
          yPosition += 15;

          // Add hotel map if available
          if (hotelMapImage) {
            console.log('Adding hotel map to PDF');
            yPosition = checkPageBreak(yPosition, 100);
            try {
              const mapWidth = 160;
              const mapHeight = 80;
              doc.addImage(hotelMapImage, 'JPEG', 25, yPosition, mapWidth, mapHeight);
              yPosition += mapHeight + 15;
              console.log('Hotel map added successfully');
            } catch (error) {
              console.error("Error adding hotel map to PDF:", error);
            }
          } else {
            console.log('No hotel map image available');
          }

          // Add QR code and information
          yPosition = checkPageBreak(yPosition, 60);
          const qrSize = 50;
          doc.addImage(hotelQrCode, 'PNG', 25, yPosition, qrSize, qrSize);
          
          // Information box
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.3);
          doc.rect(85, yPosition, 110, qrSize);
          doc.setFillColor(248, 249, 250);
          doc.rect(85, yPosition, 110, 15, 'F');
          
          doc.setFontSize(10);
          doc.setTextColor(125, 1, 1);
          doc.text('Ubicación del Hotel', 90, yPosition + 10);
          
          doc.setFontSize(9);
          doc.setTextColor(51, 51, 51);
          doc.text('• Escanea el QR para ver ubicación', 90, yPosition + 22);
          doc.text('• Se abre Google Maps directamente', 90, yPosition + 30);
          doc.text('• Muestra la ubicación exacta del hotel', 90, yPosition + 38);
          
          doc.setFontSize(8);
          doc.setTextColor(0, 0, 255);
          doc.textWithLink('🔗 Ver ubicación', 90, yPosition + 46, { url: hotelLocationUrl });
          
          yPosition += qrSize + 20;
        } catch (error) {
          console.error('Error generating hotel location QR:', error);
        }
      }

      // Room assignments with proper names
      const validRooms = accommodation.rooms.filter(hasMeaningfulRoomData);
      if (validRooms.length > 0) {
        yPosition = checkPageBreak(yPosition, 60);
        
        doc.setFontSize(11);
        doc.setTextColor(125, 1, 1);
        doc.text('Asignación de Habitaciones:', 20, yPosition);
        yPosition += 10;

        const roomTableData = validRooms.map(room => [
          room.room_type || 'N/A',
          room.room_number || 'N/A',
          getStaffName(room.staff_member1_id, eventData.staff),
          getStaffName(room.staff_member2_id, eventData.staff)
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Tipo de Habitación', 'Número', 'Ocupante 1', 'Ocupante 2']],
          body: roomTableData,
          theme: 'grid',
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: {
            fillColor: [125, 1, 1],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          },
          columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 25 },
            2: { cellWidth: 60 },
            3: { cellWidth: 60 }
          }
        });
        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }
    }

    return yPosition;
  };

  // Logistics section with complete transport details
  const addLogisticsSection = (yPosition: number): number => {
    if (!eventData.logistics) return yPosition;

    yPosition = checkPageBreak(yPosition, 60);
    yPosition = addSectionHeader('Logística', yPosition);

    // Transport details in table format
    if (eventData.logistics.transport && eventData.logistics.transport.length > 0) {
      yPosition = checkPageBreak(yPosition, 80);
      
      doc.setFontSize(11);
      doc.setTextColor(125, 1, 1);
      doc.text('Transporte:', 20, yPosition);
      yPosition += 10;

      const transportTableData = eventData.logistics.transport.map(transport => [
        translateTransportType(transport.transport_type),
        transport.driver_name || 'N/A',
        formatPhone(transport.driver_phone) || 'N/A',
        transport.license_plate || 'N/A',
        transport.departure_time || 'N/A',
        transport.arrival_time || 'N/A'
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['Tipo', 'Conductor', 'Teléfono', 'Matrícula', 'Salida', 'Llegada']],
        body: transportTableData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: {
          fillColor: [125, 1, 1],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 35 },
          2: { cellWidth: 25 },
          3: { cellWidth: 25 },
          4: { cellWidth: 20 },
          5: { cellWidth: 20 }
        }
      });
      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }

    // Other logistics details
    const logisticsItems = [
      { label: 'Detalles de Carga:', value: eventData.logistics.loadingDetails },
      { label: 'Detalles de Descarga:', value: eventData.logistics.unloadingDetails },
      { label: 'Logística de Equipamiento:', value: eventData.logistics.equipmentLogistics }
    ];

    logisticsItems.forEach(item => {
      if (item.value) {
        yPosition = checkPageBreak(yPosition);
        doc.setFontSize(11);
        doc.setTextColor(125, 1, 1);
        doc.text(item.label, 20, yPosition);
        yPosition += 7;

        doc.setFontSize(10);
        doc.setTextColor(51, 51, 51);
        const lines = doc.splitTextToSize(item.value, pageWidth - 40);
        doc.text(lines, 20, yPosition);
        yPosition += lines.length * 7 + 10;
      }
    });

    return yPosition;
  };

  // Weather section
  const addWeatherSection = (yPosition: number): number => {
    if (!eventData.weather || eventData.weather.length === 0) return yPosition;

    yPosition = checkPageBreak(yPosition, 80);
    yPosition = addSectionHeader('Previsión Meteorológica', yPosition);

    const weatherTableData = eventData.weather.map(day => {
      const date = new Date(day.date);
      const formattedDate = date.toLocaleDateString('es-ES', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      
      return [
        formattedDate,
        day.condition,
        `${day.maxTemp}°C / ${day.minTemp}°C`,
        `${day.precipitationProbability}%`
      ];
    });

    autoTable(doc, {
      startY: yPosition,
      head: [['Fecha', 'Condición', 'Temperatura', 'Lluvia']],
      body: weatherTableData,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: {
        fillColor: [14, 165, 233], // Sky blue color
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 65 },
        2: { cellWidth: 50 },
        3: { cellWidth: 30 }
      }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;

    // Add weather source note
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('Fuente: Open-Meteo API', 20, yPosition);
    yPosition += 15;

    return yPosition;
  };
  const addScheduleSection = (yPosition: number): number => {
    if (!eventData.schedule) return yPosition;

    yPosition = checkPageBreak(yPosition);
    yPosition = addSectionHeader('Programa del Evento', yPosition);

    doc.setFontSize(10);
    doc.setTextColor(51, 51, 51);
    const scheduleLines = doc.splitTextToSize(eventData.schedule, pageWidth - 28);
    doc.text(scheduleLines, 14, yPosition);
    yPosition += scheduleLines.length * 7 + 15;

    return yPosition;
  };

  // Technical requirements section
  const addTechnicalSection = (yPosition: number): number => {
    if (!eventData.powerRequirements && !eventData.auxiliaryNeeds) return yPosition;

    yPosition = checkPageBreak(yPosition);
    yPosition = addSectionHeader('Requisitos Técnicos', yPosition);

    if (eventData.powerRequirements) {
      doc.setFontSize(12);
      doc.setTextColor(125, 1, 1);
      doc.text('Requisitos Eléctricos:', 20, yPosition);
      yPosition += 7;

      doc.setFontSize(10);
      doc.setTextColor(51, 51, 51);
      const powerLines = doc.splitTextToSize(eventData.powerRequirements, pageWidth - 40);
      doc.text(powerLines, 20, yPosition);
      yPosition += powerLines.length * 7 + 10;
    }

    if (eventData.auxiliaryNeeds) {
      yPosition = checkPageBreak(yPosition);
      doc.setFontSize(12);
      doc.setTextColor(125, 1, 1);
      doc.text('Necesidades Auxiliares:', 20, yPosition);
      yPosition += 7;

      doc.setFontSize(10);
      doc.setTextColor(51, 51, 51);
      const auxLines = doc.splitTextToSize(eventData.auxiliaryNeeds, pageWidth - 40);
      doc.text(auxLines, 20, yPosition);
      yPosition += auxLines.length * 7 + 10;
    }

    return yPosition;
  };

  // Images page generation
  const generateImagesPage = () => {
    if (imagePreviews.venue.length > 0) {
      doc.addPage();
      setupHeader('Imágenes del Lugar');
      let yPosition = 80;

      const imageWidth = 80;
      const imageHeight = 60;
      const imagesPerRow = 2;
      const spacing = 10;
      let currentX = 20;
      let imagesInCurrentRow = 0;

      imagePreviews.venue.forEach((image, index) => {
        try {
          yPosition = checkPageBreak(yPosition, imageHeight + 20);
          doc.addImage(image, 'PNG', currentX, yPosition, imageWidth, imageHeight);

          // Add image caption
          doc.setFontSize(8);
          doc.setTextColor(51, 51, 51);
          doc.text(`Imagen ${index + 1}`, currentX + imageWidth/2, yPosition + imageHeight + 8, { align: 'center' });

          imagesInCurrentRow++;
          
          if (imagesInCurrentRow < imagesPerRow) {
            currentX += imageWidth + spacing;
          } else {
            // Move to next row
            currentX = 20;
            imagesInCurrentRow = 0;
            yPosition += imageHeight + 25;
          }
        } catch (error) {
          console.error(`Error adding image ${index + 1}:`, error);
        }
      });
    }
  };

  // Main content generation
  const generateMainContent = async (): Promise<void> => {
    return new Promise(async (resolve) => {
      // Cover page
      generateCoverPage();
      
      // Main content
      doc.addPage();
      setupHeader('Hoja de Ruta');
      let yPosition = 80;

      yPosition = addEventOverview(yPosition);
      yPosition = addVenueSection(yPosition);
      yPosition = addWeatherSection(yPosition);
      yPosition = addContactsSection(yPosition);
      yPosition = addStaffSection(yPosition);
      yPosition = await addTravelSection(yPosition);
      yPosition = await addAccommodationSection(yPosition);
      yPosition = addLogisticsSection(yPosition);
      yPosition = addScheduleSection(yPosition);
      yPosition = addTechnicalSection(yPosition);

      resolve();
    });
  };

  // Footer generation with Sector Pro logo
  const addFooter = async () => {
    const pageCount = doc.internal.pages.length;
    
    // Load Sector Pro logo using the same approach as other working PDF generators
    let sectorProLogo: HTMLImageElement | null = null;
    try {
      const logo = new Image();
      logo.crossOrigin = "anonymous";
      
      // Try the known working logo paths
      const logoAttempts = [
        "/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png",
        "/sector pro logo.png"
      ];
      
      for (const logoPath of logoAttempts) {
        try {
          const loadResult = await new Promise<boolean>((resolve) => {
            logo.onload = () => resolve(true);
            logo.onerror = () => resolve(false);
            logo.src = logoPath;
          });
          
          if (loadResult) {
            sectorProLogo = logo;
            console.log(`Sector Pro logo loaded successfully from: ${logoPath}`);
            break;
          }
        } catch (error) {
          console.log(`Failed to load logo from: ${logoPath}`);
        }
      }
    } catch (error) {
      console.log('Sector Pro logo not found, continuing without it');
    }
    
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Page number
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${i} de ${pageCount - 1}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      
      // Sector Pro logo in bottom right
      if (sectorProLogo) {
        try {
          const logoHeight = 8;
          const logoWidth = logoHeight * (sectorProLogo.width / sectorProLogo.height);
          doc.addImage(sectorProLogo, 'PNG', pageWidth - logoWidth - 10, pageHeight - 15, logoWidth, logoHeight);
        } catch (error) {
          console.error("Error adding Sector Pro logo to footer:", error);
        }
      }
    }
  };

  // Main execution
  try {
    await generateMainContent();
    generateImagesPage();
    await addFooter();

    // Generate filename and save
    const fileName = `hoja-de-ruta-${eventData.eventName?.replace(/[^a-zA-Z0-9]/g, '_') || 'evento'}-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.pdf`;
    const pdfBlob = doc.output('blob');

    // Upload to job storage
    await uploadPdfToJob(selectedJobId, pdfBlob, fileName);

    // Download for user
    const link = document.createElement('a');
    link.href = URL.createObjectURL(pdfBlob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    toast({
      title: "✅ PDF generado exitosamente",
      description: `El documento "${fileName}" ha sido creado y descargado.`,
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    toast({
      title: "❌ Error al generar PDF",
      description: "Hubo un problema al crear el documento.",
      variant: "destructive",
    });
    throw error;
  }
};
