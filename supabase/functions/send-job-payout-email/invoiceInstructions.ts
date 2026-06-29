export const INVOICE_SUBMISSION_EMAIL = "administracion@sector-pro.com";
export const INVOICE_CC_EMAIL = "administracion@mfo-producciones.com";

export function buildInvoiceRecipientListItems(): string {
  return `
                        <li><b>Enviar factura a:</b> <a href="mailto:${INVOICE_SUBMISSION_EMAIL}" style="color:#1e40af;text-decoration:underline;">${INVOICE_SUBMISSION_EMAIL}</a></li>
                        <li><b>Poner en copia a:</b> <a href="mailto:${INVOICE_CC_EMAIL}" style="color:#1e40af;text-decoration:underline;">${INVOICE_CC_EMAIL}</a></li>`;
}
