import { PDFDocument } from './core/pdf-document';
import type { GeneratedHojaDeRutaPdf, PDFGenerationOptions } from './core/pdf-types';
import { LogoService } from './services/logo-service';
import { uploadPdfToJob } from '../pdf-upload';
import { HeaderSection } from './sections/header-section';
import { CoverSection } from './sections/cover-section';
import { ContentSections } from './sections/content-sections';
import { FooterService } from './services/footer-service';
import {
  getHojaDeRutaPdfSectionFilenameLabel,
  getHojaDeRutaPdfSelectionLabel,
  normalizeHojaDeRutaPrintSections,
} from '@/utils/hoja-de-ruta/pdf/section-options';
import type {
  HojaDeRutaPdfSectionId,
  HojaDeRutaPrintSectionId,
} from '@/utils/hoja-de-ruta/pdf/section-options';

export class PDFEngine {
  private pdfDoc: PDFDocument;
  private headerSection: HeaderSection;
  private contentSections: ContentSections;
  private logoData?: string;
  private hasCoverPage = true;
  private renderedSectionCount = 0;
  private excludedSections = new Set<HojaDeRutaPrintSectionId>();

  constructor(private options: PDFGenerationOptions) {
    this.pdfDoc = new PDFDocument();
    // headerSection will be initialized after logo loading so we can pass logo
    this.contentSections = new ContentSections(this.pdfDoc);
  }

