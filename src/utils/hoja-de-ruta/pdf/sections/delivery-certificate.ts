import { format } from 'date-fns';

import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { Formatters } from '../utils/formatters';
import { StampImage, StampService } from '../services/stamp-service';

type DeliveryCertificateContext = {
  invoicingCompany?: string | null;
  jobLocation?: string | null;
  issueDate?: Date;
  stamp?: StampImage | null;
};

const formatInvoicingCompany = (value: string | null | undefined): string => {
  const trimmed = (value || '').trim();
  if (!trimmed) return 'PRODUCTION SECTOR SL.';

  const map: Record<string, string> = {
    'Production Sector': 'PRODUCTION SECTOR SL.',
    'Sharecable': 'SHARECABLE',
    'MFO': 'MFO',
  };

  return map[trimmed] || trimmed;
};

export class DeliveryCertificateSection {
  constructor(private pdfDoc: PDFDocument) {}

  addDeliveryCertificateSection(eventData: EventData, yPosition: number, context: DeliveryCertificateContext): number {
    const transports = (eventData.logistics?.transport || []).filter((t) => t.is_hoja_relevant !== false);
    if (transports.length === 0) return yPosition;

    const companies = Array.from(
      new Set(
        transports
          .map((t) => (t.company ? Formatters.translateCompany(t.company) : ''))
          .map((c) => c.trim())
          .filter(Boolean)
      )
    );

    const plates = Array.from(
      new Set(
        transports
          .map((t) => (t.license_plate || '').trim())
          .filter(Boolean)
      )
    );

    const providerLabel = companies.length > 1 ? 'las empresas' : 'la empresa';
    const providerText = companies.length > 0 ? companies.join(', ') : '________________';
    const platesText = plates.length > 0 ? plates.join(', ') : '________________';
    const verb = plates.length > 1 || companies.length > 1 ? 'transportan' : 'transporta';

    const invoicingCompany = formatInvoicingCompany(context.invoicingCompany);
    const jobLocation =
      (context.jobLocation || '').trim() ||
      (eventData.venue?.address || '').trim() ||
      (eventData.venue?.name || '').trim() ||
      '________________';

    const issueDate = context.issueDate || new Date();
    const issueDateText = format(issueDate, 'dd/MM/yyyy');

    const { width: pageWidth } = this.pdfDoc.dimensions;
    const left = 20;
    const maxWidth = pageWidth - 40;
    // jsPDF default unit is mm; keep line height compact for 11–12pt body text.
    const lineHeight = 5;

    // Ensure space for certificate body + stamp
    yPosition = this.pdfDoc.checkPageBreak(yPosition, 170);

    const doc = this.pdfDoc.document;
    doc.setFont('helvetica', 'normal');

    const addSpacer = (h: number) => (yPosition += h);
    const addParagraph = (text: string, fontSize = 11, bold = false) => {
      yPosition = this.pdfDoc.checkPageBreak(yPosition, 30);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      this.pdfDoc.setText(fontSize, [51, 51, 51]);
      const lines = this.pdfDoc.splitText(text, maxWidth);
      for (const line of lines) {
        this.pdfDoc.addText(line, left, yPosition);
        yPosition += lineHeight;
      }
    };

    addParagraph('A quien pueda interesar:', 12, true);
    addSpacer(2);

    addParagraph(
      'El abajo firmante, D. ALBERTO FRAGIO MARQUEZ, con D.N.I. 53344352 S, como gerente de la empresa PRODUCTION SECTOR SL., con C.I.F – B 86964673 y domicilio en:'
    );
    addSpacer(2);
    addParagraph('P.I. LAS NACIONES – CL. PUERTO RICO Nº 6 GRIÑON 28971 – MADRID por la presente:');
    addSpacer(3);

    this.pdfDoc.setText(12, [51, 51, 51]);
    doc.setFont('helvetica', 'bold');
    this.pdfDoc.addText('CERTIFICA QUE:', left, yPosition);
    yPosition += 7;
    doc.setFont('helvetica', 'normal');

    const hasPluralSubject = plates.length > 1 || companies.length > 1;
    const destinationVerb = hasPluralSubject ? 'tienen' : 'tiene';
    addParagraph(
      `Los vehículos propiedad de ${providerLabel} ${providerText} con matrículas ${platesText} ${verb} el material perteneciente a la empresa ${invoicingCompany} y ${destinationVerb} como destino la localidad de ${jobLocation}, para recoger y llevar material al recinto.`
    );
    addSpacer(3);

    doc.setFont('helvetica', 'bold');
    this.pdfDoc.addText('ENTREGA;', left, yPosition);
    yPosition += 8;
    doc.setFont('helvetica', 'normal');

    addParagraph('Y para que conste a los efectos oportunos expido el presente certificado en GRIÑON (MADRID)');
    addSpacer(3);
    addParagraph(`a ${issueDateText}`);

    // Stamp (image)
    const stamp = context.stamp || StampService.getFallbackSectorProStamp();
    if (stamp) {
      const stampWidth = 70;
      const stampHeight = Math.round(stampWidth * (stamp.height / stamp.width));
      const stampX = pageWidth - 20 - stampWidth;
      const stampY = this.pdfDoc.checkPageBreak(yPosition + 6, stampHeight + 10);
      this.pdfDoc.addImage(stamp.dataUrl, 'PNG', stampX, stampY, stampWidth, stampHeight);
      yPosition = Math.max(yPosition, stampY + stampHeight + 6);
    }

    return yPosition;
  }
}
