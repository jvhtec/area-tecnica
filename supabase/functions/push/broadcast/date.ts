export function normalizeDateKey(rawDate?: string): string | null {
  if (!rawDate) return null;
  const parsedTargetDate = new Date(rawDate);
  return !Number.isNaN(parsedTargetDate.getTime())
    ? parsedTargetDate.toISOString().split('T')[0]
    : null;
}

export function formatSpanishMediumDate(dateKey: string | null): string | null {
  if (!dateKey) return null;
  try {
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(`${dateKey}T00:00:00Z`));
  } catch (_) {
    return dateKey;
  }
}

export function formatSpanishDateTime(
  date?: string,
  time?: string,
): string {
  if (!date && !time) return '';

  const isoDate = date && time
    ? `${date}T${time}`
    : date
      ? `${date}T00:00:00`
      : undefined;

  if (!isoDate) {
    return `${date ?? ''} ${time ?? ''}`.trim();
  }

  try {
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeStyle: time ? 'short' : undefined,
    }).format(new Date(isoDate));
  } catch (_) {
    return `${date ?? ''} ${time ?? ''}`.trim();
  }
}
