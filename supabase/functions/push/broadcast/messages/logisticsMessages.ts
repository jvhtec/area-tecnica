import type { BroadcastBody } from "../../types.ts";
import { fmtFieldEs } from "../../format.ts";
import { formatSpanishDateTime } from "../date.ts";
import { transportTypeLabel } from "../../transportRequestEmailFormat.ts";

export function buildLogisticsTransportRequestedMessage(
  actor: string,
  jobTitle: string | null,
  body: BroadcastBody,
): { title: string; text: string } {
  const department = body.department;
  const description = body.description as string | undefined;
  const departmentLabel = department ? department.charAt(0).toUpperCase() + department.slice(1) : undefined;
  const context = jobTitle ? ` en "${jobTitle}"` : '';

  if (departmentLabel && description) {
    return { title: 'Transporte solicitado', text: `${actor} solicitó transporte para ${departmentLabel}${context}: ${description}` };
  }
  if (departmentLabel) {
    return { title: 'Transporte solicitado', text: `${actor} solicitó transporte para ${departmentLabel}${context}.` };
  }
  if (description) {
    return { title: 'Transporte solicitado', text: `${actor} solicitó transporte${context}: ${description}` };
  }
  return { title: 'Transporte solicitado', text: `${actor} solicitó transporte${context}.` };
}

export function buildLogisticsEventMessage(
  type: string,
  jobTitle: string | null,
  body: BroadcastBody,
): { title: string; text: string } {
  const eventType = body.event_type;
  const eventDate = body.event_date;
  const eventTime = body.event_time;
  const transportType = body.transport_type;
  const eventTitle = jobTitle || body.title || 'Evento logístico';
  const autoCreated = Boolean(body.auto_created_unload);
  const pairedType = body.paired_event_type;
  const pairedDate = body.paired_event_date;
  const pairedTime = body.paired_event_time;
  const departmentsList = Array.isArray(body.departments) ? body.departments : [];
  const rawChanges = body.changes;
  const changeFields = Array.isArray(rawChanges)
    ? rawChanges as string[]
    : (rawChanges && typeof rawChanges === 'object'
      ? Object.keys(rawChanges as Record<string, unknown>)
      : []);

  const isCrewTransfer = eventType === 'crew_transfer';
  const eventLabel = isCrewTransfer ? 'Traslado de personal' : eventType === 'unload' ? 'Descarga' : 'Carga';
  const pairedLabel = pairedType === 'unload'
    ? 'descarga'
    : pairedType === 'load'
      ? 'carga'
      : pairedType === 'crew_transfer' ? 'la vuelta' : undefined;
  // "el traslado … programado" vs "la carga … programada".
  const the = isCrewTransfer ? 'el' : 'la';
  const done = (verb: string) => `${verb}${isCrewTransfer ? 'o' : 'a'}`;
  const whenLabel = formatSpanishDateTime(eventDate, eventTime);
  // Known types get their Spanish label ("Autobús cama", "Camión 9m"); anything else keeps the capitalised raw value.
  const transportLabel = transportType
    ? transportTypeLabel(transportType) ?? transportType.charAt(0).toUpperCase() + transportType.slice(1)
    : undefined;
  const deptText = departmentsList.length ? ` (${departmentsList.join(', ')})` : '';

  let title = '';
  let text = '';

  if (type === 'logistics.event.cancelled') {
    title = `${eventLabel} ${done('cancelad')}`;
    text = `Se canceló ${the} ${eventLabel.toLowerCase()} de "${eventTitle}"${whenLabel ? ` (${whenLabel})` : ''}.`;
  } else if (type === 'logistics.event.updated') {
    title = `${eventLabel} ${done('actualizad')}`;
    text = `Se actualizó ${the} ${eventLabel.toLowerCase()} de "${eventTitle}"${whenLabel ? ` (${whenLabel})` : ''}.`;
    if (changeFields.length) {
      const changeLabels = changeFields.map(fmtFieldEs);
      text += ` Cambios: ${changeLabels.join(', ')}.`;
    }
  } else {
    title = `${eventLabel} ${done('programad')}`;
    if (autoCreated) {
      text = `Se creó automáticamente una ${eventLabel.toLowerCase()} para "${eventTitle}"${whenLabel ? ` (${whenLabel})` : ''}.`;
    } else {
      text = `${eventLabel} para "${eventTitle}" ${done('programad')}${whenLabel ? ` (${whenLabel})` : ''}.`;
    }
  }

  if (transportLabel) {
    text += ` Transporte: ${transportLabel}.`;
  }

  if (type === 'logistics.event.created' && pairedLabel) {
    const pairedWhen = pairedDate || pairedTime ? `${pairedDate ?? ''} ${pairedTime ?? ''}`.trim() : '';
    text += autoCreated
      ? ` Vinculada a la ${pairedLabel} existente${pairedWhen ? ` (${pairedWhen})` : ''}.`
      : ` También se programó ${pairedLabel}${pairedWhen ? ` (${pairedWhen})` : ''}.`;
  }

  if (deptText) {
    text += deptText;
  }

  return { title, text };
}
