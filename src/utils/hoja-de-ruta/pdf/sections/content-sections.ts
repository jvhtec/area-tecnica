import { PDFDocument } from '../core/pdf-document';
import { EventData, TravelArrangement, RoomAssignment, Accommodation } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';
import { Formatters } from '../utils/formatters';
import { MapService } from '../services/map-service';
import { QRService } from '../services/qr-service';
import { DEPARTURE_ADDRESS } from '../constants';

export class ContentSections {

  constructor(private pdfDoc: PDFDocument) {}

  addContactsSection(eventData: EventData, yPosition: number): number {
    const validContacts = eventData.contacts?.filter(contact => 
      DataValidators.hasData(contact.name) || 
      DataValidators.hasData(contact.role) || 
      DataValidators.hasData(contact.phone)
    ) || [];
    
    if (validContacts.length === 0) return yPosition;

    yPosition = this.pdfDoc.checkPageBreak(yPosition);
    
    this.pdfDoc.setText(14, [125, 1, 1]);
    this.pdfDoc.addText("Contactos", 20, yPosition);
    yPosition += 10;

    const contactsTableData = validContacts.map((contact) => [
      contact.name || '',
      contact.role || '',
      Formatters.formatPhone(contact.phone || ''),
    ]);
    
    this.pdfDoc.addTable({
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
    
    return this.pdfDoc.getLastAutoTableY() + 15;
  }

  addEventDetailsSection(eventData: EventData, yPosition: number): number {
    yPosition = this.pdfDoc.checkPageBreak(yPosition);
    
    this.pdfDoc.setText(14, [125, 1, 1]);
    this.pdfDoc.addText("Detalles del Evento", 20, yPosition);
    yPosition += 15;
    
    this.pdfDoc.setText(10, [51, 51, 51]);
    
    const details = [
      ['Evento', eventData.eventName],
      ['Fechas', eventData.eventDates],
      ['Cliente', eventData.clientName],
      ['Hora Inicio', eventData.eventStartTime],
      ['Hora Fin', eventData.eventEndTime],
      ['Asistentes Estimados', eventData.estimatedAttendees?.toString()],
      ['Estado', eventData.eventStatus]
    ].filter(([, value]) => DataValidators.hasData(value));

    if (details.length > 0) {
      this.pdfDoc.addTable({
        startY: yPosition,
        body: details,
        theme: "plain",
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
          0: { cellWidth: 40, fontStyle: 'bold', textColor: [125, 1, 1] },
          1: { cellWidth: 140 }
        }
      });
      yPosition = this.pdfDoc.getLastAutoTableY() + 15;
    }
    
    return yPosition;
  }

  addVenueSection(eventData: EventData, venueMapPreview: string | null, yPosition: number): number {
    if (!DataValidators.hasData(eventData.venue?.name) && !DataValidators.hasData(eventData.venue?.address)) {
      return yPosition;
    }

    yPosition = this.pdfDoc.checkPageBreak(yPosition);
    
    this.pdfDoc.setText(14, [125, 1, 1]);
    this.pdfDoc.addText("Información del Lugar", 20, yPosition);
    yPosition += 15;
    
    this.pdfDoc.setText(10, [51, 51, 51]);
    
    const venueDetails = [
      ['Nombre', eventData.venue?.name],
      ['Dirección', eventData.venue?.address],
      ['Tipo', eventData.venueType],
      ['Capacidad', eventData.venueCapacity?.toString()]
    ].filter(([, value]) => DataValidators.hasData(value));

    if (venueDetails.length > 0) {
      this.pdfDoc.addTable({
        startY: yPosition,
        body: venueDetails,
        theme: "plain",
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
          0: { cellWidth: 40, fontStyle: 'bold', textColor: [125, 1, 1] },
          1: { cellWidth: 140 }
        }
      });
      yPosition = this.pdfDoc.getLastAutoTableY() + 10;
    }

    // Add venue map if available
    if (venueMapPreview) {
      try {
        yPosition = this.pdfDoc.checkPageBreak(yPosition, 80);
        const mapWidth = 120;
        const mapHeight = 80;
        this.pdfDoc.addImage(venueMapPreview, "JPEG", 30, yPosition, mapWidth, mapHeight);
        yPosition += mapHeight + 15;
      } catch (error) {
        console.error("Error adding venue map to PDF:", error);
      }
    }
    
    return yPosition;
  }

