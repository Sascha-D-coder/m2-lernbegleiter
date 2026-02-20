import { getDb } from "$lib/api/db";
import type { AmbossDay, CalendarDay, Phase } from "$lib/utils/planEngine";

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

export async function loadCalendarDays(): Promise<void> {
  try {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      `SELECT c.*, a.day_number, a.subject, a.sub_topic, a.chapters,
              a.estimated_hours, a.question_count, a.is_optional
       FROM calendar_days c
       LEFT JOIN amboss_days a ON c.amboss_day_id = a.day_number
       ORDER BY c.date`
    );

    if (rows.length === 0) return;

    calendarDays = rows.map((row) => ({
      date: row.date as string,
      dayOfWeek: new Date(row.date as string).getUTCDay(),
      phase: (row.phase as Phase) ?? "buffer",
      ambossDay: row.day_number
        ? {
            day_number: row.day_number as number,
            subject: row.subject as string,
            sub_topic: (row.sub_topic as string) ?? "",
            chapters: JSON.parse((row.chapters as string) ?? "[]"),
            estimated_hours: (row.estimated_hours as number) ?? 7,
            question_count: (row.question_count as number) ?? 80,
            is_optional: Boolean(row.is_optional),
          }
        : null,
      splitFraction: (row.split_fraction as number) ?? 1.0,
      splitPart: (row.split_part as CalendarDay["splitPart"]) ?? null,
      ankiTarget: (row.anki_target as number) ?? 0,
      retainTestScheduled: Boolean(row.retain_test_scheduled),
      isKreuzenOnly: Boolean(row.is_kreuzen_only),
    }));

    planGenerated = true;
    updateTodayIndex();
  } catch (error) {
    console.error("Failed to load calendar days:", error);
  }
}

export async function importAmbossPlan(
  days: AmbossDay[]
): Promise<void> {
  try {
    const db = await getDb();
    await db.execute("DELETE FROM amboss_days");

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

export async function setCalendarDays(days: CalendarDay[]): Promise<void> {
  calendarDays = days;
  planGenerated = true;
  updateTodayIndex();

  // Persist to DB
  try {
    const db = await getDb();
    await db.execute("DELETE FROM calendar_days");

    for (const day of days) {
      await db.execute(
        `INSERT INTO calendar_days (date, phase, amboss_day_id, split_fraction, split_part, anki_target, retain_test_scheduled, is_kreuzen_only)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          day.date,
          day.phase,
          day.ambossDay?.day_number ?? null,
          day.splitFraction,
          day.splitPart,
          day.ankiTarget,
          day.retainTestScheduled ? 1 : 0,
          day.isKreuzenOnly ? 1 : 0,
        ]
      );
    }
  } catch (error) {
    console.error("Failed to save calendar days:", error);
  }
}

function updateTodayIndex(): void {
  const todayStr = new Date().toISOString().split("T")[0];
  todayIndex = calendarDays.findIndex((d) => d.date === todayStr);
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
  // Count how many AMBOSS days are assigned to past calendar days
  const todayStr = new Date().toISOString().split("T")[0];
  const completedDayNumbers = new Set<number>();
  for (const cal of calendarDays) {
    if (cal.date <= todayStr && cal.ambossDay && !cal.ambossDay.is_optional) {
      completedDayNumbers.add(cal.ambossDay.day_number);
    }
  }
  return Math.round((completedDayNumbers.size / total) * 100);
}
