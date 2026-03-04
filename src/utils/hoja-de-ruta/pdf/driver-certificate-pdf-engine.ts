import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { supabase } from '@/lib/supabase';

import { uploadPdfToJob } from '../pdf-upload';
import { PDFDocument } from './core/pdf-document';
import { DriverCertificatePDFGenerationOptions } from './core/pdf-types';
import { FooterService } from './services/footer-service';
import { HeaderService } from './services/header-service';
import { LogoService } from './services/logo-service';
import { MapService } from './services/map-service';
import { StampImage, StampService } from './services/stamp-service';
import { DeliveryCertificateSection } from './sections/delivery-certificate';
import { Formatters } from './utils/formatters';
import type { EventData, Transport } from '@/types/hoja-de-ruta';

type LogisticsEventRow = {
  id: string;
  event_type: string;
  transport_type: string;
  event_date: string;
  event_time: string;
  license_plate: string | null;
  loading_bay: string | null;
  title: string | null;
  is_hoja_relevant?: boolean | null;
};

type CertificateJobContext = {
  invoicingCompany?: string | null;
  jobLocation?: string | null;
};

export class DriverCertificatePDFEngine {
  private pdfDoc: PDFDocument;
  private deliveryCertificateSection: DeliveryCertificateSection;

  constructor(private options: DriverCertificatePDFGenerationOptions) {
    this.pdfDoc = new PDFDocument();
    this.deliveryCertificateSection = new DeliveryCertificateSection(this.pdfDoc);
  }

  async generate(): Promise<void> {
    const {
      eventData,
      selectedJobId,
      jobTitle,
      jobDate,
      venueMapPreview = null,
      toast,
    } = this.options;

    try {
      const [logoData, logisticsEvents, certificateJobContext, sectorProStamp] = await Promise.all([
        LogoService.loadJobLogo(selectedJobId),
        this.fetchWarehouseLogisticsEvents(selectedJobId, eventData),
        this.fetchDeliveryCertificateJobContext(selectedJobId),
        StampService.loadExactSectorProStamp(),
      ]);

      const headerLogoDims = await this.getHeaderLogoDims(logoData);
      HeaderService.addHeaderToCurrentPage(
        this.pdfDoc,
        'Certificado Conductores',
        jobTitle,
        jobDate,
        logoData || undefined,
        headerLogoDims
      );

      let yPosition = 54;

      yPosition = await this.addVenueSection(eventData, yPosition, venueMapPreview);
      yPosition = this.addContactsSection(eventData, yPosition);
      yPosition = this.addWarehouseScheduleSection(logisticsEvents, yPosition);

      const logisticsTypeBySourceId = new Map<string, string>(
        logisticsEvents.map((event) => [event.id, event.event_type])
      );
      yPosition = this.addVenueScheduleSection(eventData, yPosition, logisticsTypeBySourceId);
      yPosition = this.addLegalCertificateSection(eventData, yPosition, {
        ...certificateJobContext,
        issueDate: new Date(),
        stamp: sectorProStamp,
      });

      await FooterService.addFooterToAllPages(this.pdfDoc, jobTitle);
      await this.saveAndUploadPDF();

      toast?.({
        title: '✅ Documento generado',
        description: 'El certificado de conductores ha sido generado y descargado correctamente.',
      });
    } catch (error) {
      console.error('Error generating driver certificate PDF:', error);
      toast?.({
        title: '❌ Error',
        description: 'Hubo un problema al generar el certificado de conductores.',
        variant: 'destructive',
      });
      throw error;
    }
  }

  private async addVenueSection(eventData: EventData, yPosition: number, venueMapPreview: string | null): Promise<number> {
    const venueName = (eventData.venue?.name || '').trim();
    const venueAddress = (eventData.venue?.address || '').trim();
    const hasVenueData = Boolean(venueName || venueAddress || venueMapPreview);
    if (!hasVenueData) return yPosition;

    yPosition = this.addSectionTitle('Recinto', yPosition);
    this.pdfDoc.setText(10, [51, 51, 51]);

    if (venueName) {
      this.pdfDoc.addText(`Recinto: ${venueName}`, 20, yPosition);
      yPosition += 6;
    }

    if (venueAddress) {
      const addressLines = this.pdfDoc.splitText(`Dirección: ${venueAddress}`, this.pdfDoc.dimensions.width - 40);
      addressLines.forEach((line) => {
        this.pdfDoc.addText(line, 20, yPosition);
        yPosition += 5;
      });
      yPosition += 2;
    }

    const mapWidth = this.pdfDoc.dimensions.width - 40;
    const mapHeight = 65;
    const mapDataUrl = await this.resolveVenueMapDataUrl(venueAddress, venueMapPreview, mapWidth, mapHeight);

    if (mapDataUrl) {
      yPosition = this.pdfDoc.checkPageBreak(yPosition, 75);
      this.pdfDoc.addImage(mapDataUrl, this.resolveImageFormat(mapDataUrl), 20, yPosition, mapWidth, mapHeight);
      yPosition += mapHeight + 6;
    } else if (venueAddress) {
      yPosition = this.pdfDoc.checkPageBreak(yPosition, 20);
      this.pdfDoc.setText(9, [120, 120, 120]);
      this.pdfDoc.addText('Mapa del recinto no disponible para esta dirección.', 20, yPosition);
      yPosition += 6;
    }

    return yPosition;
  }

