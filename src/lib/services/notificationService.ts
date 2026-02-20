// ============================================================================
// notificationService.ts - Native Notification Service for M2 Lernbegleiter
//
// Sends scheduled native notifications via @tauri-apps/plugin-notification.
// Uses a 60-second interval to check the current time against configured
// notification times and study state, avoiding duplicates with a daily
// sent-tracking set.
// ============================================================================

import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { getSettings } from "$lib/stores/settingsStore.svelte";
import {
  getCalendarDays,
  getProgressPercent,
  getTodayCalendarDay,
  getTotalStudyDays,
} from "$lib/stores/planStore.svelte";
import { getCardsDueCount_ } from "$lib/stores/ankiStore.svelte";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MorningReminderData {
  dayNumber: number;
  subject: string;
  questionCount: number;
  ankiDue: number;
}

interface EveningSummaryData {
  questions: number;
  percent: number;
  ankiCards: number;
  streak: number;
}

// ---------------------------------------------------------------------------
// Internal State
// ---------------------------------------------------------------------------

let intervalId: ReturnType<typeof setInterval> | null = null;
let permissionGranted = false;

/** Tracks which notification keys have already been sent today (YYYY-MM-DD:key). */
const sentToday = new Set<string>();

/** The date string (YYYY-MM-DD) for which sentToday is valid. Resets on new day. */
let sentDate = "";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the current date as YYYY-MM-DD. */
function todayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

