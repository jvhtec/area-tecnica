import type { BroadcastBody } from "../../types.ts";
import { formatSpanishMediumDate } from "../date.ts";

export function buildFestivalPublicFormMessage(
  body: BroadcastBody,
  jobTitle: string,
): { title: string; text: string } {
  const artistName = body.artist_name?.trim() || 'Un artista';
  const artistDate = body.artist_date?.trim() || '';
  const jobLabel = jobTitle ? ` para "${jobTitle}"` : '';
  const formattedDate = artistDate ? formatSpanishMediumDate(artistDate) : null;

  return {
    title: 'Formulario técnico recibido',
    text: formattedDate
      ? `${artistName} envió su formulario técnico${jobLabel} (${formattedDate}).`
      : `${artistName} envió su formulario técnico${jobLabel}.`,
  };
}

export function buildFestivalPublicRiderMessage(
  body: BroadcastBody,
  jobTitle: string,
): { title: string; text: string } {
  const artistName = body.artist_name?.trim() || 'Un artista';
  const artistDate = body.artist_date?.trim() || '';
  const riderFileName = (body.file_name || '').trim();
  const jobLabel = jobTitle ? ` para "${jobTitle}"` : '';
  const formattedDate = artistDate ? formatSpanishMediumDate(artistDate) : null;

  const riderText = riderFileName
    ? `${artistName} cargó un rider técnico${jobLabel}: "${riderFileName}".`
    : `${artistName} cargó un rider técnico${jobLabel}.`;

  return {
    title: 'Rider técnico cargado',
    text: formattedDate ? `${riderText} (${formattedDate})` : riderText,
  };
}
