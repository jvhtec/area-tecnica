const LINE_CHECK_LEAD_MINUTES = 30;

const minutesToTime = (totalMinutes: number): string => {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

// Line checks typically happen right before showtime, so default the window
// to the 30 minutes leading up to the show start.
export const computeLineCheckDefaults = (showStart?: string): { start: string; end: string } => {
  if (!showStart) return { start: "", end: "" };

  const [hoursStr, minutesStr] = showStart.split(":");
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return { start: "", end: "" };

  const showStartMinutes = hours * 60 + minutes;
  return {
    start: minutesToTime(showStartMinutes - LINE_CHECK_LEAD_MINUTES),
    end: showStart,
  };
};
