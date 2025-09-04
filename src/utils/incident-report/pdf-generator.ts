import { PDFDocument } from '../hoja-de-ruta/pdf/core/pdf-document';
import { LogoService } from '../hoja-de-ruta/pdf/services/logo-service';

interface IncidentReportPDFData {
  jobId: string;
  jobTitle: string;
  jobStartDate: string;
  jobEndDate: string;
  equipmentModel: string;
  brand: string;
  issue: string;
  actionsTaken: string;
  techName: string;
  signature: string;
}

export const generateIncidentReportPDF = async (data: IncidentReportPDFData): Promise<void> => {
  const pdfDoc = new PDFDocument();
  const { width: pageWidth, height: pageHeight } = pdfDoc.dimensions;
  
  // Load company logo
  let logoData: string | null = null;
  try {
    logoData = await LogoService.loadJobLogo(data.jobId);
  } catch (error) {
    console.warn('Could not load logo:', error);
  }

  // Header - Corporate Red Background
  pdfDoc.setFillColor(125, 1, 1);
  pdfDoc.addRect(0, 0, pageWidth, 50, 'F');

  // Logo in header
  if (logoData) {
    try {
      const logoImg = new Image();
      logoImg.src = logoData;
      const logoHeight = 30;
      const logoWidth = logoHeight * (logoImg.width / logoImg.height) || 60;
      pdfDoc.addImage(logoData, 'PNG', 15, 10, logoWidth, logoHeight);
    } catch (error) {
      console.error("Error adding logo to incident report:", error);
    }
  }

  // Header title - White text
  pdfDoc.setText(18, [255, 255, 255]);
  pdfDoc.addText('REPORTE DE INCIDENCIA', pageWidth / 2, 20, { align: 'center' });

  pdfDoc.setText(12, [255, 255, 255]);
  pdfDoc.addText('DEPARTAMENTO DE SONIDO', pageWidth / 2, 35, { align: 'center' });

  let yPosition = 70;

  // Report metadata
  pdfDoc.setText(10, [0, 0, 0]);
  const currentDate = new Date();
  const dateStr = currentDate.toLocaleDateString('es-ES');
  const timeStr = currentDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  
  pdfDoc.addText(`Fecha de creación: ${dateStr} - ${timeStr}`, 20, yPosition);
  yPosition += 20;

  // Job Information Section
  pdfDoc.setText(14, [125, 1, 1]);
  pdfDoc.addText('INFORMACIÓN DEL TRABAJO', 20, yPosition);
  yPosition += 15;

  // Job details table
  pdfDoc.addTable({
    startY: yPosition,
    head: [['Campo', 'Valor']],
    body: [
      ['Trabajo', data.jobTitle],
      ['Fecha de inicio', new Date(data.jobStartDate).toLocaleDateString('es-ES')],
      ['Fecha de fin', new Date(data.jobEndDate).toLocaleDateString('es-ES')]
    ],
    margin: { left: 20, right: 20 },
    styles: {
      fontSize: 10,
      cellPadding: 5,
    },
    headStyles: {
      fillColor: [125, 1, 1],
      textColor: [255, 255, 255],
      fontSize: 11,
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250]
    }
  });

  yPosition = pdfDoc.getLastAutoTableY() + 20;

  // Equipment Information Section
  pdfDoc.setText(14, [125, 1, 1]);
  pdfDoc.addText('INFORMACIÓN DEL EQUIPO', 20, yPosition);
  yPosition += 15;

  // Equipment details table
  pdfDoc.addTable({
    startY: yPosition,
    head: [['Campo', 'Valor']],
    body: [
      ['Marca', data.brand],
      ['Modelo', data.equipmentModel]
    ],
    margin: { left: 20, right: 20 },
    styles: {
      fontSize: 10,
      cellPadding: 5,
    },
    headStyles: {
      fillColor: [125, 1, 1],
      textColor: [255, 255, 255],
      fontSize: 11,
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250]
    }
  });

  yPosition = pdfDoc.getLastAutoTableY() + 20;

  // Issue Section
  pdfDoc.setText(14, [125, 1, 1]);
  pdfDoc.addText('DESCRIPCIÓN DE LA INCIDENCIA', 20, yPosition);
  yPosition += 15;

  // Issue description box
  pdfDoc.setFillColor(248, 249, 250);
  const issueBoxHeight = Math.max(40, Math.ceil(data.issue.length / 80) * 6);
  pdfDoc.addRect(20, yPosition - 5, pageWidth - 40, issueBoxHeight, 'F');
  
  pdfDoc.document.setDrawColor(200, 200, 200);
  pdfDoc.document.setLineWidth(0.5);
  pdfDoc.document.rect(20, yPosition - 5, pageWidth - 40, issueBoxHeight);

  pdfDoc.setText(10, [0, 0, 0]);
  const issueLines = pdfDoc.document.splitTextToSize(data.issue, pageWidth - 50);
  pdfDoc.document.text(issueLines, 25, yPosition + 5);
  
  yPosition += issueBoxHeight + 15;

  // Actions Taken Section
  yPosition = pdfDoc.checkPageBreak(yPosition, 60);
  
  pdfDoc.setText(14, [125, 1, 1]);
  pdfDoc.addText('ACCIONES REALIZADAS', 20, yPosition);
  yPosition += 15;

  // Actions description box
  pdfDoc.setFillColor(248, 249, 250);
  const actionsBoxHeight = Math.max(40, Math.ceil(data.actionsTaken.length / 80) * 6);
  pdfDoc.addRect(20, yPosition - 5, pageWidth - 40, actionsBoxHeight, 'F');
  
  pdfDoc.document.setDrawColor(200, 200, 200);
  pdfDoc.document.setLineWidth(0.5);
  pdfDoc.document.rect(20, yPosition - 5, pageWidth - 40, actionsBoxHeight);

  pdfDoc.setText(10, [0, 0, 0]);
  const actionsLines = pdfDoc.document.splitTextToSize(data.actionsTaken, pageWidth - 50);
  pdfDoc.document.text(actionsLines, 25, yPosition + 5);
  
  yPosition += actionsBoxHeight + 20;

  // Signature Section
  yPosition = pdfDoc.checkPageBreak(yPosition, 80);
  
  pdfDoc.setText(14, [125, 1, 1]);
  pdfDoc.addText('FIRMA DEL TÉCNICO', 20, yPosition);
  yPosition += 15;

  // Technician name
  pdfDoc.setText(12, [0, 0, 0]);
  pdfDoc.addText(`Técnico: ${data.techName}`, 20, yPosition);
  yPosition += 15;

  // Signature image
  if (data.signature) {
    try {
      // Signature box
      pdfDoc.document.setDrawColor(200, 200, 200);
      pdfDoc.document.setLineWidth(0.5);
      pdfDoc.document.rect(20, yPosition - 5, 150, 50);
      
      // Add signature image
      pdfDoc.addImage(data.signature, 'PNG', 25, yPosition, 140, 40);
      
      yPosition += 55;
    } catch (error) {
      console.error("Error adding signature image:", error);
      // Fallback: just show a text indication
      pdfDoc.setText(10, [0, 0, 0]);
      pdfDoc.addText('Firmado digitalmente', 25, yPosition + 20);
      yPosition += 30;
    }
  }

  // Date and time of signature
  pdfDoc.setText(10, [100, 100, 100]);
  pdfDoc.addText(`Fecha y hora de firma: ${dateStr} ${timeStr}`, 20, yPosition + 10);

  // Footer
  const footerY = pageHeight - 30;
  pdfDoc.document.setDrawColor(125, 1, 1);
  pdfDoc.document.setLineWidth(1);
  pdfDoc.document.line(20, footerY, pageWidth - 20, footerY);
  
  pdfDoc.setText(8, [100, 100, 100]);
  pdfDoc.addText('Reporte generado automáticamente por Sector Pro', pageWidth / 2, footerY + 10, { align: 'center' });

  // Generate filename
  const safeJobTitle = data.jobTitle.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
  const timestamp = currentDate.toISOString().split('T')[0];
  const filename = `reporte_incidencia_${safeJobTitle}_${timestamp}.pdf`;

  // Save the PDF
  pdfDoc.save(filename);
};