  async addTravelSection(travelArrangements: TravelArrangement[], yPosition: number): Promise<number> {
    const validTravelArrangements = travelArrangements.filter(DataValidators.hasMeaningfulTravelData);

    if (validTravelArrangements.length === 0) return yPosition;

    yPosition = this.pdfDoc.checkPageBreak(yPosition);
    
    this.pdfDoc.setText(14, [125, 1, 1]);
    this.pdfDoc.addText("Arreglos de Viaje", 20, yPosition);
    yPosition += 15;

    for (const arrangement of validTravelArrangements) {
      yPosition = this.pdfDoc.checkPageBreak(yPosition, 120);
      
      // Travel arrangement header
      this.pdfDoc.setText(12, [125, 1, 1]);
      this.pdfDoc.addText(`Viaje: ${Formatters.translateTransportType(arrangement.transportation_type)}`, 30, yPosition);
      yPosition += 15;

      // Travel details table
      const travelData = [
        ['Tipo', Formatters.translateTransportType(arrangement.transportation_type)],
        ['Recogida', arrangement.pickup_address],
        ['Hora Recogida', Formatters.formatTime(arrangement.pickup_time || '')],
        ['Hora Salida', Formatters.formatTime(arrangement.departure_time || '')],
        ['Hora Llegada', Formatters.formatTime(arrangement.arrival_time || '')],
        ['Vuelo/Tren', arrangement.flight_train_number],
        ['Compañía', arrangement.company],
        ['Conductor', arrangement.driver_name],
        ['Teléfono', Formatters.formatPhone(arrangement.driver_phone || '')],
        ['Matrícula', arrangement.plate_number],
        ['Notas', arrangement.notes]
      ].filter(([, value]) => DataValidators.hasData(value));

      if (travelData.length > 0) {
        this.pdfDoc.addTable({
          startY: yPosition,
          body: travelData,
          theme: "plain",
          styles: { fontSize: 10, cellPadding: 4 },
          columnStyles: {
            0: { cellWidth: 40, fontStyle: 'bold', textColor: [125, 1, 1] },
            1: { cellWidth: 140 }
          }
        });
        yPosition = this.pdfDoc.getLastAutoTableY() + 10;
      }

      // Add pickup map and QR if address is provided
      if (arrangement.pickup_address) {
        await this.addPickupMapAndQR(arrangement.pickup_address, yPosition);
        yPosition += 100; // Account for map and QR space
      }
    }
    
    return yPosition;
  }

  private async addPickupMapAndQR(pickupAddress: string, yPosition: number): Promise<void> {
    try {
      // Try to geocode and add static OSM map
      const coords = await MapService.geocodeAddress(pickupAddress);
      if (coords) {
        const mapDataUrl = await MapService.getStaticMapDataUrl(coords.lat, coords.lng);
        if (mapDataUrl) {
          yPosition = this.pdfDoc.checkPageBreak(yPosition, 100);
          
          this.pdfDoc.setText(11, [125, 1, 1]);
          this.pdfDoc.addText('Mapa de Recogida:', 20, yPosition);
          yPosition += 10;
          
          try {
            const mapWidth = 160;
            const mapHeight = 80;
            this.pdfDoc.addImage(mapDataUrl, 'JPEG', 25, yPosition, mapWidth, mapHeight);
          } catch (err) {
            console.error('Error adding pickup map:', err);
          }
        }
      }

      // Generate QR to Google Maps route
      const pickupRouteUrl = MapService.generateRouteUrl(DEPARTURE_ADDRESS, pickupAddress);
      const pickupQrDataUrl = await QRService.generateQRCode(pickupRouteUrl);
      if (pickupQrDataUrl) {
        const { width: pageWidth } = this.pdfDoc.dimensions;
        yPosition = this.pdfDoc.checkPageBreak(yPosition, 70);

        const qrSize = 50;
        this.pdfDoc.addImage(pickupQrDataUrl, 'PNG', 25, yPosition, qrSize, qrSize);

        // Info box
        this.pdfDoc.document.setDrawColor(200, 200, 200);
        this.pdfDoc.document.setLineWidth(0.3);
        this.pdfDoc.document.rect(85, yPosition, 110, qrSize);
        this.pdfDoc.setFillColor(248, 249, 250);
        this.pdfDoc.addRect(85, yPosition, 110, 15, 'F');

        this.pdfDoc.setText(10, [125, 1, 1]);
        this.pdfDoc.addText('Ruta a Recogida', 90, yPosition + 10);

        this.pdfDoc.setText(8, [51, 51, 51]);
        this.pdfDoc.addText('Escanea para obtener', 90, yPosition + 25);
        this.pdfDoc.addText('direcciones en Google Maps', 90, yPosition + 35);
      }
    } catch (error) {
      console.error('Error adding pickup map and QR:', error);
    }
  }

