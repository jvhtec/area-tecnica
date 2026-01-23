import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { JobPayoutEmailContextResult } from '@/lib/job-payout-email';
import { getInvoicingCompanyDetails } from '@/utils/invoicing-company-data';
import { HOUSE_TECH_LABEL } from '@/utils/autonomo';

interface PayoutEmailPreviewProps {
  open: boolean;
  onClose: () => void;
  context: JobPayoutEmailContextResult | null;
  jobTitle: string;
}

export function PayoutEmailPreview({ open, onClose, context, jobTitle }: PayoutEmailPreviewProps) {
  const [selectedTechId, setSelectedTechId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (context && context.attachments.length > 0 && !selectedTechId) {
      setSelectedTechId(context.attachments[0].technician_id);
    }
  }, [context, selectedTechId]);

  if (!context) return null;

  const selectedAttachment = context.attachments.find(a => a.technician_id === selectedTechId);

  const handleDownloadPDF = () => {
    if (!selectedAttachment) return;

    try {
      const byteCharacters = atob(selectedAttachment.pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = selectedAttachment.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download PDF:', error);
    }
  };

  // Generate email HTML preview
  const getEmailHTML = () => {
    if (!selectedAttachment) return '';

    const formatCurrency = (amount?: number) => {
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
      }).format(Number(amount ?? 0));
    };

    const formatWorkedDates = (dates: string[]) => {
      if (!dates || dates.length === 0) return 'el ' + new Date(context.job.start_time).toLocaleDateString('es-ES', { dateStyle: 'long' });

      const parsed = dates.map(d => new Date(d)).sort((a, b) => a.getTime() - b.getTime());

      if (parsed.length === 1) {
        return 'el ' + parsed[0].toLocaleDateString('es-ES', { dateStyle: 'long' });
      }

      if (parsed.length === 2) {
        return `los días ${parsed[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} y ${parsed[1].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`;
      }

      const firstDate = parsed[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      const lastDate = parsed[parsed.length - 1].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      return `los días ${firstDate} - ${lastDate} (${parsed.length} días)`;
    };

    const timesheetLines = context.timesheetMap.get(selectedAttachment.technician_id) || [];
    const workedDates = Array.from(new Set(timesheetLines.map(l => l.date).filter((d): d is string => d != null))).sort();
    const dateText = formatWorkedDates(workedDates);

    const parts = formatCurrency(selectedAttachment.payout.timesheets_total_eur);
    const extras = formatCurrency(selectedAttachment.payout.extras_total_eur);
    const grand = formatCurrency(selectedAttachment.payout.total_eur - (selectedAttachment.deduction_eur || 0));
    const deductionAmount = selectedAttachment.deduction_eur ?? 0;
    const deductionFormatted = formatCurrency(deductionAmount);
    const hasDeduction = deductionAmount > 0;
    const lpoNumber = selectedAttachment.lpo_number;
    const invoicingCompany = context.job.invoicing_company;
    const companyDetails = getInvoicingCompanyDetails(invoicingCompany);

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Resumen de pagos · ${context.job.title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;padding:24px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding:16px 20px;background:#0b0b0b;">
              <div style="text-align: center; color: white; font-size: 16px; font-weight: bold;">SECTOR PRO / ÁREA TÉCNICA</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 24px 8px 24px;">
              <h2 style="margin:0 0 8px 0;font-size:20px;color:#111827;">Hola ${selectedAttachment.full_name || 'equipo'},</h2>
              <p style="margin:0;color:#374151;line-height:1.55;">
                Adjuntamos tu resumen de pagos correspondiente al trabajo <b>${context.job.title}</b>, realizado <b>${dateText}</b>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 24px 0 24px;">
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;color:#374151;font-size:14px;">
                <b>Totales registrados</b>
                <ul style="margin:10px 0 0 18px;padding:0;line-height:1.55;">
                  <li><b>Partes aprobados:</b> ${parts}</li>
                  <li><b>Extras:</b> ${extras}</li>
                  ${hasDeduction ? `<li><b style="color:#b91c1c;">Deducción IRPF (estimada):</b> -${deductionFormatted}</li>` : ''}
                  <li><b>Total general:</b> ${grand}</li>
                </ul>
                ${hasDeduction ? `<p style="margin:10px 0 0 0;font-size:12px;color:#b91c1c;">* Se ha aplicado una deducción de 30€/día por condición de no autónomo.</p>` : ''}
              </div>
            </td>
          </tr>
          ${selectedAttachment.autonomo && !selectedAttachment.is_house_tech && (companyDetails || lpoNumber) ? `
          <tr>
            <td style="padding:12px 24px 0 24px;">
              <div style="background:#dbeafe;border:1px solid #93c5fd;border-radius:8px;padding:12px 14px;color:#1e40af;font-size:14px;">
                <b>Nota de facturación:</b>
                <p style="margin:8px 0 0 0;line-height:1.55;">
                  ${companyDetails ? `Te rogamos emitas tu factura a: <b>${companyDetails.legalName}</b> (CIF: ${companyDetails.cif}, ${companyDetails.address})` : ''}${companyDetails && lpoNumber ? ' e incluyas el siguiente número de referencia: ' : ''}${lpoNumber ? `<b>${lpoNumber}</b>` : ''}.
                </p>
              </div>
            </td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding:16px 24px 8px 24px;">
              <p style="margin:0;color:#374151;line-height:1.55;">
                Si detectas alguna incidencia no respondas a este mensaje y contacta con administración.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.5;border-top:1px solid #e5e7eb;">
              <div style="margin-bottom:8px;">
                Este correo es confidencial y puede contener información privilegiada. Si no eres el destinatario, por favor notifícanos y elimina este mensaje.
              </div>
              <div>
                Sector Pro · www.sector-pro.com | Área Técnica · sector-pro.work
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Vista Previa - Correo de Pago</DialogTitle>
          <DialogDescription>
            {jobTitle} • {context.attachments.length} técnico{context.attachments.length > 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Technician Selector */}
          {context.attachments.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {context.attachments.map((attachment) => (
                <Button
                  key={attachment.technician_id}
                  variant={selectedTechId === attachment.technician_id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTechId(attachment.technician_id)}
                >
                  {attachment.full_name}
                </Button>
              ))}
            </div>
          )}

          {/* Preview Content */}
          {selectedAttachment && (
            <Tabs defaultValue="email" className="flex-1 flex flex-col overflow-hidden">
              <TabsList>
                <TabsTrigger value="email">Email HTML</TabsTrigger>
                <TabsTrigger value="data">Datos</TabsTrigger>
              </TabsList>

              <TabsContent value="email" className="flex-1 overflow-auto border rounded-md p-4">
                <div dangerouslySetInnerHTML={{ __html: getEmailHTML() }} />
              </TabsContent>

              <TabsContent value="data" className="flex-1 overflow-auto">
                <div className="space-y-4 text-sm">
                  <div>
                    <div className="font-semibold">Para:</div>
                    <div>{selectedAttachment.email || '❌ Sin email'}</div>
                  </div>
                  <div>
                    <div className="font-semibold">CC:</div>
                    <div>administracion@mfo-producciones.com</div>
                  </div>
                  <div>
                    <div className="font-semibold">Asunto:</div>
                    <div>Resumen de pagos · {context.job.title}</div>
                  </div>
                  <div>
                    <div className="font-semibold">PDF Adjunto:</div>
                    <div className="flex items-center gap-2">
                      <span>{selectedAttachment.filename}</span>
                      <Button size="sm" variant="outline" onClick={handleDownloadPDF}>
                        <Download className="h-4 w-4 mr-1" />
                        Descargar PDF
                      </Button>
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold">Estado PDF:</div>
                    <div className="text-green-600">✓ Generado ({Math.round(selectedAttachment.pdfBase64.length / 1024)} KB)</div>
                  </div>
                  <div>
                    <div className="font-semibold">Técnico:</div>
                    <div>{selectedAttachment.full_name} ({selectedAttachment.is_house_tech ? HOUSE_TECH_LABEL : selectedAttachment.autonomo ? 'Autónomo' : 'No autónomo'})</div>
                  </div>
                  <div>
                    <div className="font-semibold">Fechas trabajadas:</div>
                    <div className="space-y-1">
                      {(() => {
                        const lines = context.timesheetMap.get(selectedAttachment.technician_id) || [];
                        const dates = Array.from(new Set(lines.map(l => l.date).filter(Boolean)));
                        return dates.length > 0
                          ? dates.map(d => <div key={d}>{new Date(d!).toLocaleDateString('es-ES')}</div>)
                          : <div className="text-muted-foreground">Sin partes registrados</div>;
                      })()}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-1" />
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
