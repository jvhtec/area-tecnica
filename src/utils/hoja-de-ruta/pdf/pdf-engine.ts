import { PDFDocument } from './core/pdf-document';
import { PDFGenerationOptions } from './core/pdf-types';
import { LogoService } from './services/logo-service';
import { uploadPdfToJob } from '../pdf-upload';
import { HeaderSection } from './sections/header-section';
import { CoverSection } from './sections/cover-section';
import { ContentSections } from './sections/content-sections';

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

      // Start content pages
      this.pdfDoc.addPage();
      this.headerSection.addHeader();
      let yPosition = 75;

      // Add all content sections
      yPosition = this.contentSections.addContactsSection(eventData, yPosition);
      
      this.pdfDoc.addPage();
      this.headerSection.addHeader();
      yPosition = 75;
      
      yPosition = this.contentSections.addEventDetailsSection(eventData, yPosition);
      yPosition = this.contentSections.addVenueSection(eventData, venueMapPreview, yPosition);
      
      yPosition = await this.contentSections.addTravelSection(travelArrangements, yPosition);
      yPosition = this.contentSections.addAccommodationSection(accommodations, eventData, yPosition);
      yPosition = this.contentSections.addStaffSection(eventData, yPosition);
      yPosition = this.contentSections.addScheduleSection(eventData, yPosition);

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