import type { BroadcastBody } from "../../types.ts";
import { fmtFieldEs } from "../../format.ts";

const TOUR_DATE_TYPE_LABELS: Record<string, string> = {
  show: 'Concierto',
  rehearsal: 'Ensayo',
  travel: 'Viaje',
  setup: 'Montaje',
  rigging: 'Rigging',
  off: 'Día libre',
};

const TOUR_DATE_TYPE_EVENT_LABELS: Record<string, string> = {
  'tourdate.type.changed.show': 'Concierto',
  'tourdate.type.changed.rehearsal': 'Ensayo',
  'tourdate.type.changed.travel': 'Viaje',
  'tourdate.type.changed.setup': 'Montaje',
  'tourdate.type.changed.rigging': 'Rigging',
  'tourdate.type.changed.off': 'Día libre',
};

export function buildTourdateUpdatedText(actor: string, changes: BroadcastBody['changes']): string {
  if (changes && typeof changes === 'object') {
    const keys = Object.keys(changes as Record<string, unknown>);
    const labels = keys.slice(0, 4).map(fmtFieldEs);
    if (labels.length > 0) {
      return `${actor} actualizó una fecha de tour. Cambios: ${labels.join(', ')}.`;
    }
  }

  return `${actor} actualizó una fecha de tour.`;
}

export function buildTourDateTypeChangedMessage(
  type: string,
  actor: string,
  body: BroadcastBody,
): { title: string; text: string } {
  const locationName = body.location_name || 'fecha de tour';
  const oldType = body.old_type || '';
  const newType = body.new_type || '';
  const tourName = body.tour_name || '';
  const oldTypeLabel = TOUR_DATE_TYPE_LABELS[oldType] || oldType;
  const newTypeLabel = TOUR_DATE_TYPE_LABELS[newType] || newType;
  const eventLabel = TOUR_DATE_TYPE_EVENT_LABELS[type];

  if (eventLabel) {
    return {
      title: `Fecha cambiada a ${eventLabel}`,
      text: tourName
        ? `${actor} cambió "${locationName}" a ${eventLabel} en "${tourName}".`
        : `${actor} cambió "${locationName}" a ${eventLabel}.`,
    };
  }

  return {
    title: 'Tipo de fecha cambiado',
    text: oldType && newType
      ? tourName
        ? `${actor} cambió "${locationName}" de ${oldTypeLabel} a ${newTypeLabel} en "${tourName}".`
        : `${actor} cambió "${locationName}" de ${oldTypeLabel} a ${newTypeLabel}.`
      : tourName
        ? `${actor} cambió el tipo de "${locationName}" en "${tourName}".`
        : `${actor} cambió el tipo de "${locationName}".`,
  };
}
