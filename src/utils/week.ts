/**
 * Returns the ISO week number (1–53) for a given date.
 */
export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

export function getISOWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  return d.getUTCFullYear();
}

export function weekFromDateStr(dateStr: string): { week_number: number; year: number } {
  const date = new Date(dateStr + 'T12:00:00');
  return { week_number: getISOWeek(date), year: getISOWeekYear(date) };
}

/**
 * Returns the YYYY-MM-DD of the Friday that starts the pay week for a given date.
 * Pay week = Friday to Thursday.
 */
export function fridayOf(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const day = date.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  const daysBack = (day - 5 + 7) % 7;
  date.setDate(date.getDate() - daysBack);
  return date.toISOString().split('T')[0];
}

/**
 * Returns a human-readable label for a Friday-start week.
 * e.g. "Mar 13 – Mar 19, 2026"
 */
export function weekLabel(fridayStr: string): string {
  const start = new Date(fridayStr + 'T12:00:00');
  const end   = new Date(fridayStr + 'T12:00:00');
  end.setDate(end.getDate() + 6); // Thursday
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
}

/**
 * Returns today as a YYYY-MM-DD string.
 */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}
