import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as QRCode from 'qrcode';
import { ComprehensiveEventData, TravelArrangement, RoomAssignment, ImagePreviews, Accommodation, EnhancedStaff, EnhancedRoomAssignment } from '@/types/hoja-de-ruta';

interface AutoTableJsPDF extends jsPDF {
  lastAutoTable: { finalY: number };
}

// Hardcoded departure address - modify as needed
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

const formatTime = (time: string): string => {
  if (!time) return 'N/A';
  try {
    return format(new Date(`2000-01-01T${time}`), 'HH:mm');
  } catch {
    return time;
  }
};

export const generateEnhancedPDF = async (
  eventData: ComprehensiveEventData,
  travelArrangements: TravelArrangement[],
  roomAssignments: RoomAssignment[],
  imagePreviews: ImagePreviews,
  venueMapPreview: string | null,
  selectedJobId: string,
  jobTitle: string,
  jobDate: string,
  customLogoUrl?: string,
  accommodations?: Accommodation[],
  staffData?: EnhancedStaff[]
): Promise<Blob> => {
  return new Promise<Blob>(async (resolve) => {
    const doc = new jsPDF() as AutoTableJsPDF;
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const createdDate = new Date().toLocaleDateString('es-ES');
    const footerSpace = 40;
    const headerLogo = customLogoUrl ? new Image() : null;

    // Format job date properly
    const jobDateStr = jobDate ? format(new Date(jobDate), 'dd/MM/yyyy', { locale: es }) : '';

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

    // Enhanced rooming logic - properly match staff names to room assignments
    const enhancedRoomAssignments: EnhancedRoomAssignment[] = roomAssignments.map(room => {
      const staff1 = staffData?.find(s => s.id === room.staff_member1_id) || 
                    eventData.staff?.find((s, index) => index.toString() === room.staff_member1_id);
      const staff2 = staffData?.find(s => s.id === room.staff_member2_id) || 
                    eventData.staff?.find((s, index) => index.toString() === room.staff_member2_id);
      
      return {
        ...room,
        staff1Name: staff1 ? `${staff1.name} ${staff1.surname1} ${staff1.surname2 || ''}`.trim() : 
                   (room.staff_member1_id || 'Por asignar'),
        staff2Name: staff2 ? `${staff2.name} ${staff2.surname1} ${staff2.surname2 || ''}`.trim() : 
                   (room.staff_member2_id || 'Por asignar')
      };
    });

    // Helper functions for data validation
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

    // Enhanced header with modern design
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

      // Custom logo
      if (headerLogo && customLogoUrl) {
        const logoHeight = 8;
        const logoWidth = logoHeight * (headerLogo.width / headerLogo.height);
        try {
          doc.addImage(headerLogo, 'PNG', 10, 8, logoWidth, logoHeight);
        } catch (error) {
          console.error("Error adding custom logo to header:", error);
        }
      }

      // Header text
      doc.setFontSize(26);
      doc.setTextColor(255, 255, 255);
      doc.text(pageTitle || 'Hoja de Ruta', pageWidth / 2, 22, { align: 'center' });

      doc.setFontSize(16);
      doc.text(eventData.eventName || 'Evento sin título', pageWidth / 2, 32, { align: 'center' });

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
    const addSectionHeader = (title: string, yPosition: number, icon?: string): number => {
      doc.setFillColor(248, 249, 250);
      doc.rect(14, yPosition - 5, pageWidth - 28, 15, 'F');
      
      doc.setDrawColor(125, 1, 1);
      doc.setLineWidth(0.8);
      doc.line(14, yPosition - 5, pageWidth - 14, yPosition - 5);
      
      doc.setFontSize(14);
      doc.setTextColor(125, 1, 1);
      doc.text(`${icon || '■'} ${title}`, 20, yPosition + 4);
      
      return yPosition + 20;
    };

    // Document metadata
    const addMetadata = () => {
      doc.setFontSize(10);
      doc.setTextColor(51, 51, 51);
      let yPos = 55;

      // Left column - metadata is part of EnhancedEventData, not ComprehensiveEventData
      // Skip metadata section since it's not available in this interface

      // Right column
      doc.text(`Generado: ${createdDate}`, pageWidth - 14, yPos, { align: 'right' });
      if (eventData.clientName) {
        doc.text(`Cliente: ${eventData.clientName}`, pageWidth - 14, yPos + 6, { align: 'right' });
      }
      if (eventData.estimatedAttendees) {
        doc.text(`Asistentes: ${eventData.estimatedAttendees}`, pageWidth - 14, yPos + 12, { align: 'right' });
      }
    };

    // Event overview section
    const addEventOverview = (yPosition: number): number => {
      yPosition = checkPageBreak(yPosition, 80);
      yPosition = addSectionHeader('Resumen del Evento', yPosition, '📋');

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
      yPosition = addSectionHeader('Información de Ruta', yPosition, '🗺️');

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
      yPosition = addSectionHeader('Información del Lugar', yPosition, '🏢');

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

    // Enhanced staff section
    const addStaffSection = (yPosition: number): number => {
      const staff = staffData || eventData.staff;
      if (!staff || staff.length === 0) return yPosition;

      yPosition = checkPageBreak(yPosition, 80);
      yPosition = addSectionHeader('Personal Asignado', yPosition, '👥');

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

    // Enhanced rooming section with proper staff name resolution
    const addRoomingSection = (yPosition: number): number => {
      const validRoomAssignments = enhancedRoomAssignments.filter(hasMeaningfulRoomData);
      if (validRoomAssignments.length === 0) return yPosition;

      yPosition = checkPageBreak(yPosition, 80);
      yPosition = addSectionHeader('Distribución de Habitaciones', yPosition, '🏨');

      const roomData = validRoomAssignments.map(room => {
        const roomTypeMap = {
          'single': 'Individual',
          'double': 'Doble',
          'twin': 'Doble (2 camas)',
          'triple': 'Triple'
        };

        return [
          roomTypeMap[room.room_type] || room.room_type || 'N/A',
          room.room_number || 'Por asignar',
          room.staff1Name || 'Por asignar',
          room.room_type === 'single' ? 'N/A' : (room.staff2Name || 'Por asignar')
        ];
      });

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
      return (doc as any).lastAutoTable.finalY + 15;
    };

    // Add new sections from pasted_content.txt
    const addEquipmentListSection = (yPosition: number): number => {
      if (!eventData.equipmentList || eventData.equipmentList.length === 0) return yPosition;

      yPosition = checkPageBreak(yPosition, 80);
      yPosition = addSectionHeader('Lista de Equipamiento', yPosition, '🛠️');

      const equipmentTableData = eventData.equipmentList.map(item => [
        item.item || 'N/A',
        item.quantity?.toString() || 'N/A',
        item.supplier || 'N/A',
        item.cost ? formatCurrency(item.cost, eventData.currency) : 'N/A'
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['Item', 'Cantidad', 'Proveedor', 'Coste']],
        body: equipmentTableData,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: {
          fillColor: [125, 1, 1],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
      });
      return (doc as any).lastAutoTable.finalY + 15;
    };

    const addTechnicalRequirementsSection = (yPosition: number): number => {
      if (!eventData.audioVisualRequirements && !eventData.lightingRequirements && !eventData.stagingRequirements) return yPosition;

      yPosition = checkPageBreak(yPosition, 80);
      yPosition = addSectionHeader('Requisitos Técnicos Adicionales', yPosition, '💡');

      doc.setFontSize(10);
      doc.setTextColor(51, 51, 51);

      if (eventData.audioVisualRequirements) {
        doc.text('Audio Visual:', 20, yPosition);
        yPosition += 5;
        doc.text(doc.splitTextToSize(eventData.audioVisualRequirements, pageWidth - 40), 20, yPosition);
        yPosition += doc.splitTextToSize(eventData.audioVisualRequirements, pageWidth - 40).length * 5 + 5;
      }
      if (eventData.lightingRequirements) {
        doc.text('Iluminación:', 20, yPosition);
        yPosition += 5;
        doc.text(doc.splitTextToSize(eventData.lightingRequirements, pageWidth - 40), 20, yPosition);
        yPosition += doc.splitTextToSize(eventData.lightingRequirements, pageWidth - 40).length * 5 + 5;
      }
      if (eventData.stagingRequirements) {
        doc.text('Escenario:', 20, yPosition);
        yPosition += 5;
        doc.text(doc.splitTextToSize(eventData.stagingRequirements, pageWidth - 40), 20, yPosition);
        yPosition += doc.splitTextToSize(eventData.stagingRequirements, pageWidth - 40).length * 5 + 5;
      }
      return yPosition;
    };

    const addCateringDetailsSection = (yPosition: number): number => {
      if (!eventData.cateringDetails) return yPosition;

      yPosition = checkPageBreak(yPosition, 80);
      yPosition = addSectionHeader('Detalles de Catering', yPosition, '🍽️');

      const cateringData = [];
      cateringData.push(['Proveedor', eventData.cateringDetails.provider || 'N/A']);
      cateringData.push(['Tipo de Menú', eventData.cateringDetails.menuType || 'N/A']);
      cateringData.push(['Hora de Servicio', formatTime(eventData.cateringDetails.servingTime) || 'N/A']);
      cateringData.push(['Dietas Especiales', eventData.cateringDetails.dietaryRequirements?.join(', ') || 'N/A']);
      cateringData.push(['Número de Personas', eventData.cateringDetails.numberOfPeople?.toString() || 'N/A']);

      autoTable(doc, {
        startY: yPosition,
        body: cateringData,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: [125, 1, 1] },
        }
      });
      return (doc as any).lastAutoTable.finalY + 15;
    };

    const addEmergencyContactsSection = (yPosition: number): number => {
      if (!eventData.emergencyContacts || eventData.emergencyContacts.length === 0) return yPosition;

      yPosition = checkPageBreak(yPosition, 80);
      yPosition = addSectionHeader('Contactos de Emergencia', yPosition, '🚨');

      const contactsTableData = eventData.emergencyContacts.map(contact => [
        contact.name || 'N/A',
        contact.role || 'N/A',
        formatPhone(contact.phone) || 'N/A',
        contact.available24h ? 'Sí' : 'No'
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['Nombre', 'Rol', 'Teléfono', '24h Disponible']],
        body: contactsTableData,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: {
          fillColor: [125, 1, 1],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
      });
      return (doc as any).lastAutoTable.finalY + 15;
    };

    const addSpecialInstructionsSection = (yPosition: number): number => {
      if (!eventData.specialInstructions) return yPosition;

      yPosition = checkPageBreak(yPosition, 80);
      yPosition = addSectionHeader('Instrucciones Especiales', yPosition, '📝');

      doc.setFontSize(10);
      doc.setTextColor(51, 51, 51);
      doc.text(doc.splitTextToSize(eventData.specialInstructions, pageWidth - 28), 14, yPosition);
      return yPosition + doc.splitTextToSize(eventData.specialInstructions, pageWidth - 28).length * 5 + 15;
    };

    const addRiskAssessmentSection = (yPosition: number): number => {
      if (!eventData.riskAssessment) return yPosition;

      yPosition = checkPageBreak(yPosition, 80);
      yPosition = addSectionHeader('Evaluación de Riesgos', yPosition, '⚠️');

      doc.setFontSize(10);
      doc.setTextColor(51, 51, 51);
      doc.text(doc.splitTextToSize(eventData.riskAssessment, pageWidth - 28), 14, yPosition);
      return yPosition + doc.splitTextToSize(eventData.riskAssessment, pageWidth - 28).length * 5 + 15;
    };

    const addInsuranceDetailsSection = (yPosition: number): number => {
      if (!eventData.insuranceDetails) return yPosition;

      yPosition = checkPageBreak(yPosition, 80);
      yPosition = addSectionHeader('Detalles del Seguro', yPosition, '🛡️');

      doc.setFontSize(10);
      doc.setTextColor(51, 51, 51);
      doc.text(doc.splitTextToSize(eventData.insuranceDetails, pageWidth - 28), 14, yPosition);
      return yPosition + doc.splitTextToSize(eventData.insuranceDetails, pageWidth - 28).length * 5 + 15;
    };

    const addWeatherBackupPlanSection = (yPosition: number): number => {
      if (!eventData.weatherBackupPlan) return yPosition;

      yPosition = checkPageBreak(yPosition, 80);
      yPosition = addSectionHeader('Plan de Contingencia Meteorológica', yPosition, '☁️');

      doc.setFontSize(10);
      doc.setTextColor(51, 51, 51);
      doc.text(doc.splitTextToSize(eventData.weatherBackupPlan, pageWidth - 28), 14, yPosition);
      return yPosition + doc.splitTextToSize(eventData.weatherBackupPlan, pageWidth - 28).length * 5 + 15;
    };

    // Main content generation
    const generateDetailedContent = async () => {
      setupHeader('Hoja de Ruta');
      addMetadata();
      let yPosition = 80;

      yPosition = addEventOverview(yPosition);
      yPosition = addVenueSection(yPosition);
      yPosition = addStaffSection(yPosition);
      yPosition = addRoomingSection(yPosition);
      yPosition = addEquipmentListSection(yPosition);
      yPosition = addTechnicalRequirementsSection(yPosition);
      yPosition = addCateringDetailsSection(yPosition);
      yPosition = addEmergencyContactsSection(yPosition);
      yPosition = addSpecialInstructionsSection(yPosition);
      yPosition = addRiskAssessmentSection(yPosition);
      yPosition = addInsuranceDetailsSection(yPosition);
      yPosition = addWeatherBackupPlanSection(yPosition);

      // Existing sections
      // Logistics section
      if (eventData.logistics) {
        yPosition = checkPageBreak(yPosition);
        addSectionHeader('Logística', yPosition);
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

      // Travel arrangements - improved filtering
      const validTravelArrangements = travelArrangements.filter(hasMeaningfulTravelData);

      if (validTravelArrangements.length > 0) {
        yPosition = checkPageBreak(yPosition, 60);
        addSectionHeader('Arreglos de Viaje', yPosition);
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

      // Schedule section
      if (eventData.schedule) {
        yPosition = checkPageBreak(yPosition);
        addSectionHeader('Programa del Evento', yPosition);
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
        addSectionHeader('Requisitos Técnicos', yPosition);
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
        doc.text('Contactos Clave', 14, yPosition);
        yPosition += 10;

        const contactsTableData = eventData.contacts.map(contact => [
          contact.name || 'N/A',
          contact.role || 'N/A',
          formatPhone(contact.phone) || 'N/A'
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Nombre', 'Rol', 'Teléfono']],
          body: contactsTableData,
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
    };

    // Main execution flow
    (async () => {
      if (headerLogo && customLogoUrl) {
        headerLogo.src = customLogoUrl;
        await new Promise(resolve => headerLogo.onload = resolve);
      }

      await generateDetailedContent();
      generateImagesPage();
      generateSummaryPage();

      // Footer
      const addFooter = () => {
        const pageCount = doc.internal.pages.length;
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(10);
          doc.setTextColor(150, 150, 150);
          doc.text(`Página ${i} de ${pageCount - 1}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        }
      };
      addFooter();

      resolve(doc.output('blob'));
    })();
  });
};
