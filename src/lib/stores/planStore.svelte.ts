import { getDb } from "$lib/api/db";
import type { AmbossDay, CalendarDay } from "$lib/utils/planEngine";

let ambossDays = $state<AmbossDay[]>([]);
let calendarDays = $state<CalendarDay[]>([]);
let todayIndex = $state(-1);
let planGenerated = $state(false);

export function getAmbossDays(): AmbossDay[] {
  return ambossDays;
}

export function getCalendarDays(): CalendarDay[] {
  return calendarDays;
}

export function getTodayIndex(): number {
  return todayIndex;
}

export function isPlanGenerated(): boolean {
  return planGenerated;
}

export function getTodayCalendarDay(): CalendarDay | null {
  if (todayIndex >= 0 && todayIndex < calendarDays.length) {
    return calendarDays[todayIndex];
  }
  return null;
}

export function getTodayAmbossDay(): AmbossDay | null {
  const today = getTodayCalendarDay();
  return today?.ambossDay ?? null;
}

export async function loadAmbossDays(): Promise<void> {
  try {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM amboss_days ORDER BY sort_order"
    );
    ambossDays = rows.map((row) => ({
      day_number: row.day_number as number,
      subject: row.subject as string,
      sub_topic: (row.sub_topic as string) ?? "",
      chapters: JSON.parse((row.chapters as string) ?? "[]"),
      estimated_hours: (row.estimated_hours as number) ?? 7,
      question_count: (row.question_count as number) ?? 80,
      is_optional: Boolean(row.is_optional),
    }));
  } catch (error) {
    console.error("Failed to load AMBOSS days:", error);
  }
}

export async function importAmbossPlan(
  days: AmbossDay[]
): Promise<void> {
  try {
    const db = await getDb();
    // Clear existing
    await db.execute("DELETE FROM amboss_days");

    // Insert all days
    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      await db.execute(
        `INSERT INTO amboss_days (day_number, subject, sub_topic, chapters, estimated_hours, question_count, is_optional, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          day.day_number,
          day.subject,
          day.sub_topic,
          JSON.stringify(day.chapters),
          day.estimated_hours,
          day.question_count,
          day.is_optional ? 1 : 0,
          i + 1,
        ]
      );
    }

    ambossDays = days;
  } catch (error) {
    console.error("Failed to import AMBOSS plan:", error);
  }
}

export function setCalendarDays(days: CalendarDay[]): void {
  calendarDays = days;
  planGenerated = true;

  // Find today's index
  const todayStr = new Date().toISOString().split("T")[0];
  todayIndex = days.findIndex((d) => d.date === todayStr);
}

export function getCurrentDayNumber(): number {
  const today = getTodayCalendarDay();
  if (!today?.ambossDay) return 0;
  return today.ambossDay.day_number;
}

export function getTotalStudyDays(): number {
  return ambossDays.filter((d) => !d.is_optional).length;
}

export function getProgressPercent(): number {
  const total = getTotalStudyDays();
  if (total === 0) return 0;
  const current = getCurrentDayNumber();
  return Math.round((current / total) * 100);
}
