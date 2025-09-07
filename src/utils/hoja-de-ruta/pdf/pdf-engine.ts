import { PDFDocument } from './core/pdf-document';
import { PDFGenerationOptions } from './core/pdf-types';
import { LogoService } from './services/logo-service';
import { uploadPdfToJob } from '../pdf-upload';
import { HeaderSection } from './sections/header-section';
import { CoverSection } from './sections/cover-section';
import { ContentSections } from './sections/content-sections';
import { FooterService } from './services/footer-service';

export class PDFEngine {
  private pdfDoc: PDFDocument;
  private headerSection: HeaderSection;
  private coverSection: CoverSection;
  private contentSections: ContentSections;
  private logoData?: string;

  constructor(private options: PDFGenerationOptions) {
    this.pdfDoc = new PDFDocument();
    this.contentSections = new ContentSections(this.pdfDoc);
  }

  async generate(): Promise<void> {
    const { 
      eventData, 
      selectedJobId, 
      jobTitle, 
      toast,
      travelArrangements,
      accommodations = [],
      venueMapPreview
    } = this.options;

    try {
      // Load logo
      this.logoData = await LogoService.loadJobLogo(selectedJobId);
      
      // Initialize sections with logo
      this.headerSection = new HeaderSection(this.pdfDoc, eventData, jobTitle, this.logoData);
      this.coverSection = new CoverSection(this.pdfDoc, eventData, jobTitle, this.logoData);

      // Generate cover page
      this.coverSection.generateCoverPage();

      // Generate only sections with data
      
      // 1. Cover page (already generated above)
      
      // 2. Job details and Venue (always include)
      this.pdfDoc.addPage();
      this.headerSection.addHeader('INFORMACIÓN DEL TRABAJO Y LUGAR');
      let yPosition = 75;
      yPosition = this.contentSections.addEventDetailsSection(eventData, yPosition);
      yPosition = await this.contentSections.addVenueSection(eventData, venueMapPreview, yPosition + 10);

      // 3. Weather section (if weather data exists)
      if (this.contentSections.hasWeatherData(eventData)) {
        this.pdfDoc.addPage();
        this.headerSection.addHeader('METEOROLOGÍA');
        yPosition = 75;
        yPosition = this.contentSections.addWeatherSection(eventData, yPosition);
      }

      // 4. Contactos (if contacts exist)
      if (this.contentSections.hasContactsData(eventData)) {
        this.pdfDoc.addPage();
        this.headerSection.addHeader('CONTACTOS');
        yPosition = 75;
        yPosition = this.contentSections.addContactsSection(eventData, yPosition);
      }

      // 5. Personal (if staff exists)
      if (this.contentSections.hasStaffData(eventData)) {
        this.pdfDoc.addPage();
        this.headerSection.addHeader('PERSONAL');
        yPosition = 75;
        yPosition = this.contentSections.addStaffSection(eventData, yPosition);
      }

      // 6. Viajes (if travel arrangements exist)
      if (this.contentSections.hasTravelData(travelArrangements || [])) {
        this.pdfDoc.addPage();
        this.headerSection.addHeader('VIAJES');
        yPosition = 75;
        yPosition = await this.contentSections.addTravelSection(travelArrangements || [], yPosition);
      }

      // 7. Alojamientos (if accommodations exist)
      if (this.contentSections.hasAccommodationData(accommodations || [])) {
        this.pdfDoc.addPage();
        this.headerSection.addHeader('ALOJAMIENTOS');
        yPosition = 75;
        yPosition = await this.contentSections.addAccommodationSection(accommodations || [], eventData, yPosition);
      }

      // 8. Rooming (if room assignments exist)
      if (this.contentSections.hasRoomingData(accommodations || [])) {
        this.pdfDoc.addPage();
        this.headerSection.addHeader('ROOMING');
        yPosition = 75;
        yPosition = this.contentSections.addRoomingSection(accommodations || [], eventData, yPosition);
      }

      // 9. Transportes (if transport data exists)
      if (this.contentSections.hasLogisticsData(eventData)) {
        this.pdfDoc.addPage();
        this.headerSection.addHeader('TRANSPORTES');
        yPosition = 75;
        yPosition = this.contentSections.addLogisticsSection(eventData, yPosition);
      }

      // 10. Power requirements (if power data exists)
      if (this.contentSections.hasPowerData(eventData)) {
        this.pdfDoc.addPage();
        this.headerSection.addHeader('POWER REQUIREMENTS');
        yPosition = 75;
        yPosition = this.contentSections.addPowerSection(eventData, yPosition);
      }

      // 11. Necesidades auxiliares (if aux needs exist)
      if (this.contentSections.hasAuxNeedsData(eventData)) {
        this.pdfDoc.addPage();
        this.headerSection.addHeader('NECESIDADES AUXILIARES');
        yPosition = 75;
        yPosition = this.contentSections.addAuxNeedsSection(eventData, yPosition);
      }

      // 12. Programa (if program data exists)
      if (this.contentSections.hasProgramData(eventData)) {
        this.pdfDoc.addPage();
        this.headerSection.addHeader('PROGRAMA');
        yPosition = 75;
        yPosition = this.contentSections.addProgramSection(eventData, yPosition);
      }

      // Add Sector-Pro footer to all pages
      await FooterService.addFooterToAllPages(this.pdfDoc);

      // Save and upload PDF
      await this.saveAndUploadPDF();
      
      toast?.({
        title: "✅ Documento generado",
        description: "La hoja de ruta ha sido generada y descargada correctamente.",
      });

    } catch (error) {
      console.error('Error generating PDF:', error);
      toast?.({
        title: "❌ Error",
        description: "Hubo un problema al generar el documento.",
        variant: "destructive",
      });
      throw error;
    }
  }

  private async saveAndUploadPDF(): Promise<void> {
    const { eventData, selectedJobId, jobTitle } = this.options;
    
    // Generate filename
    const eventName = eventData.eventName || jobTitle || 'Evento';
    const safeEventName = eventName.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `hoja_de_ruta_${safeEventName}_${timestamp}.pdf`;

    // Save locally
    this.pdfDoc.save(filename);

    // Upload to job storage
    try {
      const pdfBlob = this.pdfDoc.outputBlob();
      await uploadPdfToJob(selectedJobId, pdfBlob, filename);
      console.log('✅ PDF uploaded to job storage successfully');
    } catch (uploadError) {
      console.error('❌ Error uploading PDF to job storage:', uploadError);
      // Continue anyway - local download still works
    }
  }
}