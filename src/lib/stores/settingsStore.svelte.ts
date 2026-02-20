import { getDb } from "$lib/api/db";

export interface Settings {
  planStartDate: string;
  examDate: string;
  semesterEndDate: string;
  juneVacationStart: string;
  juneVacationEnd: string;
  septVacationStart: string;
  septVacationEnd: string;
  semesterHoursPerDay: number;
  fulltimeHoursPerDay: number;
  weekendsOff: boolean;
  pharmaPrioritized: boolean;
  ankiDeckNames: string[];
  llmProvider: string;
  llmApiKey: string;
  llmModel: string;
  notificationEnabled: boolean;
  notificationMorningTime: string;
  notificationEveningTime: string;
  theme: string;
  widgetMode: string;
}

const defaultSettings: Settings = {
  planStartDate: "2026-04-06",
  examDate: "2026-10-06",
  semesterEndDate: "2026-07-20",
  juneVacationStart: "2026-06-01",
  juneVacationEnd: "2026-06-14",
  septVacationStart: "2026-09-07",
  septVacationEnd: "2026-09-13",
  semesterHoursPerDay: 2.5,
  fulltimeHoursPerDay: 7,
  weekendsOff: true,
  pharmaPrioritized: true,
  ankiDeckNames: [],
  llmProvider: "claude",
  llmApiKey: "",
  llmModel: "claude-sonnet-4-5-20250929",
  notificationEnabled: true,
  notificationMorningTime: "08:00",
  notificationEveningTime: "20:00",
  theme: "light",
  widgetMode: "normal",
};

let settings = $state<Settings>({ ...defaultSettings });
let loaded = $state(false);

export function getSettings(): Settings {
  return settings;
}

export function isLoaded(): boolean {
  return loaded;
}

export async function loadSettings(): Promise<void> {
  try {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM settings WHERE id = 1"
    );
    if (rows.length > 0) {
      const row = rows[0];
      settings = {
        planStartDate: (row.plan_start_date as string) ?? defaultSettings.planStartDate,
        examDate: (row.exam_date as string) ?? defaultSettings.examDate,
        semesterEndDate:
          (row.semester_end_date as string) ?? defaultSettings.semesterEndDate,
        juneVacationStart:
          (row.june_vacation_start as string) ??
          defaultSettings.juneVacationStart,
        juneVacationEnd:
          (row.june_vacation_end as string) ?? defaultSettings.juneVacationEnd,
        septVacationStart:
          (row.sept_vacation_start as string) ??
          defaultSettings.septVacationStart,
        septVacationEnd:
          (row.sept_vacation_end as string) ?? defaultSettings.septVacationEnd,
        semesterHoursPerDay:
          (row.semester_hours_per_day as number) ??
          defaultSettings.semesterHoursPerDay,
        fulltimeHoursPerDay:
          (row.fulltime_hours_per_day as number) ??
          defaultSettings.fulltimeHoursPerDay,
        weekendsOff: Boolean(row.weekends_off ?? defaultSettings.weekendsOff),
        pharmaPrioritized: Boolean(
          row.pharma_prioritized ?? defaultSettings.pharmaPrioritized
        ),
        ankiDeckNames: JSON.parse(
          (row.anki_deck_names as string) ?? "[]"
        ),
        llmProvider:
          (row.llm_provider as string) ?? defaultSettings.llmProvider,
        llmApiKey: (row.llm_api_key as string) ?? defaultSettings.llmApiKey,
        llmModel: (row.llm_model as string) ?? defaultSettings.llmModel,
        notificationEnabled: Boolean(
          row.notification_enabled ?? defaultSettings.notificationEnabled
        ),
        notificationMorningTime:
          (row.notification_morning_time as string) ??
          defaultSettings.notificationMorningTime,
        notificationEveningTime:
          (row.notification_evening_time as string) ??
          defaultSettings.notificationEveningTime,
        theme: (row.theme as string) ?? defaultSettings.theme,
        widgetMode:
          (row.widget_mode as string) ?? defaultSettings.widgetMode,
      };
    }
    loaded = true;
  } catch (error) {
    console.error("Failed to load settings:", error);
    settings = { ...defaultSettings };
    loaded = true;
  }
}

export async function saveSettings(
  newSettings: Partial<Settings>
): Promise<void> {
  settings = { ...settings, ...newSettings };

  try {
    const db = await getDb();
    await db.execute(
      `UPDATE settings SET
        plan_start_date = ?,
        exam_date = ?,
        semester_end_date = ?,
        june_vacation_start = ?,
        june_vacation_end = ?,
        sept_vacation_start = ?,
        sept_vacation_end = ?,
        semester_hours_per_day = ?,
        fulltime_hours_per_day = ?,
        weekends_off = ?,
        pharma_prioritized = ?,
        anki_deck_names = ?,
        llm_provider = ?,
        llm_api_key = ?,
        llm_model = ?,
        notification_enabled = ?,
        notification_morning_time = ?,
        notification_evening_time = ?,
        theme = ?,
        widget_mode = ?,
        updated_at = datetime('now')
      WHERE id = 1`,
      [
        settings.planStartDate,
        settings.examDate,
        settings.semesterEndDate,
        settings.juneVacationStart,
        settings.juneVacationEnd,
        settings.septVacationStart,
        settings.septVacationEnd,
        settings.semesterHoursPerDay,
        settings.fulltimeHoursPerDay,
        settings.weekendsOff ? 1 : 0,
        settings.pharmaPrioritized ? 1 : 0,
        JSON.stringify(settings.ankiDeckNames),
        settings.llmProvider,
        settings.llmApiKey,
        settings.llmModel,
        settings.notificationEnabled ? 1 : 0,
        settings.notificationMorningTime,
        settings.notificationEveningTime,
        settings.theme,
        settings.widgetMode,
      ]
    );
  } catch (error) {
    console.error("Failed to save settings:", error);
  }
}
