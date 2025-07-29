import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { EnhancedEventData, TravelArrangement, RoomAssignment, ImagePreviews, Accommodation } from '@/types/hoja-de-ruta';

interface AutoTableJsPDF extends jsPDF {
  lastAutoTable: { finalY: number };
}

export const generateEnhancedPDF = async (
  eventData: EnhancedEventData,
  travelArrangements: TravelArrangement[],
  roomAssignments: RoomAssignment[],
  imagePreviews: ImagePreviews,
  venueMapPreview: string | null,
  selectedJobId: string,
  jobTitle: string,
  jobDate: string,
  customLogoUrl?: string,
  accommodations?: Accommodation[]
): Promise<Blob> => {
  return new Promise<Blob>((resolve) => {
    const doc = new jsPDF() as AutoTableJsPDF;
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const createdDate = new Date().toLocaleDateString('es-ES');
    const footerSpace = 40;
    const headerLogo = customLogoUrl ? new Image() : null;

    // Format job date properly
    const jobDateStr = jobDate ? format(new Date(jobDate), 'dd/MM/yyyy', { locale: es }) : '';

    // Helper function to check if travel arrangement has meaningful data
    const hasMeaningfulTravelData = (arrangement: TravelArrangement): boolean => {
      return arrangement.transportation_type && arrangement.transportation_type.trim() !== '' && (
        (arrangement.pickup_address && arrangement.pickup_address.trim() !== '') ||
        (arrangement.pickup_time && arrangement.pickup_time.trim() !== '') ||
        (arrangement.departure_time && arrangement.departure_time.trim() !== '') ||
        (arrangement.arrival_time && arrangement.arrival_time.trim() !== '') ||
        (arrangement.flight_train_number && arrangement.flight_train_number.trim() !== '')
      );
    };

    // Helper function to check if room assignment has meaningful data
    const hasMeaningfulRoomData = (room: RoomAssignment): boolean => {
      return room.room_type && room.room_type.trim() !== '' && (
        (room.room_number && room.room_number.trim() !== '') ||
        (room.staff_member1_id && room.staff_member1_id.trim() !== '') ||
        (room.staff_member2_id && room.staff_member2_id.trim() !== '')
      );
    };

    // Header setup function
    const setupHeader = (pageTitle?: string) => {
      doc.setFillColor(125, 1, 1);
      doc.rect(0, 0, pageWidth, 40, 'F');

      // Add custom logo to header if available
      if (headerLogo && customLogoUrl) {
        const logoHeight = 7.5;
        const logoWidth = logoHeight * (headerLogo.width / headerLogo.height);
        try {
          doc.addImage(headerLogo, 'PNG', 10, 5, logoWidth, logoHeight);
        } catch (error) {
          console.error("Error adding custom logo to header:", error);
        }
      }

      doc.setFontSize(24);
      doc.setTextColor(255, 255, 255);
      doc.text(pageTitle || 'Hoja de Ruta', pageWidth / 2, 20, { align: 'center' });

      doc.setFontSize(16);
      doc.text(eventData.eventName || 'Evento sin título', pageWidth / 2, 30, { align: 'center' });

      doc.setFontSize(12);
      doc.text(`Fecha del Evento: ${jobDateStr}`, pageWidth / 2, 38, { align: 'center' });
    };

    // Page break checker
    const checkPageBreak = (currentY: number, requiredHeight: number = 20): number => {
      if (currentY + requiredHeight > pageHeight - footerSpace) {
        doc.addPage();
        setupHeader();
        return 70; // Position after header
      }
      return currentY;
    };

    // Add document metadata
    const addMetadata = () => {
      doc.setFontSize(10);
      doc.setTextColor(51, 51, 51);

      if (eventData.metadata) {
        doc.text(`Versión: ${eventData.metadata.document_version}`, 14, 50);
        doc.text(`Estado: ${eventData.metadata.status}`, 14, 57);
        if (eventData.metadata.approved_at) {
          const approvedDate = format(new Date(eventData.metadata.approved_at), 'dd/MM/yyyy HH:mm', { locale: es });
          doc.text(`Aprobado: ${approvedDate}`, 14, 64);
        }
      }
      doc.text(`Generado: ${createdDate}`, pageWidth - 14, 50, { align: 'right' });
    };

    // Generate detailed content
    const generateDetailedContent = () => {
      setupHeader('Hoja de Ruta');
      let yPosition = 80;

      // Venue information with map
      yPosition = checkPageBreak(yPosition);
      doc.setFontSize(14);
      doc.setTextColor(125, 1, 1);
      doc.text('Información del Lugar', 14, yPosition);
      yPosition += 10;

      doc.setFontSize(11);
      doc.setTextColor(51, 51, 51);
      doc.text(`Nombre: ${eventData.venue?.name || 'N/A'}`, 20, yPosition);
      yPosition += 7;

      const addressLines = doc.splitTextToSize(eventData.venue?.address || 'N/A', pageWidth - 40);
      doc.text('Dirección:', 20, yPosition);
      doc.text(addressLines, 20, yPosition + 7);
      yPosition += addressLines.length * 7 + 15;

      // Add venue map if available
      if (venueMapPreview) {
        yPosition = checkPageBreak(yPosition, 80);
        try {
          const mapWidth = 120;
          const mapHeight = 70;
          doc.addImage(venueMapPreview, 'JPEG', 20, yPosition, mapWidth, mapHeight);
          yPosition += mapHeight + 15;
        } catch (error) {
          console.error("Error adding venue map:", error);
        }
      }

      // Accommodation information with maps
      if (accommodations && accommodations.length > 0) {
        yPosition = checkPageBreak(yPosition);
        doc.setFontSize(14);
        doc.setTextColor(125, 1, 1);
        doc.text('Información de Alojamiento', 14, yPosition);
        yPosition += 10;

        accommodations.forEach((accommodation, index) => {
          yPosition = checkPageBreak(yPosition);
          doc.setFontSize(12);
          doc.setTextColor(125, 1, 1);
          doc.text(`Hotel ${index + 1}: ${accommodation.hotel_name || 'N/A'}`, 20, yPosition);
          yPosition += 7;

          const addressLines = doc.splitTextToSize(accommodation.address || 'N/A', pageWidth - 40);
          doc.text('Dirección:', 20, yPosition);
          doc.text(addressLines, 20, yPosition + 7);
          yPosition += addressLines.length * 7 + 10;

          // Add accommodation map if available
          if (accommodation.coordinates) {
            yPosition = checkPageBreak(yPosition, 80);
            try {
              const mapWidth = 120;
              const mapHeight = 70;
              const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${accommodation.coordinates.lat},${accommodation.coordinates.lng}&zoom=15&size=600x400&markers=color:red%7C${accommodation.coordinates.lat},${accommodation.coordinates.lng}&key=YOUR_GOOGLE_MAPS_API_KEY`;
              doc.addImage(staticMapUrl, 'JPEG', 20, yPosition, mapWidth, mapHeight);
              yPosition += mapHeight + 15;
            } catch (error) {
              console.error("Error adding accommodation map:", error);
            }
          }
        });
      }

      // Logistics section
      if (eventData.logistics) {
        yPosition = checkPageBreak(yPosition);
        doc.setFontSize(14);
        doc.setTextColor(125, 1, 1);
        doc.text('Logística', 14, yPosition);
        yPosition += 10;

        const transportString = Array.isArray(eventData.logistics.transport)
          ? eventData.logistics.transport.map(t => `${t.transport_type} - ${t.driver_name || 'N/A'}`).join('\n')
          : 'N/A';
        const logisticsItems = [
          { label: 'Transporte:', value: transportString },
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
      }

      // Staff section with improved formatting
      if (eventData.staff && eventData.staff.length > 0) {
        yPosition = checkPageBreak(yPosition, 60);
        doc.setFontSize(14);
        doc.setTextColor(125, 1, 1);
        doc.text('Personal Asignado', 14, yPosition);
        yPosition += 10;

        const staffData = eventData.staff.map(person => [
          `${person.name} ${person.surname1} ${person.surname2}`.trim(),
          person.position || 'N/A',
          person.dni || 'N/A'
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Nombre Completo', 'Puesto', 'DNI']],
          body: staffData,
          theme: 'grid',
          styles: { fontSize: 10, cellPadding: 5 },
          headStyles: {
            fillColor: [125, 1, 1],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
          },
          columnStyles: {
            0: { cellWidth: 100 },
            1: { cellWidth: 80 },
            2: { cellWidth: 80 }
          }
        });
        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Travel arrangements - improved filtering
      const validTravelArrangements = travelArrangements.filter(hasMeaningfulTravelData);

      if (validTravelArrangements.length > 0) {
        yPosition = checkPageBreak(yPosition, 60);
        doc.setFontSize(14);
        doc.setTextColor(125, 1, 1);
        doc.text('Arreglos de Viaje', 14, yPosition);
        yPosition += 10;

        const travelData = validTravelArrangements.map(arr => [
          arr.transportation_type || 'N/A',
          arr.pickup_address || 'N/A',
          arr.pickup_time || 'N/A',
          arr.departure_time || 'N/A',
          arr.arrival_time || 'N/A',
          arr.flight_train_number || 'N/A'
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Transporte', 'Dirección Recogida', 'Hora Recogida', 'Salida', 'Llegada', 'Vuelo/Tren']],
          body: travelData,
          theme: 'grid',
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: {
            fillColor: [125, 1, 1],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
          },
        });
        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Room assignments - improved filtering
      const validRoomAssignments = roomAssignments.filter(hasMeaningfulRoomData);

      if (validRoomAssignments.length > 0) {
        yPosition = checkPageBreak(yPosition, 60);
        doc.setFontSize(14);
        doc.setTextColor(125, 1, 1);
        doc.text('Rooming', 14, yPosition);
        yPosition += 10;

        const roomData = validRoomAssignments.map(room => [
          room.room_type === 'single' ? 'Individual' : 'Doble',
          room.room_number || 'Por asignar',
          room.staff_member1_id || 'Por asignar',
          room.room_type === 'double' ? (room.staff_member2_id || 'Por asignar') : 'N/A'
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Tipo', 'Número', 'Ocupante 1', 'Ocupante 2']],
          body: roomData,
          theme: 'grid',
          styles: { fontSize: 10, cellPadding: 4 },
          headStyles: {
            fillColor: [125, 1, 1],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
          },
        });
        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Schedule section
      if (eventData.schedule) {
        yPosition = checkPageBreak(yPosition);
        doc.setFontSize(14);
        doc.setTextColor(125, 1, 1);
        doc.text('Programa del Evento', 14, yPosition);
        yPosition += 10;

        doc.setFontSize(10);
        doc.setTextColor(51, 51, 51);
        const scheduleLines = doc.splitTextToSize(eventData.schedule, pageWidth - 28);
        doc.text(scheduleLines, 14, yPosition);
        yPosition += scheduleLines.length * 7 + 15;
      }

      // Technical requirements section
      if (eventData.powerRequirements || eventData.auxiliaryNeeds) {
        yPosition = checkPageBreak(yPosition);
        doc.setFontSize(14);
        doc.setTextColor(125, 1, 1);
        doc.text('Requisitos Técnicos', 14, yPosition);
        yPosition += 10;

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
      }
    };

    // Generate images page
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

        imagePreviews.venue.forEach((image, index) => {
          try {
            yPosition = checkPageBreak(yPosition, imageHeight + 20);
            doc.addImage(image, 'PNG', currentX, yPosition, imageWidth, imageHeight);

            // Add image caption
            doc.setFontSize(8);
            doc.setTextColor(51, 51, 51);
            doc.text(`Imagen ${index + 1}`, currentX + imageWidth/2, yPosition + imageHeight + 8, { align: 'center' });

            currentX += imageWidth + spacing;
          } catch (error) {
            console.error(`Error adding image ${index + 1}:`, error);
          }
        });
      }
    };

    // Generate summary page (moved to last)
    const generateSummaryPage = () => {
      doc.addPage();
      setupHeader('Resumen Final');
      let yPosition = 80;

      // Executive summary section
      doc.setFontSize(16);
      doc.setTextColor(125, 1, 1);
      doc.text('Resumen Final', 14, yPosition);
      yPosition += 15;

      // Key event information
      const summaryData = [
        ['Evento', eventData.eventName || 'N/A'],
        ['Fechas', eventData.eventDates || 'N/A'],
        ['Lugar', eventData.venue?.name || 'N/A'],
        ['Dirección', eventData.venue?.address || 'N/A'],
        ['Personal Asignado', eventData.staff?.length.toString() || '0'],
        ['Contactos', eventData.contacts?.length.toString() || '0'],
        ['Viaje', travelArrangements.filter(hasMeaningfulTravelData).length.toString()],
        ['Habitaciones', roomAssignments.filter(hasMeaningfulRoomData).length.toString()]
      ];

      autoTable(doc, {
        startY: yPosition,
        head: [['Concepto', 'Detalle']],
        body: summaryData,
        theme: 'grid',
        styles: {
          fontSize: 11,
          cellPadding: 6,
          lineColor: [220, 220, 230],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [125, 1, 1],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        bodyStyles: { textColor: [51, 51, 51] },
        alternateRowStyles: { fillColor: [250, 250, 255] },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 20;

      // Key contacts summary
      if (eventData.contacts && eventData.contacts.length > 0) {
        yPosition = checkPageBreak(yPosition, 60);
        doc.setFontSize(14);
        doc.setTextColor(125, 1, 1);
        doc.text('Contactos Principales', 14, yPosition);
        yPosition += 10;

        const contactsData = eventData.contacts.slice(0, 5).map(contact => [
          contact.name || 'N/A',
          contact.role || 'N/A',
          contact.phone || 'N/A'
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Nombre', 'Rol', 'Teléfono']],
          body: contactsData,
          theme: 'grid',
          styles: { fontSize: 10, cellPadding: 4 },
          headStyles: {
            fillColor: [125, 1, 1],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
          },
        });
      }
    };

    // Add footer with logo and page numbers
    const addFooter = () => {
      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      logo.src = '/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png';

      logo.onload = () => {
        const totalPages = doc.internal.pages.length - 1;

        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);

          // Add page number
          doc.setFontSize(10);
          doc.setTextColor(51, 51, 51);
          doc.text(`Página ${i} de ${totalPages}`, pageWidth - 14, pageHeight - 25, { align: 'right' });

          // Add logo
          const logoWidth = 40;
          const logoHeight = logoWidth * (logo.height / logo.width);
          const xPosition = (pageWidth - logoWidth) / 2;
          const yLogo = pageHeight - logoHeight - 5;

          try {
            doc.addImage(logo, 'PNG', xPosition, yLogo, logoWidth, logoHeight);
          } catch (error) {
            console.error(`Error adding logo on page ${i}:`, error);
          }
        }

        // Add created date on last page
        doc.setPage(totalPages);
        doc.text(`Creado: ${createdDate}`, 14, pageHeight - 10);

        const blob = doc.output('blob');
        resolve(blob);
      };

      logo.onerror = () => {
        console.error('Failed to load company logo');
        const totalPages = doc.internal.pages.length - 1;
        doc.setPage(totalPages);
        doc.setFontSize(10);
        doc.setTextColor(51, 51, 51);
        doc.text(`Creado: ${createdDate}`, 14, pageHeight - 10);

        const blob = doc.output('blob');
        resolve(blob);
      };
    };

    // Main generation process - reordered to move summary to last
    const generatePDF = () => {
      // Load custom logo first if provided
      if (customLogoUrl && headerLogo) {
        headerLogo.onload = () => {
          setupHeader();
          addMetadata();
          generateDetailedContent();  // First: detailed content
          generateImagesPage();       // Second: images
          generateSummaryPage();      // Last: summary
          addFooter();
        };
        headerLogo.onerror = () => {
          console.error('Failed to load custom logo');
          setupHeader();
          addMetadata();
          generateDetailedContent();
          generateImagesPage();
          generateSummaryPage();
          addFooter();
        };
        headerLogo.src = customLogoUrl;
      } else {
        setupHeader();
        addMetadata();
        generateDetailedContent();
        generateImagesPage();
        generateSummaryPage();
        addFooter();
      }
    };

    generatePDF();
  });
};