  addAccommodationSection(accommodations: Accommodation[], eventData: EventData, yPosition: number): number {
    const validAccommodations = accommodations.filter(acc => 
      DataValidators.hasData(acc.hotel_name) || acc.rooms.some(DataValidators.hasMeaningfulRoomData)
    );

    if (validAccommodations.length === 0) return yPosition;

    yPosition = this.pdfDoc.checkPageBreak(yPosition);
    
    this.pdfDoc.setText(14, [125, 1, 1]);
    this.pdfDoc.addText("Alojamiento", 20, yPosition);
    yPosition += 15;

    for (const accommodation of validAccommodations) {
      if (DataValidators.hasData(accommodation.hotel_name)) {
        this.pdfDoc.setText(12, [125, 1, 1]);
        this.pdfDoc.addText(accommodation.hotel_name!, 30, yPosition);
        yPosition += 12;
      }

      if (DataValidators.hasData(accommodation.address)) {
        this.pdfDoc.setText(10, [51, 51, 51]);
        this.pdfDoc.addText(`Dirección: ${accommodation.address}`, 35, yPosition);
        yPosition += 10;
      }

      const checkInfo = [];
      if (accommodation.check_in) checkInfo.push(`Check-in: ${accommodation.check_in}`);
      if (accommodation.check_out) checkInfo.push(`Check-out: ${accommodation.check_out}`);
      
      if (checkInfo.length > 0) {
        this.pdfDoc.addText(checkInfo.join(' | '), 35, yPosition);
        yPosition += 15;
      }

      // Room assignments
      const validRooms = accommodation.rooms.filter(DataValidators.hasMeaningfulRoomData);
      if (validRooms.length > 0) {
        const roomData = validRooms.map(room => [
          room.room_type || 'N/A',
          room.room_number || 'Por asignar',
          Formatters.getStaffName(room.staff_member1_id || '', eventData.staff),
          Formatters.getStaffName(room.staff_member2_id || '', eventData.staff)
        ]);

        this.pdfDoc.addTable({
          startY: yPosition,
          head: [["Tipo", "Habitación", "Huésped 1", "Huésped 2"]],
          body: roomData,
          theme: "grid",
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: {
            fillColor: [125, 1, 1],
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: 'bold'
          }
        });
        yPosition = this.pdfDoc.getLastAutoTableY() + 15;
      }
    }

    return yPosition;
  }

  addStaffSection(eventData: EventData, yPosition: number): number {
    const validStaff = eventData.staff?.filter(staff => 
      DataValidators.hasData(staff.name) || 
      DataValidators.hasData(staff.position) || 
      DataValidators.hasData(staff.department)
    ) || [];

    if (validStaff.length === 0) return yPosition;

    yPosition = this.pdfDoc.checkPageBreak(yPosition);
    
    this.pdfDoc.setText(14, [125, 1, 1]);
    this.pdfDoc.addText("Personal", 20, yPosition);
    yPosition += 10;

    const staffData = validStaff.map(staff => [
      `${staff.name || ''} ${staff.surname1 || ''} ${staff.surname2 || ''}`.trim(),
      staff.position || '',
      staff.department || '',
      Formatters.formatPhone(staff.phone || '')
    ]);

    this.pdfDoc.addTable({
      startY: yPosition,
      head: [["Nombre", "Posición", "Departamento", "Teléfono"]],
      body: staffData,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold'
      }
    });

    return this.pdfDoc.getLastAutoTableY() + 15;
  }

  addScheduleSection(eventData: EventData, yPosition: number): number {
    if (!DataValidators.hasData(eventData.schedule) && 
        !DataValidators.hasData(eventData.powerRequirements) && 
        !DataValidators.hasData(eventData.auxiliaryNeeds)) {
      return yPosition;
    }

    yPosition = this.pdfDoc.checkPageBreak(yPosition);
    
    this.pdfDoc.setText(14, [125, 1, 1]);
    this.pdfDoc.addText("Programa y Requerimientos", 20, yPosition);
    yPosition += 15;

    this.pdfDoc.setText(10, [51, 51, 51]);

    if (DataValidators.hasData(eventData.schedule)) {
      this.pdfDoc.setText(12, [125, 1, 1]);
      this.pdfDoc.addText("Programa:", 30, yPosition);
      yPosition += 12;
      
      this.pdfDoc.setText(10, [51, 51, 51]);
      const scheduleLines = eventData.schedule!.split('\n');
      for (const line of scheduleLines) {
        this.pdfDoc.addText(line, 35, yPosition);
        yPosition += 8;
      }
      yPosition += 10;
    }

    if (DataValidators.hasData(eventData.powerRequirements)) {
      this.pdfDoc.setText(12, [125, 1, 1]);
      this.pdfDoc.addText("Requerimientos de Energía:", 30, yPosition);
      yPosition += 12;
      
      this.pdfDoc.setText(10, [51, 51, 51]);
      const powerLines = eventData.powerRequirements!.split('\n');
      for (const line of powerLines) {
        this.pdfDoc.addText(line, 35, yPosition);
        yPosition += 8;
      }
      yPosition += 10;
    }

    if (DataValidators.hasData(eventData.auxiliaryNeeds)) {
      this.pdfDoc.setText(12, [125, 1, 1]);
      this.pdfDoc.addText("Necesidades Auxiliares:", 30, yPosition);
      yPosition += 12;
      
      this.pdfDoc.setText(10, [51, 51, 51]);
      const auxLines = eventData.auxiliaryNeeds!.split('\n');
      for (const line of auxLines) {
        this.pdfDoc.addText(line, 35, yPosition);
        yPosition += 8;
      }
    }

    return yPosition;
  }
}