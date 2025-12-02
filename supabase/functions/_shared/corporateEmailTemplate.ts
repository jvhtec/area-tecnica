/**
 * Shared corporate email template helper
 * Wraps custom HTML content with branded header and footer
 */

interface CorporateTemplateOptions {
  /** Custom HTML body content */
  bodyHtml: string;
  /** Email subject line (used in HTML title) */
  subject: string;
  /** Optional greeting name (e.g., "Juan" for "Hola Juan,") */
  greeting?: string;
}

/**
 * Wraps arbitrary HTML content in the corporate email template
 * with Sector Pro and Área Técnica branding
 */
export function wrapInCorporateTemplate(options: CorporateTemplateOptions): string {
  const { bodyHtml, subject, greeting } = options;

  // Fetch corporate logo URLs from environment
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const COMPANY_LOGO_URL = Deno.env.get('COMPANY_LOGO_URL_W') ||
    (SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/company-assets/sectorlogow.png` : '');
  const AT_LOGO_URL = Deno.env.get('AT_LOGO_URL') ||
    (SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/company-assets/area-tecnica-logo.png` : '');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;padding:24px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.06);">
          <!-- Header with logos -->
          <tr>
            <td style="padding:16px 20px;background:#0b0b0b;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left" style="vertical-align:middle;">
                    ${COMPANY_LOGO_URL ? `<img src="${COMPANY_LOGO_URL}" alt="Sector Pro" height="36" style="display:block;border:0;max-height:36px" />` : ''}
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    ${AT_LOGO_URL ? `<img src="${AT_LOGO_URL}" alt="Área Técnica" height="36" style="display:block;border:0;max-height:36px" />` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Optional greeting -->
          ${greeting ? `
          <tr>
            <td style="padding:24px 24px 8px 24px;">
              <h2 style="margin:0 0 8px 0;font-size:20px;color:#111827;">Hola ${escapeHtml(greeting)},</h2>
            </td>
          </tr>
          ` : ''}

          <!-- Custom body content -->
          <tr>
            <td style="padding:${greeting ? '8px' : '24px'} 24px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer with confidentiality notice -->
          <tr>
            <td style="padding:16px 24px;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.5;border-top:1px solid #e5e7eb;">
              <div style="margin-bottom:8px;">
                Este correo es confidencial y puede contener información privilegiada. Si no eres el destinatario, por favor notifícanos y elimina este mensaje.
              </div>
              <div>
                Sector Pro · <a href="https://www.sector-pro.com" style="color:#6b7280;text-decoration:underline;">www.sector-pro.com</a>
                &nbsp;|&nbsp; Área Técnica · <a href="https://sector-pro.work" style="color:#6b7280;text-decoration:underline;">sector-pro.work</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Simple HTML escape helper
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m] || m);
}
