import { escapeHtml, wrapInCorporateTemplate } from "../_shared/corporateEmailTemplate.ts";

export interface TransportEmailRequest {
  id: string;
  job_id: string;
  created_by: string | null;
  created_at: string;
  status: string;
  planning_status: string;
  department: string;
  description: string | null;
  note: string | null;
  needed_at: string | null;
  origin: string | null;
  destination: string | null;
  movement_type: string;
  priority: string;
  source_type: string;
  transport_type: string | null;
}

export interface TransportEmailJob {
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  timezone: string | null;
}

export interface TransportEmailProfile {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export interface TransportEmailItem {
  transport_type: string;
  leftover_space_meters: number | string | null;
}

const DEPARTMENTS: Record<string, string> = {
  sound: "Sonido", lights: "Iluminación", video: "Vídeo", production: "Producción",
  administrative: "Administración", logistics: "Logística",
};
const MOVEMENTS: Record<string, string> = {
  transfer: "Traslado", pickup: "Recogida", delivery: "Entrega",
  return: "Devolución", other: "Otro",
};
const PRIORITIES: Record<string, string> = {
  low: "Baja", normal: "Normal", high: "Alta", urgent: "Urgente",
};
const SOURCES: Record<string, string> = {
  manual: "Manual", subrental: "Subalquiler", tour: "Gira",
  truck_planner: "Planificador de camiones",
};
// Mirrors getLogisticsTransportTypeLabel in src/components/technician/details-modal/formatters.ts.
const VEHICLES: Record<string, string> = {
  trailer: "Tráiler", "9m": "Camión 9m", "8m": "Camión 8m", "6m": "Camión 6m",
  "4m": "Camión 4m", furgoneta: "Furgoneta", rv: "Autocaravana", sleeper_bus: "Autobús cama",
};

/** Spanish label for a known transport type, or null so callers keep their own fallback. */
export function transportTypeLabel(type: string | null | undefined): string | null {
  return type ? VEHICLES[type] ?? null : null;
}
// High-priority requests are flagged in the header instead of only in the detail table.
const PRIORITY_COLORS: Record<string, string> = { urgent: "#b91c1c", high: "#b45309" };

const UNSET = "No especificada";

const text = (value: string | null | undefined) => value?.trim() || "";
const label = (labels: Record<string, string>, value: string | null) =>
  value ? (labels[value] || value) : "";
const htmlValue = (value: string) => escapeHtml(value).replace(/\r?\n/g, "<br />");

function resolveTimezone(timezone: string | null): string {
  const candidate = text(timezone) || "Europe/Madrid";
  try {
    new Intl.DateTimeFormat("es-ES", { timeZone: candidate });
    return candidate;
  } catch {
    return "Europe/Madrid";
  }
}

/** Spanish decimal separator; numeric(8,2) may arrive as a string over PostgREST. */
function metersText(value: number | string | null): string | null {
  const meters = typeof value === "string" ? Number(value) : value;
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return null;
  return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(meters)} m`;
}

function dateText(value: string | null, timezone: string, withWeekday = true): string {
  if (!value) return UNSET;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return UNSET;
  return new Intl.DateTimeFormat("es-ES", {
    ...(withWeekday ? { weekday: "short" } : {}),
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: timezone,
  }).format(date);
}

function jobDatesText(job: TransportEmailJob, timezone: string): string {
  const start = dateText(job.start_time, timezone);
  const end = dateText(job.end_time, timezone);
  if (start === UNSET) return end === UNSET ? "" : end;
  return end === UNSET ? start : `${start} — ${end}`;
}

function detailRows(rows: Array<[string, string]>): string {
  return rows.filter(([, value]) => value).map(([key, value]) => `
        <tr>
          <td style="padding:7px 16px 7px 0;vertical-align:top;color:#6b7280;font-size:14px;white-space:nowrap;">${key}</td>
          <td style="padding:7px 0;vertical-align:top;font-size:14px;color:#111827;">${htmlValue(value)}</td>
        </tr>`).join("");
}

function textBlock(heading: string, value: string): string {
  if (!value) return "";
  return `
    <h3 style="margin:24px 0 6px;font-size:14px;color:#6b7280;font-weight:bold;">${heading}</h3>
    <div style="font-size:14px;line-height:1.5;color:#111827;">${htmlValue(value)}</div>`;
}

export function formatTransportRequestEmail(
  request: TransportEmailRequest,
  job: TransportEmailJob,
  requester: TransportEmailProfile,
  items: TransportEmailItem[],
): { subject: string; htmlContent: string; textContent: string } {
  const timezone = resolveTimezone(job.timezone);
  const jobTitle = text(job.title) || "Trabajo sin título";
  const requesterName = text([requester.first_name, requester.last_name].filter(Boolean).join(" "));
  const requesterEmail = text(requester.email);
  const department = label(DEPARTMENTS, request.department);
  const priority = label(PRIORITIES, request.priority);
  const movement = label(MOVEMENTS, request.movement_type);
  const source = label(SOURCES, request.source_type);
  const origin = text(request.origin);
  const destination = text(request.destination);
  const neededAt = dateText(request.needed_at, timezone);
  const description = text(request.description);
  const note = text(request.note);
  const route = origin && destination
    ? `${origin} → ${destination}`
    : origin ? `Desde ${origin}` : destination ? `Hasta ${destination}` : "";
  const requesterLine = requesterName && requesterEmail
    ? `${requesterName} · ${requesterEmail}`
    : requesterName || requesterEmail;

  const subject = `${priority === "Urgente" ? "[URGENTE] " : ""}Solicitud de transporte · ${jobTitle}`
    .replace(/[\r\n]/g, " ");

  const priorityColor = PRIORITY_COLORS[request.priority];
  const rows: Array<[string, string]> = [
    ["Fecha necesaria", neededAt],
    ["Movimiento", movement],
    // Flagged priorities already carry a badge in the header; do not repeat the row.
    ["Prioridad", priorityColor ? "" : priority],
    ["Ruta", route],
    ["Departamento", department],
    ["Solicitante", requesterLine],
    ["Fechas del trabajo", jobDatesText(job, timezone)],
    ["Procedencia", source],
  ];

  const vehicles = (items.length
    ? items
    : request.transport_type
    ? [{ transport_type: request.transport_type, leftover_space_meters: null }]
    : []
  ).map((item) => {
    const leftover = metersText(item.leftover_space_meters);
    const name = label(VEHICLES, item.transport_type) || item.transport_type;
    return leftover ? `${name} · Espacio sobrante: ${leftover}` : name;
  });

  const bodyHtml = `
    <h2 style="margin:0 0 4px;font-size:20px;color:#111827;">Nueva solicitud de transporte</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;">${htmlValue(jobTitle)}${department ? ` · ${htmlValue(department)}` : ""}</p>
    ${priorityColor
      ? `<p style="margin:0 0 20px;"><span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${priorityColor};color:#ffffff;font-size:12px;font-weight:bold;">Prioridad ${htmlValue(priority)}</span></p>`
      : ""}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border-top:1px solid #e5e7eb;">
      ${detailRows(rows)}
    </table>
    <h3 style="margin:24px 0 6px;font-size:14px;color:#6b7280;font-weight:bold;">Vehículos solicitados</h3>
    ${vehicles.length
      ? `<ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.6;color:#111827;">${vehicles.map((vehicle) => `<li>${htmlValue(vehicle)}</li>`).join("")}</ul>`
      : `<p style="margin:0;font-size:14px;color:#6b7280;">No se han especificado vehículos.</p>`}
    ${textBlock("Descripción", description)}
    ${textBlock("Notas", note)}
    <p style="margin:28px 0 0;"><a href="https://sector-pro.work/logistics" style="display:inline-block;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:bold;">Abrir Logística</a></p>
    <p style="margin:24px 0 0;padding-top:12px;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.6;color:#9ca3af;">
      Horas en ${htmlValue(timezone)}. Solicitud creada el ${htmlValue(dateText(request.created_at, timezone, false))}.<br />
      Referencia ${htmlValue(request.id)}
    </p>
  `;

  // The plain-text part has no badge, so the flagged priority goes back into its rows.
  const plainRows = rows
    .map(([key, value]) => (key === "Prioridad" && priorityColor ? [key, priority] as [string, string] : [key, value] as [string, string]))
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`);
  const textContent = [
    "Nueva solicitud de transporte",
    department ? `${jobTitle} · ${department}` : jobTitle,
    "",
    ...plainRows,
    "",
    "Vehículos solicitados:",
    ...(vehicles.length ? vehicles.map((vehicle) => `- ${vehicle}`) : ["- No se han especificado vehículos."]),
    ...(description ? ["", `Descripción: ${description}`] : []),
    ...(note ? ["", `Notas: ${note}`] : []),
    "",
    "Abrir Logística: https://sector-pro.work/logistics",
    `Horas en ${timezone}. Referencia ${request.id}`,
  ].join("\n");

  return { subject, htmlContent: wrapInCorporateTemplate({ subject, bodyHtml }), textContent };
}
