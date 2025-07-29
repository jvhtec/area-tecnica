
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { EventData, TravelArrangement, RoomAssignment } from "@/types/hoja-de-ruta";
import { supabase } from "@/lib/supabase";

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
  uploadPdfToJob: (jobId: string, pdfBlob: Blob, fileName: string) => Promise<void>
) => {
  const doc = new jsPDF() as AutoTableJsPDF;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const bottomMargin = 40;

  const checkPageBreak = (currentY: number): number => {
    if (currentY > pageHeight - bottomMargin) {
      doc.addPage();
      return 40; // Account for header space
    }
    return currentY;
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

  // === HEADER SECTION === (consistent with tour PDF)
  doc.setFillColor(125, 1, 1); // Red header background
  doc.rect(0, 0, pageWidth, 30, 'F');

  // Header text (white text on red background)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("Hoja de Ruta", pageWidth / 2, 15, { align: "center" });
  
  doc.setFontSize(12);
  doc.text(eventData.eventName, pageWidth / 2, 25, { align: "center" });

  let yPosition = 40;
  
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

  // === CONTACTS SECTION ===
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
        fillColor: [125, 1, 1], // Same red as header
        textColor: [255, 255, 255],
        fontSize: 11,
        fontStyle: 'bold',
      },
      margin: { left: 10, right: 10 },
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // === LOGISTICS SECTION ===
  const logisticsData = [
    { label: "Transporte:", value: eventData.logistics.transport },
    { label: "Detalles de Carga:", value: eventData.logistics.loadingDetails },
    { label: "Detalles de Descarga:", value: eventData.logistics.unloadingDetails },
  ].filter(item => hasData(item.value));

  if (logisticsData.length > 0) {
    yPosition = checkPageBreak(yPosition);
    doc.setFontSize(14);
    doc.setTextColor(125, 1, 1);
    doc.text("Logística", 20, yPosition);
    yPosition += 10;
    
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

  // === TRAVEL ARRANGEMENTS SECTION === (improved filtering)
  const validTravelArrangements = travelArrangements.filter(hasMeaningfulTravelData);

  if (validTravelArrangements.length > 0) {
    yPosition = checkPageBreak(yPosition);
    doc.setFontSize(14);
    doc.setTextColor(125, 1, 1);
    doc.text("Arreglos de Viaje", 20, yPosition);
    yPosition += 10;
    
    const travelTableData = validTravelArrangements.map((arr) => [
      arr.transportation_type || "",
      `${arr.pickup_address || ""} ${arr.pickup_time || ""}`.trim(),
      arr.departure_time || "",
      arr.arrival_time || "",
      arr.flight_train_number || "",
      arr.notes || "",
    ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [["Transporte", "Recogida", "Salida", "Llegada", "Vuelo/Tren #", "Notas"]],
      body: travelTableData,
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

  // === ROOM ASSIGNMENTS SECTION === (improved filtering)
  const validRoomAssignments = roomAssignments.filter(hasMeaningfulRoomData);

  if (validRoomAssignments.length > 0) {
    yPosition = checkPageBreak(yPosition);
    doc.setFontSize(14);
    doc.setTextColor(125, 1, 1);
    doc.text("Asignaciones de Habitaciones", 20, yPosition);
    yPosition += 10;
    
    const roomTableData = validRoomAssignments.map((room) => [
      room.room_type || "",
      room.room_number || "",
      room.staff_member1_id || "",
      room.room_type === "double" ? room.staff_member2_id || "" : "",
    ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [["Tipo de Habitación", "Número", "Personal 1", "Personal 2"]],
      body: roomTableData,
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
    yPosition = 20;
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
          yPosition = 20;
          currentX = 20;
        }
      } catch (error) {
        console.error("Error al agregar la imagen:", error);
        continue;
      }
    }
  }

  const logo = new Image();
  logo.crossOrigin = "anonymous";
  logo.src = "/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png";
  
  logo.onload = () => {
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      const logoWidth = 50;
      const logoHeight = logoWidth * (logo.height / logo.width);
      const xPositionLogo = (pageWidth - logoWidth) / 2;
      const yPositionLogo = pageHeight - logoHeight - 10;
      doc.addImage(logo, "PNG", xPositionLogo, yPositionLogo, logoWidth, logoHeight);
    }
    const blob = doc.output("blob");
    const fileName = `hoja_de_ruta_${jobTitle.replace(/\s+/g, "_")}.pdf`;
    uploadPdfToJob(selectedJobId, blob, fileName);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  logo.onerror = () => {
    console.error("No se pudo cargar el logo");
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hoja_de_ruta_${eventData.eventName.replace(/\s+/g, "_")}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };
};