  private addContactsSection(eventData: EventData, yPosition: number): number {
    const contacts = (eventData.contacts || [])
      .filter((contact) => (contact.name || contact.role || contact.phone || contact.email));

    if (contacts.length === 0) return yPosition;

    yPosition = this.addSectionTitle('Personal de contacto', yPosition);

    this.pdfDoc.addTable({
      startY: yPosition,
      head: [['Nombre', 'Rol', 'Teléfono', 'Email']],
      body: contacts.map((contact) => [
        contact.name || '',
        contact.role || '',
        contact.phone || '',
        contact.email || '',
      ]),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [250, 245, 245] },
      margin: { left: 20, right: 20 },
    });

    return this.pdfDoc.getLastAutoTableY() + 8;
  }

  private addWarehouseScheduleSection(logisticsEvents: LogisticsEventRow[], yPosition: number): number {
    yPosition = this.addSectionTitle('Horarios Nave Sector Pro', yPosition);

    if (logisticsEvents.length === 0) {
      this.pdfDoc.setText(10, [90, 90, 90]);
      this.pdfDoc.addText('No hay eventos de carga/descarga relevantes configurados en logística.', 20, yPosition);
      return yPosition + 8;
    }

    this.pdfDoc.addTable({
      startY: yPosition,
      head: [['Tipo', 'Fecha', 'Hora', 'Vehículo', 'Matrícula', 'Muelle / Título']],
      body: logisticsEvents.map((event) => [
        this.translateEventType(event.event_type),
        this.formatDate(event.event_date),
        this.formatTime(event.event_time),
        Formatters.translateTransportType(event.transport_type),
        event.license_plate || '',
        event.loading_bay || event.title || '',
      ]),
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [250, 245, 245] },
      margin: { left: 20, right: 20 },
    });

    return this.pdfDoc.getLastAutoTableY() + 8;
  }

  private addVenueScheduleSection(
    eventData: EventData,
    yPosition: number,
    logisticsTypeBySourceId: Map<string, string>
  ): number {
    const relevantTransports = this.getRelevantTransportRows(eventData)
      .filter((transport) => Boolean(transport.date_time));

    yPosition = this.addSectionTitle('Horarios en Recinto (Hoja de Ruta)', yPosition);
    this.pdfDoc.setText(9, [90, 90, 90]);
    this.pdfDoc.addText('Nota: "Fecha y Hora" corresponde al horario en recinto.', 20, yPosition);
    yPosition += 6;

    if (relevantTransports.length === 0) {
      this.pdfDoc.setText(10, [90, 90, 90]);
      this.pdfDoc.addText('No hay horarios en recinto cargados en transporte de Hoja de Ruta.', 20, yPosition);
      return yPosition + 8;
    }

    this.pdfDoc.addTable({
      startY: yPosition,
      head: [['Tipo', 'Fecha y Hora (Recinto)', 'Matrícula', 'Empresa', 'Conductor']],
      body: relevantTransports.map((transport) => {
        const sourceType = transport.source_logistics_event_id
          ? logisticsTypeBySourceId.get(transport.source_logistics_event_id)
          : undefined;

        return [
          sourceType ? this.translateEventType(sourceType) : 'Sin tipo',
          transport.date_time ? Formatters.formatDateTime(transport.date_time) : '',
          transport.license_plate || '',
          Formatters.translateCompany(transport.company || ''),
          transport.driver_name || '',
        ];
      }),
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [250, 245, 245] },
      margin: { left: 20, right: 20 },
    });

    return this.pdfDoc.getLastAutoTableY() + 8;
  }

  private addLegalCertificateSection(
    eventData: EventData,
    yPosition: number,
    context: { invoicingCompany?: string | null; jobLocation?: string | null; issueDate?: Date; stamp?: StampImage | null }
  ): number {
    // Keep legal section title and body together; avoid orphan title at page bottom.
    yPosition = this.pdfDoc.checkPageBreak(yPosition, 190);
    yPosition = this.addSectionTitle('Certificado legal de entrega', yPosition);

    const before = yPosition;
    const after = this.deliveryCertificateSection.addDeliveryCertificateSection(eventData, yPosition, context);
    if (after === before) {
      this.pdfDoc.setText(10, [90, 90, 90]);
      this.pdfDoc.addText('No hay transportes relevantes para completar el certificado legal.', 20, yPosition);
      return yPosition + 8;
    }

    return after;
  }

  private addSectionTitle(title: string, yPosition: number): number {
    yPosition = this.pdfDoc.checkPageBreak(yPosition, 20);

    this.pdfDoc.setText(13, [125, 1, 1]);
    this.pdfDoc.addText(title, 20, yPosition);
    this.pdfDoc.setFillColor(125, 1, 1);
    this.pdfDoc.addRect(20, yPosition + 2, this.pdfDoc.dimensions.width - 40, 1, 'F');

    return yPosition + 8;
  }

  private getRelevantTransportRows(eventData: EventData): Transport[] {
    return (eventData.logistics?.transport || []).filter((transport) => transport?.is_hoja_relevant !== false);
  }

  private async fetchWarehouseLogisticsEvents(jobId: string, eventData: EventData): Promise<LogisticsEventRow[]> {
    try {
      const { data, error } = await supabase
        .from('logistics_events')
        .select('id,event_type,transport_type,event_date,event_time,license_plate,loading_bay,title,is_hoja_relevant')
        .eq('job_id', jobId)
        .order('event_date', { ascending: true })
        .order('event_time', { ascending: true });

      if (error) throw error;

      const normalizedRows = this.normalizeWarehouseLogisticsRows((data || []) as LogisticsEventRow[]);
      if (normalizedRows.length > 0) return normalizedRows;

      const sourceLogisticsEventIds = Array.from(
        new Set(
          (eventData.logistics?.transport || [])
            .filter((transport) => transport?.is_hoja_relevant !== false)
            .map((transport) => transport?.source_logistics_event_id)
            .filter((id): id is string => Boolean(id))
        )
      );

      let sourceLinkedRows: LogisticsEventRow[] = [];
      if (sourceLogisticsEventIds.length > 0) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('logistics_events')
          .select('id,event_type,transport_type,event_date,event_time,license_plate,loading_bay,title,is_hoja_relevant')
          .in('id', sourceLogisticsEventIds)
          .order('event_date', { ascending: true })
          .order('event_time', { ascending: true });

        if (fallbackError) throw fallbackError;

        sourceLinkedRows = this.normalizeWarehouseLogisticsRows((fallbackData || []) as LogisticsEventRow[]);
        if (sourceLinkedRows.length > 0) return sourceLinkedRows;
      }

      const relatedJobIds = await this.findRelatedJobIdsForWarehouseFallback(jobId);
      if (relatedJobIds.length === 0) return sourceLinkedRows;

      const { data: relatedJobEvents, error: relatedJobEventsError } = await supabase
        .from('logistics_events')
        .select('id,event_type,transport_type,event_date,event_time,license_plate,loading_bay,title,is_hoja_relevant')
        .in('job_id', relatedJobIds)
        .order('event_date', { ascending: true })
        .order('event_time', { ascending: true });

      if (relatedJobEventsError) throw relatedJobEventsError;

      return this.normalizeWarehouseLogisticsRows((relatedJobEvents || []) as LogisticsEventRow[]);
    } catch (error) {
      console.warn('Unable to fetch warehouse logistics events for driver certificate:', error);
      return [];
    }
  }

  private normalizeWarehouseLogisticsRows(rows: LogisticsEventRow[]): LogisticsEventRow[] {
    return rows
      .filter((event) => event.is_hoja_relevant !== false)
      .map((event) => {
        const normalizedType = this.normalizeEventType(event.event_type);
        return {
          ...event,
          event_type: normalizedType ?? event.event_type,
        };
      })
      .filter((event) => Boolean(this.normalizeEventType(event.event_type)));
  }

  private async findRelatedJobIdsForWarehouseFallback(jobId: string): Promise<string[]> {
    try {
      const { data: currentJob, error: currentJobError } = await supabase
        .from('jobs')
        .select('id,title,start_time')
        .eq('id', jobId)
        .maybeSingle();

      if (currentJobError) throw currentJobError;

      const currentTitle = (currentJob as any)?.title || '';
      const titlePrefix = this.extractJobTitlePrefix(currentTitle);
      if (!titlePrefix) return [];

      const { data: relatedJobs, error: relatedJobsError } = await supabase
        .from('jobs')
        .select('id,title,start_time')
        .ilike('title', `${titlePrefix}%`)
        .neq('id', jobId)
        .limit(25);

      if (relatedJobsError) throw relatedJobsError;

      const currentStartTime = (currentJob as any)?.start_time ? new Date((currentJob as any).start_time) : null;

      const candidates = ((relatedJobs || []) as Array<{ id: string; title: string | null; start_time: string | null }>)
        .map((job) => {
          const start = job.start_time ? new Date(job.start_time) : null;
          const diffHours = (currentStartTime && start)
            ? Math.abs(start.getTime() - currentStartTime.getTime()) / (1000 * 60 * 60)
            : Number.POSITIVE_INFINITY;
          return {
            id: job.id,
            diffHours,
          };
        })
        .filter((candidate) => Number.isFinite(candidate.diffHours) ? candidate.diffHours <= 72 : true)
        .sort((a, b) => a.diffHours - b.diffHours)
        .slice(0, 3)
        .map((candidate) => candidate.id);

      return Array.from(new Set(candidates));
    } catch (error) {
      console.warn('Unable to find related jobs for warehouse fallback:', error);
      return [];
    }
  }

  private extractJobTitlePrefix(title: string | null | undefined): string {
    const raw = (title || '').trim();
    if (!raw) return '';

    const withoutParen = raw.replace(/\([^)]*\)/g, '').trim();
    const collapsed = withoutParen.replace(/\s+/g, ' ').trim();
    if (!collapsed) return '';

    return collapsed;
  }

  private async fetchDeliveryCertificateJobContext(jobId: string): Promise<CertificateJobContext> {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          invoicing_company,
          location:locations(name, formatted_address)
        `)
        .eq('id', jobId)
        .maybeSingle();

      if (error) throw error;

      const location = (data as any)?.location;
      const jobLocation = (location?.formatted_address || location?.name || null) as string | null;

      return {
        invoicingCompany: (data as any)?.invoicing_company || null,
        jobLocation,
      };
    } catch (error) {
      console.warn('Unable to fetch driver certificate job context:', error);
      return {
        invoicingCompany: null,
        jobLocation: null,
      };
    }
  }

  private async saveAndUploadPDF(): Promise<void> {
    const { eventData, selectedJobId, jobTitle } = this.options;

    const eventName = eventData.eventName || jobTitle || 'Evento';
    const safeEventName = eventName.replace(/_/g, ' ').replace(/\s+/g, ' ').trim() || 'Evento';
    const nowIso = new Date().toISOString();
    const datePart = nowIso.slice(0, 10);
    const timePart = nowIso.slice(11, 19).replace(/:/g, '-');
    const filename = `Certificado de Entrega - ${safeEventName} - ${datePart} ${timePart}.pdf`;

    this.pdfDoc.save(filename);

    try {
      const pdfBlob = this.pdfDoc.outputBlob();
      await uploadPdfToJob(selectedJobId, pdfBlob, filename, { kind: 'certificado_entrega' });
      console.log('✅ Driver certificate PDF uploaded to job storage successfully');
    } catch (uploadError) {
      console.error('❌ Error uploading driver certificate PDF to job storage:', uploadError);
    }
  }

  private async getHeaderLogoDims(logoData?: string | null): Promise<{ width: number; height: number } | undefined> {
    if (!logoData) return undefined;
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const maxHeight = 28;
        const maxWidth = 160;
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (width > 0 && height > 0) {
          const scale = Math.min(maxHeight / height, maxWidth / width);
          resolve({ width: Math.round(width * scale), height: Math.round(height * scale) });
          return;
        }
        resolve({ width: 84, height: 28 });
      };
      img.onerror = () => resolve({ width: 84, height: 28 });
      img.src = logoData;
    });
  }

  private formatDate(dateValue: string): string {
    try {
      return format(new Date(`${dateValue}T00:00:00`), 'dd/MM/yyyy', { locale: es });
    } catch {
      return dateValue;
    }
  }

  private formatTime(timeValue: string): string {
    if (!timeValue) return '';
    return String(timeValue).slice(0, 5);
  }

  private translateEventType(value: string): string {
    const normalized = this.normalizeEventType(value);
    if (normalized === 'load') return 'Carga';
    if (normalized === 'unload') return 'Descarga';
    return value || 'Sin tipo';
  }

  private normalizeEventType(value: string | null | undefined): 'load' | 'unload' | null {
    const normalized = (value || '').toString().trim().toLowerCase();
    if (!normalized) return null;
    if (normalized === 'load' || normalized === 'carga') return 'load';
    if (normalized === 'unload' || normalized === 'descarga') return 'unload';
    return null;
  }

  private resolveImageFormat(dataUrl: string): 'PNG' | 'JPEG' {
    return dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
  }

  private async resolveVenueMapDataUrl(
    venueAddress: string,
    venueMapPreview: string | null,
    mapWidth: number,
    mapHeight: number
  ): Promise<string | null> {
    if (venueAddress) {
      try {
        const mapDataUrl = await MapService.getMapImageForAddress(venueAddress, mapWidth, mapHeight);
        if (mapDataUrl) return mapDataUrl;
      } catch (error) {
        console.warn('Unable to fetch venue map for driver certificate:', error);
      }
    }

    return venueMapPreview || null;
  }
}
