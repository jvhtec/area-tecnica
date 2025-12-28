export function calculateHours(startTime: string, endTime: string, breakMinutes: number, endsNextDay?: boolean) {
  if (!startTime || !endTime) return 0;

  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);
  let diffMs = end.getTime() - start.getTime();
  if (endsNextDay || diffMs < 0) {
    diffMs += 24 * 60 * 60 * 1000; // add one day for overnight
  }
  const diffHours = diffMs / (1000 * 60 * 60);
  const workingHours = diffHours - breakMinutes / 60;

  return Math.max(0, workingHours);
}

