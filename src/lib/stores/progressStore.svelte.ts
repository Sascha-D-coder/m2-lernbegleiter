import { getDb } from "$lib/api/db";

interface DayProgress {
  date: string;
  ambossDayId: number | null;
  readingCompleted: boolean;
  kreuzenCompleted: boolean;
  kreuzenCorrect: number;
  kreuzenTotal: number;
}

let progressMap = $state<Map<string, DayProgress>>(new Map());
let loaded = $state(false);

export function getProgressMap(): Map<string, DayProgress> {
  return progressMap;
}

export function isProgressLoaded(): boolean {
  return loaded;
}

export function isDayCompleted(date: string): boolean {
  const p = progressMap.get(date);
  if (!p) return false;
  return p.readingCompleted && p.kreuzenCompleted;
}

export function isDayPartial(date: string): boolean {
  const p = progressMap.get(date);
  if (!p) return false;
  return (p.readingCompleted || p.kreuzenCompleted) && !(p.readingCompleted && p.kreuzenCompleted);
}

export function getDayProgress(date: string): DayProgress | undefined {
  return progressMap.get(date);
}

export async function loadAllProgress(): Promise<void> {
  try {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM daily_progress"
    );
    const map = new Map<string, DayProgress>();
    for (const row of rows) {
      const date = row.date as string;
      map.set(date, {
        date,
        ambossDayId: (row.amboss_day_id as number) ?? null,
        readingCompleted: Boolean(row.reading_completed),
        kreuzenCompleted: Boolean(row.kreuzen_completed),
        kreuzenCorrect: (row.kreuzen_correct as number) ?? 0,
        kreuzenTotal: (row.kreuzen_total as number) ?? 0,
      });
    }
    progressMap = map;
    loaded = true;
  } catch (error) {
    console.error("Failed to load progress:", error);
  }
}

export function updateProgressLocal(date: string, reading: boolean, kreuzen: boolean): void {
  const existing = progressMap.get(date);
  const updated = new Map(progressMap);
  updated.set(date, {
    date,
    ambossDayId: existing?.ambossDayId ?? null,
    readingCompleted: reading,
    kreuzenCompleted: kreuzen,
    kreuzenCorrect: existing?.kreuzenCorrect ?? 0,
    kreuzenTotal: existing?.kreuzenTotal ?? 0,
  });
  progressMap = updated;
}
