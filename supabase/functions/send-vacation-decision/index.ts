import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { format as formatDate } from "https://esm.sh/date-fns@3.6.0";
// Deno std@0.224.0 base64 module no longer exports `encode`.
// Implement a small Uint8Array -> Base64 helper using btoa for reliability in Edge Runtime.
function u8ToBase64(u8: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < u8.length; i += chunkSize) {
    const chunk = u8.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  // btoa expects binary string
  // In Edge runtime, btoa is available globally
  // Fallback if missing (shouldn't happen): use URL-safe variant via Buffer if present
  try {
    return btoa(binary);
  } catch (_) {
    // @ts-ignore Buffer may not exist; keep try-catch defensive
    if (typeof Buffer !== 'undefined') return Buffer.from(u8).toString('base64');
    throw new Error('Base64 encoding not supported in this environment');
  }
}

type UUID = string;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VacationDecisionRequestBody {
  request_id?: UUID;
  request_ids?: UUID[];
}

type ProfileLite = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  department?: string | null;
};

type VacationRequestRow = {
  id: string;
  technician_id: string;
  start_date: string; // ISO date
  end_date: string;   // ISO date
  reason: string | null;
  status: "pending" | "approved" | "rejected" | string;
  created_at: string | null;
  updated_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  tech?: ProfileLite | null;
  approver?: ProfileLite | null;
};

function pickEnvBase(): string | undefined {
  const candidates = [
    Deno.env.get("PUBLIC_APP_URL"),
    Deno.env.get("PUBLIC_SITE_URL"),
    Deno.env.get("NEXT_PUBLIC_SITE_URL"),
    Deno.env.get("SITE_URL"),
    Deno.env.get("PUBLIC_CONFIRM_BASE"),
  ];
  for (const val of candidates) {
    if (val && val.trim()) return val.trim();
  }
  return undefined;
}

function toOrigin(input?: string): string | undefined {
  if (!input) return undefined;
  try {
    const u = new URL(input);
    return `${u.protocol}//${u.host}`;
  } catch {
    return input.replace(/\/$/, "");
  }
}

