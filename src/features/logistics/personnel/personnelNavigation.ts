export function openPersonnelService(eventId?: string, date?: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("area", "personnel"); url.searchParams.set("tab", "personnel");
  if (eventId) url.searchParams.set("personnelEvent", eventId); else url.searchParams.delete("personnelEvent");
  if (date) url.searchParams.set("personnelDate", date); else url.searchParams.delete("personnelDate");
  url.searchParams.set("personnelOpen", eventId ? "existing" : "new");
  window.location.assign(url.toString());
}
