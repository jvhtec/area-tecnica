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
    // headerSection will be initialized after logo loading so we can pass logo
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
      // Load logo first (used on cover and in page header)
      this.logoData = await LogoService.loadJobLogo(selectedJobId);

      // Compute header logo scaled dimensions to keep aspect ratio
      let headerLogoDims: { width: number; height: number } | undefined = undefined;
      if (this.logoData) {
        headerLogoDims = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const MAX_H = 28;
            const MAX_W = 160;
            const w = img.naturalWidth || img.width;
            const h = img.naturalHeight || img.height;
            if (w > 0 && h > 0) {
              const scale = Math.min(MAX_H / h, MAX_W / w);
              resolve({ width: Math.round(w * scale), height: Math.round(h * scale) });
            } else {
              resolve({ width: 84, height: 28 });
            }
          };
          img.onerror = () => resolve({ width: 84, height: 28 });
          img.src = this.logoData!;
        });
      }

      // Initialize header section now that we have job info and logo
      this.headerSection = new HeaderSection(
        this.pdfDoc,
        jobTitle,
        this.options.jobDate,
        'Hoja de Ruta',
        this.logoData || undefined,
        headerLogoDims
      );
      
      // Generate cover page
      const coverSection = new CoverSection(this.pdfDoc, this.options.eventData, this.options.jobTitle, this.logoData);
      await coverSection.generateCoverPage();

      // Each major section starts on a new page as per requirements
      // 2. Job Details and Venue (combined on same page)
      if (this.contentSections.hasEventDetailsData(this.options.eventData) || this.contentSections.hasVenueData(this.options.eventData)) {
        let currentY = this.headerSection.addSectionHeader("Detalles y Venue");
        
        if (this.contentSections.hasEventDetailsData(this.options.eventData)) {
          currentY = this.contentSections.addEventDetailsSection(this.options.eventData, currentY);
        }
        
        if (this.contentSections.hasVenueData(this.options.eventData)) {
          currentY = await this.contentSections.addVenueSection(
            this.options.eventData, 
            this.options.venueMapPreview, 
            currentY,
            this.options.imagePreviews?.venue
          );
        }
      }

      // 3. Weather section
      if (this.contentSections.hasWeatherData(this.options.eventData)) {
        const currentY = this.headerSection.addSectionHeader("Clima");
        this.contentSections.addWeatherSection(this.options.eventData, currentY);
      } else {
        // Attempt to fetch weather on-the-fly if missing
        try {
          const { getWeatherForJob } = await import('@/utils/weather/weatherApi');
          if (this.options.eventData?.venue && this.options.eventData?.eventDates) {
            const weather = await getWeatherForJob(
              this.options.eventData.venue,
              this.options.eventData.eventDates
            );
            if (weather && weather.length > 0) {
              (this.options.eventData as any).weather = weather;
              const currentY = this.headerSection.addSectionHeader("Clima");
              this.contentSections.addWeatherSection(this.options.eventData, currentY);
            }
          }
        } catch (e) {
          console.warn('Weather fetch during PDF generation failed:', e);
        }
      }

      // 4. Contactos
      if (this.contentSections.hasContactsData(this.options.eventData)) {
        const currentY = this.headerSection.addSectionHeader("Contactos");
        this.contentSections.addContactsSection(this.options.eventData, currentY);
      }

      // 5. Personal
      if (this.contentSections.hasStaffData(this.options.eventData)) {
        const currentY = this.headerSection.addSectionHeader("Personal");
        this.contentSections.addStaffSection(this.options.eventData, currentY);
      }

      // Defaults for rendering options
      const includeAccommodationRooming = this.options.includeAccommodationRooming ?? true;
      const includeAggregatedRooming = this.options.includeAggregatedRooming ?? false;
      const includeTravelArrangements = this.options.includeTravelArrangements ?? true;
      const includeLogisticsTransport = this.options.includeLogisticsTransport ?? true;

      // 6. Viajes
      if (includeTravelArrangements && this.contentSections.hasTravelData(this.options.travelArrangements)) {
        const currentY = this.headerSection.addSectionHeader("Viajes");
        await this.contentSections.addTravelSection(
          this.options.travelArrangements, 
          this.options.eventData?.venue?.address,
          currentY
        );
      }

      // 7. Alojamientos
      if (this.contentSections.hasAccommodationData(this.options.accommodations)) {
        const currentY = this.headerSection.addSectionHeader("Alojamientos");
        await this.contentSections.addAccommodationSection(
          this.options.accommodations || [], 
          this.options.eventData, 
          currentY,
          includeAccommodationRooming === false && includeAggregatedRooming === true // suppress per-hotel rooms when we show aggregated
        );
      }

      // 8. Rooming (aggregated)
      if (includeAggregatedRooming && this.contentSections.hasRoomingData(this.options.accommodations)) {
        const currentY = this.headerSection.addSectionHeader("Rooming");
        this.contentSections.addRoomingSection(
          this.options.accommodations || [], 
          this.options.eventData, 
          currentY
        );
      }

      // 9. Transportes
      if (includeLogisticsTransport && this.contentSections.hasLogisticsData(this.options.eventData)) {
        const currentY = this.headerSection.addSectionHeader("Transportes");
        this.contentSections.addLogisticsSection(this.options.eventData, currentY);
      }

      // 10. Power Requirements
      if (this.contentSections.hasPowerData(this.options.eventData)) {
        const currentY = this.headerSection.addSectionHeader("Requerimientos eléctricos");
        this.contentSections.addPowerSection(this.options.eventData, currentY);
      }

      // 11. Necesidades Auxiliares
      if (this.contentSections.hasAuxNeedsData(this.options.eventData)) {
        const currentY = this.headerSection.addSectionHeader("Necesidades auxiliares");
        this.contentSections.addAuxNeedsSection(this.options.eventData, currentY);
      }

      // 12. Programa
      if (this.contentSections.hasProgramData(this.options.eventData)) {
        const currentY = this.headerSection.addSectionHeader("Programa");
        this.contentSections.addProgramSection(this.options.eventData, currentY);
      }

      // 13. Restaurantes
      if (this.contentSections.hasRestaurantsData(this.options.eventData)) {
        const currentY = this.headerSection.addSectionHeader("Restaurantes");
        await this.contentSections.addRestaurantsSection(this.options.eventData, currentY);
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