async function generateVacationPDF(reqRow: VacationRequestRow, logos: { sectorProLogoUrl?: string } = {}) {
  // Match jsPDF A4 size (595x842 points)
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();

  // Corporate colors from client export
  const primaryColor = rgb(125 / 255, 1 / 255, 1 / 255);
  const accentColor = rgb(125 / 255, 1 / 255, 25 / 255);

  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Header (height 25 at top) and centered title at y=15 from top (convert to bottom-origin)
  page.drawRectangle({ x: 0, y: pageHeight - 25, width: pageWidth, height: 25, color: primaryColor });
  const headerTitle = 'SOLICITUD DE VACACIONES';
  const headerTitleSize = 18;
  const headerTitleWidth = helvBold.widthOfTextAtSize(headerTitle, headerTitleSize);
  page.drawText(headerTitle, {
    x: (pageWidth - headerTitleWidth) / 2,
    y: (pageHeight - 15) - (headerTitleSize * 0.35), // jsPDF y=15 from top
    size: headerTitleSize,
    font: helvBold,
    color: rgb(1, 1, 1)
  });

  // Section title 'Detalles' at (15,45) from top
  page.drawText('Detalles', { x: 15, y: (pageHeight - 45) - 16 * 0.3, size: 16, font: helvBold, color: rgb(0, 0, 0) });

  // Prepare values
  const techName = `${reqRow.tech?.first_name || ''} ${reqRow.tech?.last_name || ''}`.trim() || 'Not Available';
  const department = reqRow.tech?.department || 'Not Available';
  const createdAt = reqRow.created_at ? new Date(reqRow.created_at) : null;
  const startDate = new Date(reqRow.start_date);
  const endDate = new Date(reqRow.end_date);
  const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const approverName = `${reqRow.approver?.first_name || ''} ${reqRow.approver?.last_name || ''}`.trim() || 'Not Available';

  // Helpers to draw rows similar to jsPDF placement
  let y = 60; // jsPDF Y from top
  const label = (text: string, ypos: number) => page.drawText(text + ':', { x: 15, y: (pageHeight - ypos) - 12 * 0.3, size: 12, font: helvBold });
  const value = (text: string, ypos: number) => page.drawText(text, { x: 80, y: (pageHeight - ypos) - 12 * 0.3, size: 12, font: helv });
  const addInfoRow = (l: string, v: string) => { label(l, y); value(v, y); y += 10; };

  addInfoRow('Nombre del Empleado', techName);
  addInfoRow('Departmento', department);
  addInfoRow('Fecha de la Solicitud', createdAt ? formatDate(createdAt, 'PPP') : '');
  y += 5;
  addInfoRow('Periodo', `${formatDate(startDate, 'PPP')} - ${formatDate(endDate, 'PPP')}`);
  addInfoRow('Duracion', `${durationDays} day${durationDays > 1 ? 's' : ''}`);
  y += 5;

  // Reason section
  page.drawText('Motivo:', { x: 15, y: (pageHeight - y) - 12 * 0.3, size: 12, font: helvBold });
  y += 10;

  const reasonText = reqRow.reason || 'No reason provided';
  const wrapWidth = pageWidth - 30; // like splitTextToSize(pageWidth - 30)
  const wrapText = (text: string, maxWidth: number, font: any, size: number) => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const w of words) {
      const test = current ? current + ' ' + w : w;
      const testWidth = font.widthOfTextAtSize(test, size);
      if (testWidth <= maxWidth) {
        current = test;
      } else {
        if (current) lines.push(current);
        current = w;
      }
    }
    if (current) lines.push(current);
    return lines;
  };
  const reasonLines = wrapText(reasonText, wrapWidth, helv, 12);
  for (const line of reasonLines) {
    page.drawText(line, { x: 15, y: (pageHeight - y) - 12 * 0.3, size: 12, font: helv, color: rgb(0, 0, 0) });
    y += 7;
  }
  y += 10;

  // Status row
  addInfoRow('Estado', (reqRow.status || '').toUpperCase());
  // Status dot (colored) at (70, y-5)
  const statusColors: Record<string, [number, number, number]> = {
    pending: [255, 193, 7],
    approved: [40, 167, 69],
    rejected: [220, 53, 69],
  };
  const [sr, sg, sb] = statusColors[reqRow.status] || [108, 117, 125];
  page.drawCircle({ x: 70, y: (pageHeight - (y - 5)), size: 3, color: rgb(sr / 255, sg / 255, sb / 255) });
  y += 5;

  // Approval/rejection details
  if ((reqRow.status === 'approved' || reqRow.status === 'rejected') && reqRow.approved_at) {
    if (reqRow.status === 'approved') {
      addInfoRow('Aprobado por', approverName);
      addInfoRow('Fecha de aprobacion', formatDate(new Date(reqRow.approved_at), 'PPP'));
    } else {
      addInfoRow('Rechazado por', approverName);
      addInfoRow('Fecha de rechazo', formatDate(new Date(reqRow.approved_at), 'PPP'));
      if (reqRow.rejection_reason) {
        y += 5;
        page.drawText('Motivo del Rechazo', { x: 15, y: (pageHeight - y) - 12 * 0.3, size: 12, font: helvBold });
        y += 10;
        const rejLines = wrapText(reqRow.rejection_reason, wrapWidth, helv, 12);
        for (const line of rejLines) {
          page.drawText(line, { x: 15, y: (pageHeight - y) - 12 * 0.3, size: 12, font: helv });
          y += 7;
        }
      }
    }
  }

  // Footer bar and content
  const footerY = 0; // bottom bar of height 30
  page.drawRectangle({ x: 0, y: footerY, width: pageWidth, height: 30, color: accentColor });

  // Footer logo centered
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const logoCandidates: string[] = [];
  if (logos.sectorProLogoUrl) logoCandidates.push(logos.sectorProLogoUrl);
  if (SUPABASE_URL) {
    logoCandidates.push(
      `${SUPABASE_URL}/storage/v1/object/public/public%20logos/sectorpro.png`,
      `${SUPABASE_URL}/storage/v1/object/public/company-assets/sector-pro-logo.png`,
    );
  }
  for (const url of logoCandidates) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const imgBytes = new Uint8Array(await resp.arrayBuffer());
      const isPng = imgBytes.length > 8 && imgBytes[0] === 0x89 && imgBytes[1] === 0x50 && imgBytes[2] === 0x4E && imgBytes[3] === 0x47;
      const img = isPng ? await doc.embedPng(imgBytes) : await doc.embedJpg(imgBytes);
      const footerLogoHeight = 10;
      const footerLogoWidth = footerLogoHeight * (img.width / img.height);
      const logoX = (pageWidth - footerLogoWidth) / 2;
      page.drawImage(img, { x: logoX, y: footerY + 5, width: footerLogoWidth, height: footerLogoHeight });
      break;
    } catch (_) { /* try next */ }
  }

  // Footer text (white)
  const footerTextColor = rgb(1, 1, 1);
  const nowText = formatDate(new Date(), 'PPP p');
  const nowWidth = helv.widthOfTextAtSize(nowText, 10);
  page.drawText(nowText, { x: pageWidth - 15 - nowWidth, y: footerY + 10 - 10 * 0.3, size: 10, font: helv, color: footerTextColor });
  const pageNumText = 'Page 1 of 1';
  const pageNumWidth = helv.widthOfTextAtSize(pageNumText, 10);
  page.drawText(pageNumText, { x: (pageWidth - pageNumWidth) / 2, y: footerY + 20 - 10 * 0.3, size: 10, font: helv, color: footerTextColor });

  const bytes = await doc.save();

  // Match client filename pattern: vacation_request_<cleanTechName>_<MMM_dd_yyyy>.pdf
  const cleanName = (techName || 'Not Available')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s/g, '_');
  const requestDate = reqRow.created_at ? formatDate(new Date(reqRow.created_at), 'MMM_dd_yyyy') : formatDate(new Date(), 'MMM_dd_yyyy');
  const filename = `vacation_request_${cleanName}_${requestDate}.pdf`;

  return { bytes: new Uint8Array(bytes), filename };
}

