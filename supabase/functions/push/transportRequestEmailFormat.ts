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
  leftover_space_meters: number | null;
}

const labels: Record<string, string> = {
  sound: "Sonido", lights: "Iluminación", video: "Vídeo", production: "Producción",
  administrative: "Administración", logistics: "Logística", transfer: "Traslado",
  pickup: "Recogida", delivery: "Entrega", return: "Devolución", other: "Otro",
  low: "Baja", normal: "Normal", high: "Alta", urgent: "Urgente", manual: "Manual",
  subrental: "Subalquiler", tour: "Gira", truck_planner: "Planificador de camiones",
  trailer: "Tráiler", furgoneta: "Furgoneta", "9m": "Camión 9 m", "8m": "Camión 8 m",
  "6m": "Camión 6 m", "4m": "Camión 4 m",
};
const display = (value: string | null | undefined) => value?.trim() || "No especificado";
const label = (value: string | null) => value ? (labels[value] || value) : "No especificado";
const htmlValue = (value: string) => escapeHtml(value).replace(/\r?\n/g, "<br />");

function dateText(value: string | null, timezone: string): string {
  if (!value) return "No especificada";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "No especificada";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium", timeStyle: "short", timeZone: timezone,
  }).format(date);
}

export function formatTransportRequestEmail(
  request: TransportEmailRequest,
  job: TransportEmailJob,
  requester: TransportEmailProfile,
  items: TransportEmailItem[],
): { subject: string; htmlContent: string } {
  let timezone = job.timezone || "Europe/Madrid";
  try { new Intl.DateTimeFormat("es-ES", { timeZone: timezone }); }
  catch { timezone = "Europe/Madrid"; }
  const requesterName = [requester.first_name, requester.last_name].filter(Boolean).join(" ").trim();
  const subject = `Solicitud de transporte · ${display(job.title)}`.replace(/[\r\n]/g, " ");
  const details: Array<[string, string]> = [
    ["Trabajo", display(job.title)],
    ["Inicio del trabajo", dateText(job.start_time, timezone)],
    ["Fin del trabajo", dateText(job.end_time, timezone)],
    ["Solicitante", display(requesterName)],
    ["Email del solicitante", display(requester.email)],
    ["Departamento", label(request.department)],
    ["Solicitud creada", dateText(request.created_at, timezone)],
    ["Fecha necesaria", dateText(request.needed_at, timezone)],
    ["Zona horaria", timezone],
    ["Movimiento", label(request.movement_type)],
    ["Prioridad", label(request.priority)],
    ["Procedencia", label(request.source_type)],
    ["Origen", display(request.origin)],
    ["Destino", display(request.destination)],
    ["Descripción", display(request.description)],
    ["Notas", display(request.note)],
    ["Referencia", request.id],
  ];
  const vehicleItems = items.length ? items : request.transport_type
    ? [{ transport_type: request.transport_type, leftover_space_meters: null }] : [];
  const bodyHtml = `
    <h2 style="margin:0 0 16px;font-size:20px;">Nueva solicitud de transporte</h2>
    <p>Se ha registrado una solicitud de transporte para el equipo de Logística.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      ${details.map(([key, value]) => `<tr><td style="padding:6px 8px 6px 0;vertical-align:top;font-weight:bold;">${key}</td><td style="padding:6px 0;">${htmlValue(value)}</td></tr>`).join("")}
    </table>
    <h3 style="margin:20px 0 8px;">Vehículos solicitados</h3>
    ${vehicleItems.length ? `<ul>${vehicleItems.map((item) => `<li>${htmlValue(label(item.transport_type))} · Espacio libre: ${item.leftover_space_meters === null ? "No especificado" : `${htmlValue(String(item.leftover_space_meters))} m`}</li>`).join("")}</ul>` : "<p>No se han especificado vehículos.</p>"}
    <p style="margin-top:24px;"><a href="https://sector-pro.work/logistics" style="display:inline-block;padding:12px 18px;background:#111827;color:#fff;text-decoration:none;border-radius:6px;">Abrir Logística</a></p>
  `;
  return { subject, htmlContent: wrapInCorporateTemplate({ subject, bodyHtml }) };
}
