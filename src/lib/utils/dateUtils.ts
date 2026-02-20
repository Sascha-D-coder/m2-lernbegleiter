const DAY_NAMES = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];

const DAY_NAMES_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const MONTH_NAMES = [
  "Januar",
  "Februar",
  "M\u00e4rz",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

const MONTH_NAMES_SHORT = [
  "Jan.",
  "Feb.",
  "M\u00e4r.",
  "Apr.",
  "Mai",
  "Jun.",
  "Jul.",
  "Aug.",
  "Sep.",
  "Okt.",
  "Nov.",
  "Dez.",
];

/**
 * Format a date in short German style with abbreviated day and month.
 * Example: "Mo, 15. Apr. 2026"
 */
export function formatDateGerman(date: Date): string {
  const dayShort = DAY_NAMES_SHORT[date.getDay()];
  const day = date.getDate();
  const monthShort = MONTH_NAMES_SHORT[date.getMonth()];
  const year = date.getFullYear();
  return `${dayShort}, ${day}. ${monthShort} ${year}`;
}

/**
 * Format a date in long German style.
 * Example: "Montag, 15. April 2026"
 */
export function formatDateLong(date: Date): string {
  const dayName = DAY_NAMES[date.getDay()];
  const day = date.getDate();
  const monthName = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  return `${dayName}, ${day}. ${monthName} ${year}`;
}

/**
 * Format a date in numeric German style.
 * Example: "15.04.2026"
 */
export function formatDateShort(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Get the full German day name.
 * Example: "Montag", "Dienstag", etc.
 */
export function getDayName(date: Date): string {
  return DAY_NAMES[date.getDay()];
}

/**
 * Get the full German month name.
 * Example: "Januar", "Februar", etc.
 */
export function getMonthName(date: Date): string {
  return MONTH_NAMES[date.getMonth()];
}

/**
 * Calculate days until a target date from today.
 * Returns 0 if the target date is today, positive for future dates,
 * negative for past dates.
 * @param targetDate ISO date string (e.g. "2026-04-15")
 */
export function daysUntil(targetDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculate days from now. Negative if date is in the past,
 * positive if in the future, 0 if today.
 * @param date ISO date string (e.g. "2026-04-15")
 */
export function daysFromNow(date: string): number {
  return daysUntil(date);
}

/**
 * Check if an ISO date string represents today's date.
 * @param date ISO date string (e.g. "2026-04-15")
 */
export function isToday(date: string): boolean {
  const d = new Date(date);
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

/**
 * Check if two Date objects represent the same calendar day.
 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Get the ISO 8601 week number for a given date.
 * Weeks start on Monday. Week 1 is the week containing the first Thursday of the year.
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  // Set to nearest Thursday: current date + 4 - current day number (Monday=1, Sunday=7)
  const dayNum = d.getUTCDay() || 7; // Convert Sunday from 0 to 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24) + 1) / 7
  );
  return weekNo;
}