/** Returns the current time as HH:MM (24h, zero-padded). */
function currentTimeHHMM(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Mark a notification key as sent for today.
 * Returns true if it was already sent (i.e. duplicate), false otherwise.
 */
function markSent(key: string): boolean {
  const today = todayDateString();

  // Reset tracking on a new day
  if (sentDate !== today) {
    sentToday.clear();
    sentDate = today;
  }

  const fullKey = `${today}:${key}`;
  if (sentToday.has(fullKey)) {
    return true; // already sent
  }
  sentToday.add(fullKey);
  return false;
}

/** Send a native notification if permissions are granted. */
async function notify(title: string, body: string): Promise<void> {
  if (!permissionGranted) return;
  try {
    sendNotification({ title, body });
  } catch (error) {
    console.error("[NotificationService] Failed to send notification:", error);
  }
}

/**
 * Count how many study days behind schedule the student is.
 * Compares the expected number of study days up to today vs. actual.
 */
function getDaysBehind(): number {
  const calendarDays = getCalendarDays();
  const todayStr = todayDateString();

  let expectedStudyDays = 0;
  let actualStudyDays = 0;

  for (const day of calendarDays) {
    if (day.date > todayStr) break;
    if (day.ambossDay !== null) {
      expectedStudyDays++;
      // A day is "completed" if it is in the past (we treat past days as done
      // for now; a more sophisticated version would check a completion flag)
      if (day.date < todayStr) {
        actualStudyDays++;
      }
    }
  }

  return Math.max(0, expectedStudyDays - actualStudyDays);
}

/**
 * Count consecutive study days (streak) ending today.
 * A study day counts if there is an ambossDay assigned for that date.
 */
function getStreak(): number {
  const calendarDays = getCalendarDays();
  const todayStr = todayDateString();
  const todayIdx = calendarDays.findIndex((d) => d.date === todayStr);
  if (todayIdx < 0) return 0;

  let streak = 0;
  for (let i = todayIdx; i >= 0; i--) {
    if (calendarDays[i].ambossDay !== null) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Count how many distinct study days have been covered so far.
 * Used for retain-test suggestion cadence.
 */
function getCompletedStudyDayCount(): number {
  const calendarDays = getCalendarDays();
  const todayStr = todayDateString();
  let count = 0;
  for (const day of calendarDays) {
    if (day.date > todayStr) break;
    if (day.ambossDay !== null) {
      count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Individual Notification Senders
// ---------------------------------------------------------------------------

async function sendMorningReminder(data: MorningReminderData): Promise<void> {
  if (markSent("morning")) return;
  await notify(
    "Guten Morgen! Zeit zum Lernen",
    `Tag ${data.dayNumber} \u2013 ${data.subject}. ${data.questionCount} Fragen + ${data.ankiDue} Anki-Karten warten.`
  );
}

async function sendEveningSummary(data: EveningSummaryData): Promise<void> {
  if (markSent("evening")) return;
  await notify(
    "Tagesabschluss",
    `Heute: ${data.questions} Fragen (${data.percent}%), ${data.ankiCards} Anki-Karten. Streak: ${data.streak} Tage!`
  );
}

async function sendAnkiAlert(count: number): Promise<void> {
  if (markSent("anki-alert")) return;
  await notify(
    "Anki-Karten warten",
    `${count} Anki-Karten f\u00e4llig. Jetzt durchgehen?`
  );
}

async function sendRetainTestReminder(): Promise<void> {
  if (markSent("retain-test")) return;
  await notify(
    "Retain-Test f\u00e4llig",
    "5 Themen gelernt. Zeit f\u00fcr einen Retain-Test!"
  );
}

async function sendMilestone(percent: number): Promise<void> {
  const key = `milestone-${percent}`;
  if (markSent(key)) return;

  const calendarDays = getCalendarDays();
  const total = getTotalStudyDays();
  const completed = Math.round((percent / 100) * total);

  let title = "Meilenstein erreicht!";
  if (percent === 50) {
    title = "Halbzeit!";
  } else if (percent >= 75) {
    title = "Fast geschafft!";
  }

  await notify(title, `${completed}/${total} Lerntage geschafft!`);
}

async function sendBehindSchedule(daysBehind: number): Promise<void> {
  if (markSent("behind-schedule")) return;
  await notify(
    "Lernplan-Erinnerung",
    `${daysBehind} Tage hinter Plan. Wochenende nutzen?`
  );
}

// ---------------------------------------------------------------------------
// Main Checker
// ---------------------------------------------------------------------------

/**
 * Called every 60 seconds. Checks current time and study state to decide
 * which notifications should fire.
 */
async function checkAndSendNotifications(): Promise<void> {
  const settings = getSettings();

  // Bail out if notifications are disabled
  if (!settings.notificationEnabled) return;
  if (!permissionGranted) return;

  const now = currentTimeHHMM();
  const todayDay = getTodayCalendarDay();
  const ankiDue = getCardsDueCount_();
  const progress = getProgressPercent();

  // --- Morning Reminder ---
  if (now === settings.notificationMorningTime && todayDay?.ambossDay) {
    await sendMorningReminder({
      dayNumber: todayDay.ambossDay.day_number,
      subject: todayDay.ambossDay.subject,
      questionCount: todayDay.ambossDay.question_count,
      ankiDue,
    });
  }

  // --- Evening Summary ---
  if (now === settings.notificationEveningTime && todayDay) {
    const questionCount = todayDay.ambossDay?.question_count ?? 0;
    await sendEveningSummary({
      questions: questionCount,
      percent: progress,
      ankiCards: ankiDue,
      streak: getStreak(),
    });
  }

  // --- Anki Alert (when >50 cards due) ---
  if (ankiDue > 50) {
    await sendAnkiAlert(ankiDue);
  }

  // --- Retain-Test Suggestion (every 5 completed study days) ---
  const completedStudyDays = getCompletedStudyDayCount();
  if (completedStudyDays > 0 && completedStudyDays % 5 === 0) {
    await sendRetainTestReminder();
  }

  // --- Milestone Notifications (25%, 50%, 75%) ---
  for (const threshold of [25, 50, 75]) {
    if (progress >= threshold) {
      await sendMilestone(threshold);
    }
  }

  // --- Behind Schedule (2+ days) ---
  const daysBehind = getDaysBehind();
  if (daysBehind >= 2) {
    await sendBehindSchedule(daysBehind);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Convenience wrapper: initialize the notification service. */
export async function initNotifications(): Promise<void> {
  return NotificationService.init();
}

/** Convenience wrapper: stop the notification service. */
export function stopNotifications(): void {
  NotificationService.stop();
}

export const NotificationService = {
  /**
   * Initialize the notification service: request permission and start
   * the 60-second interval checker.
   */
  async init(): Promise<void> {
    try {
      permissionGranted = await isPermissionGranted();

      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === "granted";
      }

      if (!permissionGranted) {
        console.warn(
          "[NotificationService] Notification permission not granted."
        );
        return;
      }

      // Reset daily tracking
      sentToday.clear();
      sentDate = todayDateString();

      // Start the interval (check every 60 seconds)
      NotificationService.stop(); // clear any existing interval
      intervalId = setInterval(checkAndSendNotifications, 60_000);

      // Run an initial check immediately
      await checkAndSendNotifications();

      console.log("[NotificationService] Initialized successfully.");
    } catch (error) {
      console.error("[NotificationService] Failed to initialize:", error);
    }
  },

  /**
   * Stop the notification service and clear the interval.
   */
  stop(): void {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  },

  // Expose individual senders for manual/programmatic use
  sendMorningReminder,
  sendEveningSummary,
  sendAnkiAlert,
  sendRetainTestReminder,
  sendMilestone,
  sendBehindSchedule,
  checkAndSendNotifications,
};
