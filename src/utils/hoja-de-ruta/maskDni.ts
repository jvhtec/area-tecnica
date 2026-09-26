// Masks a DNI/NIE value for display, revealing only the last 4 characters.
// Used anywhere a full document number would otherwise be shown by default
// (staff rows, autocomplete results) to keep personal data off-screen unless
// a user explicitly reveals it.
export function maskDni(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.length <= 4) return "•".repeat(trimmed.length);
  return "•".repeat(trimmed.length - 4) + trimmed.slice(-4);
}
