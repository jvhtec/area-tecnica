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
      
      // Generate cover page
      const coverSection = new CoverSection(this.pdfDoc, this.options.eventData, this.options.jobTitle, this.logoData);
      coverSection.generateCoverPage();

      // Each major section starts on a new page as per requirements
      // 2. Job Details and Venue (combined on same page)
      if (this.contentSections.hasEventDetailsData(this.options.eventData) || this.contentSections.hasVenueData(this.options.eventData)) {
        this.pdfDoc.addPage();
        let currentY = 75;
        
        if (this.contentSections.hasEventDetailsData(this.options.eventData)) {
          currentY = this.contentSections.addEventDetailsSection(this.options.eventData, currentY);
        }
        
        if (this.contentSections.hasVenueData(this.options.eventData)) {
          currentY = await this.contentSections.addVenueSection(
            this.options.eventData, 
            this.options.venueMapPreview, 
            currentY
          );
        }
      }

      // 3. Weather section
      if (this.contentSections.hasWeatherData(this.options.eventData)) {
        this.pdfDoc.addPage();
        this.contentSections.addWeatherSection(this.options.eventData, 75);
      }

      // 4. Contactos
      if (this.contentSections.hasContactsData(this.options.eventData)) {
        this.pdfDoc.addPage();
        this.contentSections.addContactsSection(this.options.eventData, 75);
      }

      // 5. Personal
      if (this.contentSections.hasStaffData(this.options.eventData)) {
        this.pdfDoc.addPage();
        this.contentSections.addStaffSection(this.options.eventData, 75);
      }

      // 6. Viajes
      if (this.contentSections.hasTravelData(this.options.travelArrangements)) {
        this.pdfDoc.addPage();
        await this.contentSections.addTravelSection(this.options.travelArrangements, 75);
      }

      // 7. Alojamientos
      if (this.contentSections.hasAccommodationData(this.options.accommodations)) {
        this.pdfDoc.addPage();
        await this.contentSections.addAccommodationSection(
          this.options.accommodations || [], 
          this.options.eventData, 
          75
        );
      }

      // 8. Rooming
      if (this.contentSections.hasRoomingData(this.options.accommodations)) {
        this.pdfDoc.addPage();
        this.contentSections.addRoomingSection(
          this.options.accommodations || [], 
          this.options.eventData, 
          75
        );
      }

      // 9. Transportes
      if (this.contentSections.hasLogisticsData(this.options.eventData)) {
        this.pdfDoc.addPage();
        this.contentSections.addLogisticsSection(this.options.eventData, 75);
      }

      // 10. Power Requirements
      if (this.contentSections.hasPowerData(this.options.eventData)) {
        this.pdfDoc.addPage();
        this.contentSections.addPowerSection(this.options.eventData, 75);
      }

      // 11. Necesidades Auxiliares
      if (this.contentSections.hasAuxNeedsData(this.options.eventData)) {
        this.pdfDoc.addPage();
        this.contentSections.addAuxNeedsSection(this.options.eventData, 75);
      }

      // 12. Programa
      if (this.contentSections.hasProgramData(this.options.eventData)) {
        this.pdfDoc.addPage();
        this.contentSections.addProgramSection(this.options.eventData, 75);
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