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

export function buildTourdateUpdatedText(actor: string, changes: BroadcastBody['changes']): string {
  if (changes && typeof changes === 'object') {
    const keys = Object.keys(changes as Record<string, unknown>);
    const labels = keys.slice(0, 4).map(fmtFieldEs);
    return `${actor} actualizó una fecha de tour. Cambios: ${labels.join(', ')}.`;
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

  if (type === 'tourdate.type.changed.show') {
    return {
      title: 'Fecha cambiada a Concierto',
      text: tourName
        ? `${actor} cambió "${locationName}" a Concierto en "${tourName}".`
        : `${actor} cambió "${locationName}" a Concierto.`,
    };
  }
  if (type === 'tourdate.type.changed.rehearsal') {
    return {
      title: 'Fecha cambiada a Ensayo',
      text: tourName
        ? `${actor} cambió "${locationName}" a Ensayo en "${tourName}".`
        : `${actor} cambió "${locationName}" a Ensayo.`,
    };
  }
  if (type === 'tourdate.type.changed.travel') {
    return {
      title: 'Fecha cambiada a Viaje',
      text: tourName
        ? `${actor} cambió "${locationName}" a Viaje en "${tourName}".`
        : `${actor} cambió "${locationName}" a Viaje.`,
    };
  }
  if (type === 'tourdate.type.changed.setup') {
    return {
      title: 'Fecha cambiada a Montaje',
      text: tourName
        ? `${actor} cambió "${locationName}" a Montaje en "${tourName}".`
        : `${actor} cambió "${locationName}" a Montaje.`,
    };
  }
  if (type === 'tourdate.type.changed.rigging') {
    return {
      title: 'Fecha cambiada a Rigging',
      text: tourName
        ? `${actor} cambió "${locationName}" a Rigging en "${tourName}".`
        : `${actor} cambió "${locationName}" a Rigging.`,
    };
  }
  if (type === 'tourdate.type.changed.off') {
    return {
      title: 'Fecha cambiada a Día libre',
      text: tourName
        ? `${actor} cambió "${locationName}" a Día libre en "${tourName}".`
        : `${actor} cambió "${locationName}" a Día libre.`,
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
