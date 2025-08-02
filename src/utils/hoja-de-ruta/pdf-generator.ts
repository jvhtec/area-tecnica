
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { EventData, TravelArrangement, RoomAssignment, Accommodation } from "@/types/hoja-de-ruta";
import { supabase } from "@/lib/supabase";
import * as QRCode from 'qrcode';

interface AutoTableJsPDF extends jsPDF {
  lastAutoTable: { finalY: number };
}

export const generatePDF = async (
  eventData: EventData,
  travelArrangements: TravelArrangement[],
  roomAssignments: RoomAssignment[],
  imagePreviews: { venue: string[] },
  venueMapPreview: string | null,
  selectedJobId: string,
  jobTitle: string,
  uploadPdfToJob: (jobId: string, pdfBlob: Blob, fileName: string) => Promise<void>,
  accommodations?: Accommodation[]
) => {
  const doc = new jsPDF() as AutoTableJsPDF;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const bottomMargin = 40;

  // Track logo loading state
  let logoLoaded = false;
  let logoData: string | null = null;

  // Load logo at the beginning
  const loadLogo = async (): Promise<void> => {
    try {
      // First check for job logo
      const { data: jobData } = await supabase
        .from('jobs')
        .select('logo_url')
        .eq('id', selectedJobId)
        .single();
      
      if (jobData?.logo_url) {
        const logoResponse = await fetch(jobData.logo_url);
        if (logoResponse.ok) {
          const logoBlob = await logoResponse.blob();
          const reader = new FileReader();
          
          await new Promise<void>((resolve) => {
            reader.onload = () => {
              logoData = reader.result as string;
              logoLoaded = true;
              resolve();
            };
            reader.onerror = () => {
              console.error("Error reading job logo");
              resolve();
            };
            reader.readAsDataURL(logoBlob);
          });
          return;
        }
      }

      // If no job logo, try festival logos
      const { data: festivalLogos } = await supabase
        .from('festival_logos')
        .select('file_path, job_id')
        .eq('job_id', selectedJobId)
        .order('uploaded_at', { ascending: false })
        .limit(1);
      
      if (festivalLogos && festivalLogos.length > 0) {
        const logoUrl = supabase.storage.from('festival-logos').getPublicUrl(festivalLogos[0].file_path).data.publicUrl;
        const logoResponse = await fetch(logoUrl);
        if (logoResponse.ok) {
          const logoBlob = await logoResponse.blob();
          const reader = new FileReader();
          
          await new Promise<void>((resolve) => {
            reader.onload = () => {
              logoData = reader.result as string;
              logoLoaded = true;
              resolve();
            };
            reader.onerror = () => {
              console.error("Error reading festival logo");
              resolve();
            };
            reader.readAsDataURL(logoBlob);
          });
          return;
        }
      }

      // Try tour logos by joining with jobs table
      const { data: jobWithTour } = await supabase
        .from('jobs')
        .select('tour_id')
        .eq('id', selectedJobId)
        .single();
      
      if (jobWithTour?.tour_id) {
        const { data: tourLogos } = await supabase
          .from('tour_logos')
          .select('file_path')
          .eq('tour_id', jobWithTour.tour_id)
          .order('uploaded_at', { ascending: false })
          .limit(1);
        
        if (tourLogos && tourLogos.length > 0) {
          const logoUrl = supabase.storage.from('tour-logos').getPublicUrl(tourLogos[0].file_path).data.publicUrl;
          const logoResponse = await fetch(logoUrl);
          if (logoResponse.ok) {
            const logoBlob = await logoResponse.blob();
            const reader = new FileReader();
            
            await new Promise<void>((resolve) => {
              reader.onload = () => {
                logoData = reader.result as string;
                logoLoaded = true;
                resolve();
              };
              reader.onerror = () => {
                console.error("Error reading tour logo");
                resolve();
              };
              reader.readAsDataURL(logoBlob);
            });
          }
        }
      }
    } catch (error) {
      console.error("Error loading logos:", error);
    }
  };

  // Load logo first
  await loadLogo();

  // Helper function to generate QR codes
  const generateQRCode = async (text: string): Promise<string> => {
    try {
      return await QRCode.toDataURL(text, {
        width: 200,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' }
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      return '';
    }
  };

  // Helper function to generate route URL
  const generateRouteUrl = (origin: string, destination: string): string => {
    const baseUrl = "https://www.google.com/maps/dir/";
    const encodedOrigin = encodeURIComponent(origin);
    const encodedDestination = encodeURIComponent(destination);
    return `${baseUrl}${encodedOrigin}/${encodedDestination}`;
  };

  const checkPageBreak = (currentY: number, requiredHeight?: number): number => {
    const minHeight = requiredHeight || 25;
    if (currentY + minHeight > pageHeight - bottomMargin) {
      doc.addPage();
      addHeader();
      return 55; // Account for header space
    }
    return currentY;
  };


  // Enhanced header function with logo
  const addHeader = () => {
    // Main header background
    doc.setFillColor(125, 1, 1);
    doc.rect(0, 0, pageWidth, 45, 'F');

    // Add logo if loaded
    if (logoLoaded && logoData) {
      try {
        const logoHeight = 30;
        const logoImg = new Image();
        logoImg.src = logoData;
        const logoWidth = logoHeight * (logoImg.width / logoImg.height) || 50;
        doc.addImage(logoData, 'PNG', 15, 8, logoWidth, logoHeight);
      } catch (error) {
        console.error("Error adding logo to header:", error);
      }
    }

    // Header text (white text on red background)
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("Hoja de Ruta", pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.text(eventData.eventName || jobTitle, pageWidth / 2, 30, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(new Date().toLocaleDateString('es-ES'), pageWidth / 2, 40, { align: "center" });
  };

  // Helper function to check if data exists with stricter criteria
  const hasData = (value: any): boolean => {
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.length > 0 && value.some(item => hasData(item));
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(val => hasData(val));
    }
    return value !== null && value !== undefined;
  };

  // Helper function to check if travel arrangement has meaningful data
  const hasMeaningfulTravelData = (arrangement: TravelArrangement): boolean => {
    return hasData(arrangement.transportation_type) && (
      hasData(arrangement.pickup_address) || 
      hasData(arrangement.pickup_time) ||
      hasData(arrangement.departure_time) || 
      hasData(arrangement.arrival_time) ||
      hasData(arrangement.flight_train_number)
    );
  };

  // Helper function to check if room assignment has meaningful data
  const hasMeaningfulRoomData = (room: RoomAssignment): boolean => {
    return hasData(room.room_type) && (
      hasData(room.room_number) || 
      hasData(room.staff_member1_id) ||
      hasData(room.staff_member2_id)
    );
  };

  // === COVER PAGE === (festival style)
  doc.setFillColor(125, 1, 1);
  doc.rect(0, pageHeight - 100, pageWidth, 100, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text("HOJA DE RUTA", 20, pageHeight - 60);
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(36);
  doc.text(eventData.eventName || jobTitle, 20, pageHeight / 2 + 50);
  
  doc.setFontSize(16);
  doc.setTextColor(80, 80, 80);
  doc.text(new Date().toLocaleDateString('es-ES'), 20, pageHeight / 2);

  // Add job logo to cover page
  if (logoLoaded && logoData) {
    try {
      const logoWidth = 120;
      const logoImg = new Image();
      logoImg.src = logoData;
      const logoHeight = (logoImg.height / logoImg.width) * logoWidth || 60;
      doc.addImage(logoData, 'PNG', pageWidth - logoWidth - 20, pageHeight / 2 - logoHeight / 2, logoWidth, logoHeight);
    } catch (error) {
      console.error("Error adding logo to cover:", error);
    }
  }

  // Start new page for content
  doc.addPage();
  addHeader();
  let yPosition = 55;
  
  // === CONTACTS SECTION (moved to be second page) ===
  const validContacts = eventData.contacts.filter(contact => 
    hasData(contact.name) || hasData(contact.role) || hasData(contact.phone)
  );
  
  if (validContacts.length > 0) {
    yPosition = checkPageBreak(yPosition);
    doc.setFontSize(14);
    doc.setTextColor(125, 1, 1);
    doc.text("Contactos", 20, yPosition);
    yPosition += 10;

    const contactsTableData = validContacts.map((contact) => [
      contact.name || '',
      contact.role || '',
      contact.phone || '',
    ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [["Nombre", "Rol", "Teléfono"]],
      body: contactsTableData,
      theme: "grid",
      styles: {
        fontSize: 10,
        cellPadding: 3,
        valign: 'top',
      },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
        fontSize: 11,
        fontStyle: 'bold',
      },
      margin: { left: 10, right: 10 },
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // Start new page for event details
  doc.addPage();
  addHeader();
  yPosition = 55;

  // === EVENT DETAILS SECTION ===
  yPosition = checkPageBreak(yPosition);
  doc.setFontSize(14);
  doc.setTextColor(125, 1, 1);
  doc.text("Detalles del Evento", 20, yPosition);
  yPosition += 10;
  
  doc.setFontSize(10);
  doc.setTextColor(51, 51, 51);
  
  if (hasData(eventData.eventDates)) {
    doc.text(`Fechas: ${eventData.eventDates}`, 30, yPosition);
    yPosition += 8;
  }
  
  yPosition += 5;

  // === VENUE INFORMATION ===
  if (hasData(eventData.venue.name) || hasData(eventData.venue.address)) {
    yPosition = checkPageBreak(yPosition);
    doc.setFontSize(14);
    doc.setTextColor(125, 1, 1);
    doc.text("Información del Lugar", 20, yPosition);
    yPosition += 10;
    
    doc.setFontSize(10);
    doc.setTextColor(51, 51, 51);
    
    if (hasData(eventData.venue.name)) {
      doc.text(`Nombre: ${eventData.venue.name}`, 30, yPosition);
      yPosition += 8;
    }
    
    if (hasData(eventData.venue.address)) {
      doc.text(`Dirección: ${eventData.venue.address}`, 30, yPosition);
      yPosition += 8;
    }
    
    yPosition += 10;
  }

  if (venueMapPreview) {
    try {
      const mapWidth = 100;
      const mapHeight = 60;
      doc.addImage(venueMapPreview, "JPEG", 30, yPosition, mapWidth, mapHeight);
      yPosition += mapHeight + 10;
    } catch (error) {
      console.error("Error al agregar el mapa del lugar al PDF:", error);
    }
  }

  // === TRAVEL ARRANGEMENTS SECTION WITH PICKUP MAPS === 
  const validTravelArrangements = travelArrangements.filter(hasMeaningfulTravelData);

  if (validTravelArrangements.length > 0) {
    yPosition = checkPageBreak(yPosition);
    doc.setFontSize(14);
    doc.setTextColor(125, 1, 1);
    doc.text("Arreglos de Viaje", 20, yPosition);
    yPosition += 10;

    for (const arrangement of validTravelArrangements) {
      yPosition = checkPageBreak(yPosition, 120);
      
      // Travel arrangement header
      doc.setFontSize(12);
      doc.setTextColor(125, 1, 1);
      doc.text(`Viaje: ${arrangement.transportation_type || 'N/A'}`, 30, yPosition);
      yPosition += 15;

      // Travel details table
      const travelData = [];
      if (arrangement.pickup_address) travelData.push(['Recogida', arrangement.pickup_address]);
      if (arrangement.pickup_time) travelData.push(['Hora Recogida', arrangement.pickup_time]);
      if (arrangement.departure_time) travelData.push(['Hora Salida', arrangement.departure_time]);
      if (arrangement.arrival_time) travelData.push(['Hora Llegada', arrangement.arrival_time]);
      if (arrangement.flight_train_number) travelData.push(['Vuelo/Tren', arrangement.flight_train_number]);
      if (arrangement.driver_name) travelData.push(['Conductor', arrangement.driver_name]);
      if (arrangement.driver_phone) travelData.push(['Teléfono', arrangement.driver_phone]);
      if (arrangement.plate_number) travelData.push(['Matrícula', arrangement.plate_number]);
      if (arrangement.notes) travelData.push(['Notas', arrangement.notes]);

      if (travelData.length > 0) {
        autoTable(doc, {
          startY: yPosition,
          body: travelData,
          theme: "plain",
          styles: { fontSize: 10, cellPadding: 4 },
          columnStyles: {
            0: { cellWidth: 40, fontStyle: 'bold', textColor: [125, 1, 1] },
            1: { cellWidth: 140 }
          }
        });
        yPosition = (doc as any).lastAutoTable.finalY + 10;
      }

      // Generate QR code for pickup location
      if (arrangement.pickup_address) {
        try {
          const pickupRouteUrl = generateRouteUrl("Calle Puerto Rico 6, 28971, Spain", arrangement.pickup_address);
          const pickupQrDataUrl = await generateQRCode(pickupRouteUrl);
          
          if (pickupQrDataUrl) {
            yPosition = checkPageBreak(yPosition, 80);
            
            // Add QR code and pickup info
            const qrSize = 50;
            doc.addImage(pickupQrDataUrl, 'PNG', 30, yPosition, qrSize, qrSize);
            
            // Information box for pickup
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            doc.rect(90, yPosition, 100, qrSize);
            doc.setFillColor(248, 249, 250);
            doc.rect(90, yPosition, 100, 15, 'F');
            
            doc.setFontSize(10);
            doc.setTextColor(125, 1, 1);
            doc.text('Mapa de Recogida', 95, yPosition + 10);
            
            doc.setFontSize(9);
            doc.setTextColor(51, 51, 51);
            doc.text('• Escanea para ver ruta', 95, yPosition + 22);
            doc.text('• Navegación GPS incluida', 95, yPosition + 30);
            
            yPosition += qrSize + 20;
          }
        } catch (error) {
          console.error('Error generating pickup QR:', error);
        }
      }
    }
  }

  // === LOGISTICS SECTION ===
  const hasTransportData = eventData.logistics.transport && Array.isArray(eventData.logistics.transport) && eventData.logistics.transport.length > 0;
  const logisticsData = [
    { label: "Detalles de Carga:", value: eventData.logistics.loadingDetails },
    { label: "Detalles de Descarga:", value: eventData.logistics.unloadingDetails },
  ].filter(item => hasData(item.value));

  if (hasTransportData || logisticsData.length > 0) {
    yPosition = checkPageBreak(yPosition);
    doc.setFontSize(14);
    doc.setTextColor(125, 1, 1);
    doc.text("Logística", 20, yPosition);
    yPosition += 10;

    // Transport table if available
    if (hasTransportData) {
      const transportTableData = eventData.logistics.transport.map((transport) => [
        transport.transport_type || '',
        transport.driver_name || '',
        transport.driver_phone || '',
        transport.license_plate || '',
        transport.date_time || '',
        transport.return_date_time || ''
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [["Tipo", "Conductor", "Teléfono", "Matrícula", "Fecha/Hora", "Retorno"]],
        body: transportTableData,
        theme: "grid",
        styles: {
          fontSize: 9,
          cellPadding: 3,
          valign: 'top',
        },
        headStyles: {
          fillColor: [125, 1, 1],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold',
        },
        margin: { left: 10, right: 10 },
      });
      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }
    
    // Other logistics details
    doc.setFontSize(10);
    doc.setTextColor(51, 51, 51);
    
    logisticsData.forEach((item) => {
      doc.setFont(undefined, 'bold');
      doc.text(item.label, 30, yPosition);
      doc.setFont(undefined, 'normal');
      
      const lines = doc.splitTextToSize(item.value, pageWidth - 60);
      doc.text(lines, 30, yPosition + 8);
      yPosition += lines.length * 8 + 12;
      yPosition = checkPageBreak(yPosition);
    });
    
    yPosition += 5;
  }

  // === STAFF SECTION ===
  const validStaff = eventData.staff.filter(person => 
    hasData(person.name) || hasData(person.surname1) || hasData(person.surname2) || hasData(person.position)
  );

  if (validStaff.length > 0) {
    yPosition = checkPageBreak(yPosition);
    doc.setFontSize(14);
    doc.setTextColor(125, 1, 1);
    doc.text("Lista de Personal", 20, yPosition);
    yPosition += 10;

    const staffTableData = validStaff.map((person) => [
      person.name || '',
      person.surname1 || '',
      person.surname2 || '',
      person.position || '',
    ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [["Nombre", "Primer Apellido", "Segundo Apellido", "Puesto"]],
      body: staffTableData,
      theme: "grid",
      styles: {
        fontSize: 10,
        cellPadding: 3,
        valign: 'top',
      },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
        fontSize: 11,
        fontStyle: 'bold',
      },
      margin: { left: 10, right: 10 },
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // === ACCOMMODATION SECTION WITH HOTEL MAPS AND QR CODES ===
  if (accommodations && accommodations.length > 0) {
    yPosition = checkPageBreak(yPosition);
    doc.setFontSize(14);
    doc.setTextColor(125, 1, 1);
    doc.text("Alojamiento", 20, yPosition);
    yPosition += 10;

    for (const accommodation of accommodations) {
      yPosition = checkPageBreak(yPosition, 120);
      
      // Hotel header
      doc.setFontSize(12);
      doc.setTextColor(125, 1, 1);
      doc.text(`Hotel: ${accommodation.hotel_name || 'Hotel sin nombre'}`, 30, yPosition);
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
          theme: "plain",
          styles: { fontSize: 10, cellPadding: 4 },
          columnStyles: {
            0: { cellWidth: 40, fontStyle: 'bold', textColor: [125, 1, 1] },
            1: { cellWidth: 140 }
          }
        });
        yPosition = (doc as any).lastAutoTable.finalY + 10;
      }

      // Generate QR code for hotel location
      if (accommodation.address) {
        try {
          const hotelRouteUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(accommodation.address)}`;
          const hotelQrDataUrl = await generateQRCode(hotelRouteUrl);
          
          if (hotelQrDataUrl) {
            yPosition = checkPageBreak(yPosition, 80);
            
            // Add QR code and location info
            const qrSize = 50;
            doc.addImage(hotelQrDataUrl, 'PNG', 30, yPosition, qrSize, qrSize);
            
            // Information box for hotel
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            doc.rect(90, yPosition, 100, qrSize);
            doc.setFillColor(248, 249, 250);
            doc.rect(90, yPosition, 100, 15, 'F');
            
            doc.setFontSize(10);
            doc.setTextColor(125, 1, 1);
            doc.text('Ubicación del Hotel', 95, yPosition + 10);
            
            doc.setFontSize(9);
            doc.setTextColor(51, 51, 51);
            doc.text('• Escanea para ver ubicación', 95, yPosition + 22);
            doc.text('• Navegación directa', 95, yPosition + 30);
            
            yPosition += qrSize + 20;
          }
        } catch (error) {
          console.error('Error generating hotel QR:', error);
        }
      }

      // Room assignments for this hotel
      if (accommodation.rooms && accommodation.rooms.length > 0) {
        yPosition = checkPageBreak(yPosition);
        
        doc.setFontSize(11);
        doc.setTextColor(125, 1, 1);
        doc.text("Asignación de Habitaciones:", 30, yPosition);
        yPosition += 10;

        // Helper to get staff name from ID or name
        const getStaffName = (staffId: string): string => {
          if (!staffId) return "";
          
          // Try to find staff member by ID first
          const staffById = eventData.staff.find(s => (s as any).id === staffId);
          if (staffById) {
            return `${staffById.name || ''} ${staffById.surname1 || ''} ${staffById.surname2 || ''}`.trim();
          }
          
          // Try to find by name components matching the ID
          const staffByName = eventData.staff.find(s => {
            const fullName = `${s.name || ''} ${s.surname1 || ''} ${s.surname2 || ''}`.trim();
            return fullName === staffId || s.name === staffId;
          });
          if (staffByName) {
            return `${staffByName.name || ''} ${staffByName.surname1 || ''} ${staffByName.surname2 || ''}`.trim();
          }
          
          // Try to find by index if staffId is a number
          const staffIndex = parseInt(staffId);
          if (!isNaN(staffIndex) && eventData.staff[staffIndex]) {
            const staff = eventData.staff[staffIndex];
            return `${staff.name || ''} ${staff.surname1 || ''} ${staff.surname2 || ''}`.trim();
          }
          
          // Return the original value if it looks like a name, otherwise return empty
          return staffId.length > 2 ? staffId : "";
        };

        const roomTableData = accommodation.rooms.map((room) => [
          room.room_type || "",
          room.room_number || "",
          getStaffName(room.staff_member1_id || ""),
          room.room_type === "double" ? getStaffName(room.staff_member2_id || "") : "",
        ]);
        
        autoTable(doc, {
          startY: yPosition,
          head: [["Tipo", "Número", "Personal 1", "Personal 2"]],
          body: roomTableData,
          theme: "grid",
          styles: {
            fontSize: 9,
            cellPadding: 3,
            valign: 'top',
          },
          headStyles: {
            fillColor: [125, 1, 1],
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: 'bold',
          },
          margin: { left: 25, right: 25 },
        });
        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }
    }
  }

  // Skip the duplicate room assignments section since it's already handled in accommodations

  // === SCHEDULE SECTION ===
  if (hasData(eventData.schedule)) {
    yPosition = checkPageBreak(yPosition);
    doc.setFontSize(14);
    doc.setTextColor(125, 1, 1);
    doc.text("Programa", 20, yPosition);
    yPosition += 10;
    
    doc.setFontSize(10);
    doc.setTextColor(51, 51, 51);
    const scheduleLines = doc.splitTextToSize(eventData.schedule, pageWidth - 40);
    doc.text(scheduleLines, 30, yPosition);
    yPosition += scheduleLines.length * 8 + 15;
  }

  // === POWER REQUIREMENTS SECTION ===
  if (hasData(eventData.powerRequirements)) {
    yPosition = checkPageBreak(yPosition);
    doc.setFontSize(14);
    doc.setTextColor(125, 1, 1);
    doc.text("Requisitos Eléctricos", 20, yPosition);
    yPosition += 10;
    
    doc.setFontSize(10);
    doc.setTextColor(51, 51, 51);
    const powerLines = doc.splitTextToSize(eventData.powerRequirements, pageWidth - 40);
    doc.text(powerLines, 30, yPosition);
    yPosition += powerLines.length * 8 + 15;
  }

  // === AUXILIARY NEEDS SECTION ===
  if (hasData(eventData.auxiliaryNeeds)) {
    yPosition = checkPageBreak(yPosition);
    doc.setFontSize(14);
    doc.setTextColor(125, 1, 1);
    doc.text("Necesidades Auxiliares", 20, yPosition);
    yPosition += 10;
    
    doc.setFontSize(10);
    doc.setTextColor(51, 51, 51);
    const auxLines = doc.splitTextToSize(eventData.auxiliaryNeeds, pageWidth - 40);
    doc.text(auxLines, 30, yPosition);
    yPosition += auxLines.length * 8 + 15;
  }

  if (imagePreviews.venue.length > 0) {
    doc.addPage();
    addHeader();
    yPosition = 55;
    
    doc.setFontSize(14);
    doc.setTextColor(125, 1, 1);
    doc.text("Imágenes del Lugar", 20, yPosition);
    yPosition += 20;
    
    const imageWidth = 80;
    const imagesPerRow = 2;
    let currentX = 20;
    for (let i = 0; i < imagePreviews.venue.length; i++) {
      try {
        doc.addImage(imagePreviews.venue[i], "JPEG", currentX, yPosition, imageWidth, 60);
        if ((i + 1) % imagesPerRow === 0) {
          yPosition += 70;
          currentX = 20;
        } else {
          currentX += imageWidth + 10;
        }
        if (yPosition > pageHeight - bottomMargin && i < imagePreviews.venue.length - 1) {
          doc.addPage();
          addHeader();
          yPosition = 75;
          currentX = 20;
        }
      } catch (error) {
        console.error("Error al agregar la imagen:", error);
        continue;
      }
    }
  }

  // Add footer with Sector Pro logo on all pages
  const addFooterLogo = async () => {
    const logo = new Image();
    logo.crossOrigin = "anonymous";
    logo.src = "/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png";
    
    return new Promise<void>((resolve) => {
      logo.onload = () => {
        try {
          const totalPages = doc.getNumberOfPages();
          for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            const logoWidth = 40;
            const logoHeight = logoWidth * (logo.height / logo.width);
            const xPositionLogo = (pageWidth - logoWidth) / 2;
            const yPositionLogo = pageHeight - logoHeight - 5;
            doc.addImage(logo, "PNG", xPositionLogo, yPositionLogo, logoWidth, logoHeight);
            
            // Add page numbers
            doc.setFontSize(8);
            doc.setTextColor(128, 128, 128);
            doc.text(`Página ${i}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
          }
          console.log("Sector Pro logo added successfully to all pages");
          resolve();
        } catch (error) {
          console.error("Error adding Sector Pro logo:", error);
          resolve();
        }
      };
      
      logo.onerror = () => {
        console.error("No se pudo cargar el logo de Sector Pro");
        resolve();
      };
    });
  };

  // Add footer logo and then finalize PDF
  await addFooterLogo();
  
  const blob = doc.output("blob");
  const fileName = `hoja_de_ruta_${jobTitle.replace(/\s+/g, "_")}.pdf`;
  await uploadPdfToJob(selectedJobId, blob, fileName);
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};
