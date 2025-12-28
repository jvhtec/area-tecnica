import type { BroadcastBody } from "./types.ts";

export function fmtFieldEs(field: string): string {
  switch (field) {
    case 'title': return 'Título';
    case 'description': return 'Descripción';
    case 'status': return 'Estado';
    case 'due_at': return 'Fecha límite';
    case 'priority': return 'Prioridad';
    case 'requirements': return 'Requerimientos';
    case 'notes': return 'Notas';
    case 'details': return 'Detalles';
    case 'progress': return 'Progreso';
    case 'start_time': return 'Inicio';
    case 'end_time': return 'Fin';
    case 'start_date': return 'Inicio';
    case 'end_date': return 'Fin';
    case 'timezone': return 'Zona horaria';
    case 'job_type': return 'Tipo';
    case 'location_id': return 'Ubicación';
    case 'tour_date_type': return 'Tipo de fecha';
    case 'color': return 'Color';
    case 'event_date': return 'Fecha';
    case 'event_time': return 'Hora';
    case 'event_type': return 'Tipo de evento';
    case 'transport_type': return 'Transporte';
    case 'loading_bay': return 'Muelle';
    case 'departments': return 'Departamentos';
    case 'license_plate': return 'Matrícula';
    default: return field;
  }
}

export function channelEs(ch?: string): string {
  if (!ch) return '';
  return ch === 'whatsapp' ? 'WhatsApp' : 'correo';
}

function normalizeTaskChangeValue(field: string, value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (field === 'due_at' || field.endsWith('_at') || field.endsWith('_date')) {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeTaskChangeValue('', item));
  }

  if (typeof value === 'object') {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return value;
    }
  }

  return value;
}

function formatTaskChangeValue(field: string, value: unknown): string {
  if (value === undefined) return 'sin definir';
  if (value === null) return 'sin definir';

  if (field === 'due_at' || field.endsWith('_date')) {
    const parsed = new Date(String(value));
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(parsed);
    }
  }

  if (typeof value === 'boolean') {
    return value ? 'Sí' : 'No';
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatTaskChangeValue('', item)).join(', ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

export function summarizeTaskChanges(changes: BroadcastBody['changes']): string {
  if (!changes || typeof changes !== 'object') {
    return '';
  }

  const entries: Array<{ field: string; from?: unknown; to?: unknown; hasFrom: boolean; hasTo: boolean }> = [];
  for (const [field, raw] of Object.entries(changes as Record<string, any>)) {
    if (field === 'updated_at' || field === 'updatedAt') continue;
    if (raw && typeof raw === 'object' && ('from' in raw || 'to' in raw)) {
      const from = (raw as any).from;
      const to = (raw as any).to;
      entries.push({
        field,
        from: normalizeTaskChangeValue(field, from),
        to: normalizeTaskChangeValue(field, to),
        hasFrom: Object.prototype.hasOwnProperty.call(raw, 'from'),
        hasTo: Object.prototype.hasOwnProperty.call(raw, 'to'),
      });
    } else {
      entries.push({
        field,
        from: undefined,
        to: normalizeTaskChangeValue(field, raw),
        hasFrom: false,
        hasTo: true,
      });
    }
  }

  const parts = entries
    .map(({ field, from, to, hasFrom, hasTo }) => {
      const label = fmtFieldEs(field) || field;
      const fromText = formatTaskChangeValue(field, from);
      const toText = formatTaskChangeValue(field, to);

      if (hasFrom && hasTo) {
        if (fromText === toText) return '';
        return `${label}: ${fromText} → ${toText}`;
      }

      if (hasTo) {
        return `${label}: ${toText}`;
      }

      if (hasFrom) {
        return `${label}: ${fromText}`;
      }

      return '';
    })
    .filter((part) => part);

  return parts.join('; ');
}