function buildEmailHtml(reqRow: VacationRequestRow, baseUrl: string, logos: { companyLogo: string; atLogo: string }) {
  const techName = `${reqRow.tech?.first_name || ""} ${reqRow.tech?.last_name || ""}`.trim() || reqRow.tech?.email || "Técnico";
  const dept = reqRow.tech?.department || "";
  const start = new Date(reqRow.start_date);
  const end = new Date(reqRow.end_date);
  const msPerDay = 1000 * 60 * 60 * 24;
  const duration = Math.floor((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / msPerDay) + 1;
  const approverName = `${reqRow.approver?.first_name || ""} ${reqRow.approver?.last_name || ""}`.trim();
  const approvedAt = reqRow.approved_at ? new Date(reqRow.approved_at).toLocaleDateString() : "";

  const statusText = reqRow.status === 'approved'
    ? 'Tu solicitud de vacaciones ha sido aprobada por tu jefe de departamento.'
    : (reqRow.status === 'rejected'
      ? 'Tu solicitud de vacaciones ha sido rechazada por tu jefe de departamento.'
      : `Estado de tu solicitud de vacaciones: ${reqRow.status}`);

  const availabilityUrl = `${baseUrl}/dashboard/unavailability`;

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Actualización de solicitud de vacaciones</title>
    </head>
    <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;padding:24px;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.06);">
              <tr>
                <td style="padding:16px 20px;background:#0b0b0b;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="left" style="vertical-align:middle;">
                        <img src="${logos.companyLogo}" alt="Sector Pro" height="36" style="display:block;border:0;max-height:36px" />
                      </td>
                      <td align="right" style="vertical-align:middle;">
                        <img src="${logos.atLogo}" alt="Área Técnica" height="36" style="display:block;border:0;max-height:36px" />
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 24px 8px 24px;">
                  <h2 style="margin:0 0 8px 0;font-size:20px;color:#111827;">Hola ${techName}${dept ? ` (${dept})` : ''},</h2>
                  <p style="margin:0;color:#374151;line-height:1.55;">${statusText}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 24px 0 24px;">
                  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;color:#374151;font-size:14px;">
                    <b>Detalles de la solicitud</b>
                    <ul style="margin:10px 0 0 18px;padding:0;line-height:1.55;">
                      <li><b>Periodo:</b> ${start.toLocaleDateString()} - ${end.toLocaleDateString()} (${duration} día${duration === 1 ? '' : 's'})</li>
                      <li><b>Motivo:</b> ${reqRow.reason || '(no indicado)'}</li>
                      <li><b>Estado:</b> ${reqRow.status.toUpperCase()}</li>
                      ${reqRow.status === 'approved' ? `<li><b>Aprobado por:</b> ${approverName || 'Gestión'} el ${approvedAt}</li>` : ''}
                      ${reqRow.status === 'rejected' ? `<li><b>Rechazado por:</b> ${approverName || 'Gestión'} el ${approvedAt}</li>` : ''}
                      ${reqRow.status === 'rejected' && reqRow.rejection_reason ? `<li><b>Motivo del rechazo:</b> ${reqRow.rejection_reason}</li>` : ''}
                    </ul>
                  </div>
                  <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
                    <a href="${availabilityUrl}" style="display:inline-block;background:#3b82f6;color:#ffffff;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:600;">Ver mi disponibilidad</a>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 24px;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.5;border-top:1px solid #e5e7eb;">
                  <div style="margin-bottom:8px;">
                    Este correo es confidencial y puede contener información privilegiada. Si no eres el destinatario, por favor notifícanos y elimina este mensaje.
                  </div>
                  <div>
                    Sector Pro · <a href="https://www.sector-pro.com" style="color:#6b7280;text-decoration:underline;">www.sector-pro.com</a>
                    &nbsp;|&nbsp; Área Técnica · <a href="https://area-tecnica.lovable.app" style="color:#6b7280;text-decoration:underline;">area-tecnica.lovable.app</a>
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const BREVO_KEY = Deno.env.get("BREVO_API_KEY")!;
    const BREVO_FROM = Deno.env.get("BREVO_FROM")!;
    const COMPANY_LOGO_URL = Deno.env.get("COMPANY_LOGO_URL_W") || `${SUPABASE_URL}/storage/v1/object/public/company-assets/sectorlogow.png`;
    const AT_LOGO_URL = Deno.env.get("AT_LOGO_URL") || `${SUPABASE_URL}/storage/v1/object/public/company-assets/area-tecnica-logo.png`;

    if (!BREVO_KEY || !BREVO_FROM) {
      return new Response(JSON.stringify({ error: "Missing Brevo configuration" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Auth: only admin/management may send notifications
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    const token = authHeader.replace("Bearer ", "").trim();
    const { data: userResult } = await supabase.auth.getUser(token);
    const requester = userResult?.user;
    if (!requester) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    const { data: requesterProfile, error: profileErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", requester.id)
      .maybeSingle();
    if (profileErr || !requesterProfile || !["admin", "management"].includes((requesterProfile as any).role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const body: VacationDecisionRequestBody = await req.json();
    const ids: UUID[] = Array.from(new Set(
      (Array.isArray(body.request_ids) ? body.request_ids : [])
        .concat(body.request_id ? [body.request_id] : [])
        .filter(Boolean)
    ));

    if (!ids.length) {
      return new Response(JSON.stringify({ error: "Missing request_id(s)" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const envBaseRaw = pickEnvBase();
    const envBase = toOrigin(envBaseRaw);
    const rawOrigin = req.headers.get('origin') || req.headers.get('referer');
    const originBase = rawOrigin ? toOrigin(rawOrigin.split('?')[0]) : undefined;
    const baseUrl = envBase || originBase || 'http://localhost:3000';

    const PUBLIC_LOGOS_BASE = `${SUPABASE_URL}/storage/v1/object/public/public%20logos`;

    // Fetch all rows
    const { data: rows, error: fetchErr } = await supabase
      .from("vacation_requests")
      .select(`
        id, technician_id, start_date, end_date, reason, status, created_at, updated_at, approved_by, approved_at, rejection_reason,
        tech:profiles!technician_id(id,email,first_name,last_name,department),
        approver:profiles!approved_by(id,email,first_name,last_name)
      `)
      .in("id", ids);

    if (fetchErr) {
      return new Response(JSON.stringify({ error: "Failed to load vacation requests", details: fetchErr }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const results: any[] = [];

    for (const reqRow of rows as VacationRequestRow[]) {
      try {
        // Generate PDF attachment
        const { bytes, filename } = await generateVacationPDF(reqRow, { sectorProLogoUrl: `${PUBLIC_LOGOS_BASE}/sectorpro.png` });
        const pdfB64 = u8ToBase64(bytes);

        // Build HTML content
        const htmlContent = buildEmailHtml(reqRow, baseUrl, { companyLogo: COMPANY_LOGO_URL, atLogo: AT_LOGO_URL });

        // Recipients: requester (To) + administracion (BCC). If requester has no email, send To administracion.
        const toList: { email: string; name?: string }[] = [];
        const bccList: { email: string; name?: string }[] = [];
        const requesterEmail = (reqRow.tech?.email || "").trim();
        if (requesterEmail) {
          toList.push({ email: requesterEmail, name: `${reqRow.tech?.first_name ?? ''} ${reqRow.tech?.last_name ?? ''}`.trim() });
          bccList.push({ email: "administracion@sector-pro.com", name: "Administración" });
        } else {
          toList.push({ email: "administracion@sector-pro.com", name: "Administración" });
        }

        const subject = reqRow.status === 'approved'
          ? 'Solicitud de vacaciones APROBADA'
          : (reqRow.status === 'rejected' ? 'Solicitud de vacaciones RECHAZADA' : 'Actualización solicitud de vacaciones');

        const payload: any = {
          sender: { email: BREVO_FROM, name: 'Sistema de Gestión' },
          to: toList,
          subject,
          htmlContent,
          attachments: [
            {
              content: pdfB64,
              name: filename,
            }
          ]
        };

        if (bccList.length) {
          payload.bcc = bccList;
        }

        const sendRes = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": BREVO_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!sendRes.ok) {
          const msg = await sendRes.text();
          throw new Error(`Brevo error: ${sendRes.status} ${sendRes.statusText} ${msg}`);
        }

        results.push({ id: reqRow.id, sent: true });
      } catch (e: any) {
        console.error('[send-vacation-decision] Failed for id', reqRow.id, e);
        results.push({ id: reqRow.id, sent: false, error: e?.message || String(e) });
      }
    }

    const allOk = results.every(r => r.sent);
    return new Response(JSON.stringify({ success: allOk, results }), {
      status: allOk ? 200 : 207,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    console.error('[send-vacation-decision] Error:', err);
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