  async generate(): Promise<void> {
    const { selectedJobId, toast } = this.options;

    try {
      const generatedPdf = await this.renderPDF();

      this.pdfDoc.save(generatedPdf.filename);
      await this.uploadPDF(selectedJobId, generatedPdf.blob, generatedPdf.filename);

      toast?.({
        title: "✅ Documento generado",
        description: generatedPdf.sectionLabel
          ? `${generatedPdf.sectionLabel} se ha generado y descargado correctamente.`
          : "La hoja de ruta ha sido generada y descargada correctamente.",
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

  async generatePreview(): Promise<GeneratedHojaDeRutaPdf> {
    return this.renderPDF();
  }

  private async renderPDF(): Promise<GeneratedHojaDeRutaPdf & { sectionLabel?: string }> {
    const {
      selectedJobId,
      jobTitle,
    } = this.options;
    this.excludedSections = new Set(normalizeHojaDeRutaPrintSections(this.options.excludedSections));

    const requestedSections = this.options.sections?.length ? this.options.sections : undefined;
    const selectedSections = requestedSections;
    const sectionSelection = requestedSections ? new Set(selectedSections) : undefined;
    const selectedSectionLabel = requestedSections
      ? getHojaDeRutaPdfSelectionLabel(requestedSections) ?? "Secciones seleccionadas"
      : undefined;
    this.hasCoverPage = !requestedSections;
    this.renderedSectionCount = 0;

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
      selectedSections
        ? `Hoja de Ruta - ${selectedSectionLabel}`
        : 'Hoja de Ruta',
      this.logoData || undefined,
      headerLogoDims
    );
    
    if (this.hasCoverPage) {
      const coverSection = new CoverSection(this.pdfDoc, this.options.eventData, this.options.jobTitle, this.logoData);
      await coverSection.generateCoverPage();
    }

    if (sectionSelection) {
      await this.generateSelectedSections(sectionSelection);
      if (this.renderedSectionCount === 0) {
        this.addEmptySectionPage(requestedSections);
      }
    } else {
      await this.generateFullDocument();
    }

    // Add Sector-Pro footer to all pages with page numbers and job name
    await FooterService.addFooterToAllPages(this.pdfDoc, jobTitle, { hasCoverPage: this.hasCoverPage });

    return {
      ...this.createGeneratedPDF(),
      sectionLabel: selectedSectionLabel,
    };
  }

  private async generateFullDocument(): Promise<void> {
    // Each major section starts on a new page as per requirements.
    const includeEvent = !this.isPrintSectionExcluded("event-details") && this.contentSections.hasEventDetailsData(this.options.eventData);
    const includeVenue = !this.isPrintSectionExcluded("venue") && this.contentSections.hasVenueData(this.options.eventData);

    if (includeEvent || includeVenue) {
      let currentY = this.addSectionHeader(
        includeEvent && includeVenue
          ? "Detalles y Venue"
          : includeEvent
            ? "Detalles del Evento"
            : "Venue"
      );

      if (includeEvent) {
        currentY = this.contentSections.addEventDetailsSection(this.options.eventData, currentY);
      }

      if (includeVenue) {
        await this.contentSections.addVenueSection(
          this.options.eventData,
          this.options.venueMapPreview,
          currentY,
          this.options.imagePreviews?.venue
        );
      }
    }

    await this.addWeatherSectionIfAvailable();

    if (!this.isPrintSectionExcluded("contacts") && this.contentSections.hasContactsData(this.options.eventData)) {
      const currentY = this.addSectionHeader("Contactos");
      this.contentSections.addContactsSection(this.options.eventData, currentY);
    }

    if (!this.isPrintSectionExcluded("staff") && this.contentSections.hasStaffData(this.options.eventData)) {
      const currentY = this.addSectionHeader("Personal");
      this.contentSections.addStaffSection(this.options.eventData, currentY);
    }

    const includeAccommodationRooming = this.options.includeAccommodationRooming ?? true;
    const includeAggregatedRooming = this.options.includeAggregatedRooming ?? false;
    const includeTravelArrangements = this.options.includeTravelArrangements ?? true;
    const includeLogisticsTransport = this.options.includeLogisticsTransport ?? true;

    if (!this.isPrintSectionExcluded("travel") && includeTravelArrangements && this.contentSections.hasTravelData(this.options.travelArrangements)) {
      const currentY = this.addSectionHeader("Viajes");
      await this.contentSections.addTravelSection(
        this.options.travelArrangements,
        this.options.eventData?.venue?.address,
        currentY
      );
    }

    if (!this.isPrintSectionExcluded("accommodation") && this.contentSections.hasAccommodationData(this.options.accommodations)) {
      const currentY = this.addSectionHeader("Alojamientos");
      await this.contentSections.addAccommodationSection(
        this.options.accommodations || [],
        this.options.eventData,
        currentY,
        includeAccommodationRooming === false && includeAggregatedRooming === true
      );
    }

    if (!this.isPrintSectionExcluded("accommodation") && includeAggregatedRooming && this.contentSections.hasRoomingData(this.options.accommodations)) {
      const currentY = this.addSectionHeader("Rooming");
      this.contentSections.addRoomingSection(
        this.options.accommodations || [],
        this.options.eventData,
        currentY
      );
    }

    const includeLogisticsTransportSection =
      !this.isPrintSectionExcluded("logistics-transport") &&
      includeLogisticsTransport &&
      this.contentSections.hasLogisticsTransportData(this.options.eventData);
    const includeLogisticsDetailsSection =
      !this.isPrintSectionExcluded("logistics-details") &&
      this.contentSections.hasLogisticsDetailsData(this.options.eventData);

    if (includeLogisticsTransportSection || includeLogisticsDetailsSection) {
      const currentY = this.addSectionHeader(
        includeLogisticsTransportSection && includeLogisticsDetailsSection
          ? "Logística"
          : includeLogisticsTransportSection
            ? "Transportes"
            : "Logística del Evento"
      );
      this.contentSections.addLogisticsSection(this.options.eventData, currentY, {
        includeTransport: includeLogisticsTransportSection,
        includeDetails: includeLogisticsDetailsSection,
      });
    }

    if (!this.isPrintSectionExcluded("power") && this.contentSections.hasPowerData(this.options.eventData)) {
      const currentY = this.addSectionHeader("Requerimientos eléctricos");
      this.contentSections.addPowerSection(this.options.eventData, currentY);
    }

    if (!this.isPrintSectionExcluded("aux-needs") && this.contentSections.hasAuxNeedsData(this.options.eventData)) {
      const currentY = this.addSectionHeader("Necesidades auxiliares");
      this.contentSections.addAuxNeedsSection(this.options.eventData, currentY);
    }

    const includeStructuredProgram =
      !this.isPrintSectionExcluded("program") &&
      this.contentSections.hasStructuredProgramData(this.options.eventData);
    const includeScheduleText =
      !this.isPrintSectionExcluded("schedule-notes") &&
      this.contentSections.hasScheduleTextData(this.options.eventData);

    if (includeStructuredProgram || includeScheduleText) {
      const currentY = this.addSectionHeader("Programa");
      this.contentSections.addProgramSection(this.options.eventData, currentY, {
        includeStructured: includeStructuredProgram,
        includeScheduleText,
      });
    }

    if (!this.isPrintSectionExcluded("restaurants") && this.contentSections.hasRestaurantsData(this.options.eventData)) {
      const currentY = this.addSectionHeader("Restaurantes");
      await this.contentSections.addRestaurantsSection(this.options.eventData, currentY);
    }
  }

  private async generateSelectedSections(sectionSelection: Set<HojaDeRutaPdfSectionId>): Promise<void> {
    if (sectionSelection.has("event")) {
      if (this.contentSections.hasEventDetailsData(this.options.eventData)) {
        const currentY = this.addSectionHeader("Evento");
        this.contentSections.addEventDetailsSection(this.options.eventData, currentY);
      }

      if (this.contentSections.hasAuxNeedsData(this.options.eventData)) {
        const currentY = this.addSectionHeader("Necesidades auxiliares");
        this.contentSections.addAuxNeedsSection(this.options.eventData, currentY);
      }
    }

    if (sectionSelection.has("venue") && this.hasVenueExportData()) {
      const currentY = this.addSectionHeader("Venue");
      await this.contentSections.addVenueSection(
        this.options.eventData,
        this.options.venueMapPreview,
        currentY,
        this.options.imagePreviews?.venue
      );
    }

    if (sectionSelection.has("weather")) {
      await this.addWeatherSectionIfAvailable();
    }

    if (sectionSelection.has("contacts") && this.contentSections.hasContactsData(this.options.eventData)) {
      const currentY = this.addSectionHeader("Contactos");
      this.contentSections.addContactsSection(this.options.eventData, currentY);
    }

    if (sectionSelection.has("staff") && this.contentSections.hasStaffData(this.options.eventData)) {
      const currentY = this.addSectionHeader("Personal");
      this.contentSections.addStaffSection(this.options.eventData, currentY);
    }

    if (sectionSelection.has("travel") && this.contentSections.hasTravelData(this.options.travelArrangements)) {
      const currentY = this.addSectionHeader("Viajes");
      await this.contentSections.addTravelSection(
        this.options.travelArrangements,
        this.options.eventData?.venue?.address,
        currentY
      );
    }

    if (sectionSelection.has("accommodation") && this.contentSections.hasAccommodationData(this.options.accommodations)) {
      const currentY = this.addSectionHeader("Alojamiento");
      await this.contentSections.addAccommodationSection(
        this.options.accommodations || [],
        this.options.eventData,
        currentY
      );
    }

    if (sectionSelection.has("logistics") && this.contentSections.hasLogisticsData(this.options.eventData)) {
      const currentY = this.addSectionHeader("Logística");
      this.contentSections.addLogisticsSection(this.options.eventData, currentY);
    }

    if (sectionSelection.has("schedule")) {
      if (this.contentSections.hasProgramData(this.options.eventData)) {
        const currentY = this.addSectionHeader("Programa");
        this.contentSections.addProgramSection(this.options.eventData, currentY);
      }

      if (this.contentSections.hasPowerData(this.options.eventData)) {
        const currentY = this.addSectionHeader("Requerimientos eléctricos");
        this.contentSections.addPowerSection(this.options.eventData, currentY);
      }
    }

    if (sectionSelection.has("restaurants") && this.contentSections.hasRestaurantsData(this.options.eventData)) {
      const currentY = this.addSectionHeader("Restaurantes");
      await this.contentSections.addRestaurantsSection(this.options.eventData, currentY);
    }
  }

  private async addWeatherSectionIfAvailable(): Promise<void> {
    if (this.isPrintSectionExcluded("weather")) {
      return;
    }

    if (this.contentSections.hasWeatherData(this.options.eventData)) {
      const currentY = this.addSectionHeader("Clima");
      this.contentSections.addWeatherSection(this.options.eventData, currentY);
      return;
    }

    try {
      const { getWeatherForJob } = await import('@/utils/weather/weatherApi');
      if (this.options.eventData?.venue && this.options.eventData?.eventDates) {
        const weather = await getWeatherForJob(
          this.options.eventData.venue,
          this.options.eventData.eventDates
        );
        if (weather && weather.length > 0) {
          const eventDataWithWeather = {
            ...this.options.eventData,
            weather,
          };
          const currentY = this.addSectionHeader("Clima");
          this.contentSections.addWeatherSection(eventDataWithWeather, currentY);
        }
      }
    } catch (e) {
      console.warn('Weather fetch during PDF generation failed:', e);
    }
  }

  private addSectionHeader(title: string): number {
    const currentY = this.headerSection.addSectionHeader(title, 55, {
      startOnNewPage: this.hasCoverPage || this.renderedSectionCount > 0,
    });
    this.renderedSectionCount += 1;
    return currentY;
  }

  private addEmptySectionPage(sectionIds: readonly HojaDeRutaPdfSectionId[] | undefined): void {
    const title = getHojaDeRutaPdfSelectionLabel(sectionIds) ?? "Hoja de Ruta";
    const currentY = this.addSectionHeader(title);
    this.pdfDoc.setText(11, [80, 80, 80]);
    this.pdfDoc.addText("No hay datos disponibles para esta sección.", 20, currentY);
  }

  private hasVenueExportData(): boolean {
    return this.contentSections.hasVenueData(this.options.eventData) ||
      Boolean(this.options.venueMapPreview) ||
      Boolean(this.options.imagePreviews?.venue?.length);
  }

  private isPrintSectionExcluded(sectionId: HojaDeRutaPrintSectionId): boolean {
    return this.excludedSections.has(sectionId);
  }

  private createGeneratedPDF(): GeneratedHojaDeRutaPdf {
    const { eventData, jobTitle } = this.options;
    const sectionFilenameLabel = this.options.sections?.length === 1
      ? getHojaDeRutaPdfSectionFilenameLabel(this.options.sections[0])
      : undefined;
    const sectionTitleLabel = this.options.sections?.length
      ? getHojaDeRutaPdfSelectionLabel(this.options.sections)
      : undefined;
    
    // Generate filename
    const eventName = eventData.eventName || jobTitle || 'Evento';
    const safeEventName = eventName.replace(/_/g, ' ').replace(/\s+/g, ' ').trim() || 'Evento';
    const nowIso = new Date().toISOString();
    const datePart = nowIso.slice(0, 10); // YYYY-MM-DD (UTC)
    const timePart = nowIso.slice(11, 19).replace(/:/g, '-'); // HH-MM-SS (UTC)
    const sectionPart = sectionFilenameLabel ? ` - ${sectionFilenameLabel}` : "";
    const filename = `Hoja de Ruta${sectionPart} - ${safeEventName} - ${datePart} ${timePart}.pdf`;

    return {
      blob: this.pdfDoc.outputBlob(),
      filename,
      title: sectionTitleLabel ? `Hoja de Ruta - ${sectionTitleLabel}` : 'Hoja de Ruta',
    };
  }

  private async uploadPDF(selectedJobId: string, pdfBlob: Blob, filename: string): Promise<void> {
    try {
      await uploadPdfToJob(selectedJobId, pdfBlob, filename);
      console.log('✅ PDF uploaded to job storage successfully');
    } catch (uploadError) {
      console.error('❌ Error uploading PDF to job storage:', uploadError);
      // Continue anyway - local download still works
    }
  }
}
