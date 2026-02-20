// ============================================================================
// planEngine.ts - Study Plan Stretching Engine for M2 Lernbegleiter
//
// Takes 88 AMBOSS study days and distributes them across ~180 calendar days
// (April - October 2026), respecting semester constraints, vacations,
// weekends, and pharmacology prioritization.
// ============================================================================

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface PlanConfig {
  startDate: string;           // ISO date, default "2026-04-06"
  examDate: string;            // ISO date, default "2026-10-14"
  semesterEndDate: string;     // ISO date, default "2026-07-20"
  juneVacation: { start: string; end: string };
  septVacation: { start: string; end: string };
  weekendsOff: boolean;
  semesterHoursPerDay: number; // 2-3
  fulltimeHoursPerDay: number; // 6-8
  pharmaPrioritized: boolean;
}

export interface AmbossDay {
  day_number: number;
  subject: string;
  sub_topic: string;
  chapters: string[];
  estimated_hours: number;
  question_count: number;
  is_optional: boolean;
}

export type Phase =
  | 'semester'
  | 'vacation-june'
  | 'semester-late'
  | 'vollzeit'
  | 'vacation-sept'
  | 'vollzeit-late'
  | 'weekend'
  | 'buffer'
  | 'exam-prep';

export interface CalendarDay {
  date: string;               // ISO date (YYYY-MM-DD)
  dayOfWeek: number;          // 0=Sunday, 6=Saturday
  phase: Phase;
  ambossDay: AmbossDay | null;
  splitFraction: number;      // 1.0 = full day, 0.5 = half
  splitPart: 'reading' | 'kreuzen' | 'both' | null;
  ankiTarget: number;
  retainTestScheduled: boolean;
  isKreuzenOnly: boolean;
}

// ---------------------------------------------------------------------------
// Date Helpers (pure, no external dependencies)
// ---------------------------------------------------------------------------

/** Parse an ISO date string (YYYY-MM-DD) into a Date at midnight UTC. */
export function parseDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Format a Date back to ISO YYYY-MM-DD (based on UTC components). */
export function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Check if a date falls on Saturday (6) or Sunday (0). */
export function isWeekend(date: Date): boolean {
  const dow = date.getUTCDay();
  return dow === 0 || dow === 6;
}

/** Return a new Date that is `days` calendar days after the given date. */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Check if a date falls within [start, end] (inclusive, ISO strings). */
export function isInRange(date: Date, start: string, end: string): boolean {
  const s = parseDate(start);
  const e = parseDate(end);
  return date.getTime() >= s.getTime() && date.getTime() <= e.getTime();
}

/** Number of calendar days from config.startDate to config.examDate (inclusive). */
export function getDaysUntilExam(config: PlanConfig): number {
  const start = parseDate(config.startDate);
  const exam = parseDate(config.examDate);
  return Math.round((exam.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

// ---------------------------------------------------------------------------
// Phase Classification
// ---------------------------------------------------------------------------

/** Number of calendar days reserved for Probeklausuren-only period (AMBOSS mock exams). */
const EXAM_PREP_DAYS = 14;

/**
 * Determine the study phase for a given date based on the plan configuration.
 *
 * Priority order:
 *   1. Weekend check (if weekendsOff)
 *   2. September vacation (complete rest)
 *   3. June vacation (Anki only)
 *   4. Exam prep window (last 14 days before exam -- Probeklausuren only)
 *   5. Vollzeit-late (after September vacation, before exam prep)
 *   6. Vollzeit (after semester end, before September vacation)
 *   7. Semester-late (after June vacation, before semester end)
 *   8. Semester (before June vacation)
 */
export function getPhaseForDate(date: Date, config: PlanConfig): Phase {
  // Weekend check first -- weekends are their own phase regardless of period
  if (config.weekendsOff && isWeekend(date)) {
    return 'weekend';
  }

  const examDate = parseDate(config.examDate);
  const examPrepStart = addDays(examDate, -EXAM_PREP_DAYS + 1); // inclusive

  // September vacation: complete rest
  if (isInRange(date, config.septVacation.start, config.septVacation.end)) {
    return 'vacation-sept';
  }

  // June vacation: Anki review only
  if (isInRange(date, config.juneVacation.start, config.juneVacation.end)) {
    return 'vacation-june';
  }

  // Exam prep window
  if (date.getTime() >= examPrepStart.getTime() && date.getTime() <= examDate.getTime()) {
    return 'exam-prep';
  }

  const semesterEnd = parseDate(config.semesterEndDate);
  const juneVacEnd = parseDate(config.juneVacation.end);
  const septVacStart = parseDate(config.septVacation.start);

  // After September vacation but before exam prep
  if (date.getTime() > parseDate(config.septVacation.end).getTime() && date.getTime() < examPrepStart.getTime()) {
    return 'vollzeit-late';
  }

  // After semester end, before or up to September vacation start
  if (date.getTime() > semesterEnd.getTime() && date.getTime() < septVacStart.getTime()) {
    return 'vollzeit';
  }

  // After June vacation end, up to semester end
  if (date.getTime() > juneVacEnd.getTime() && date.getTime() <= semesterEnd.getTime()) {
    return 'semester-late';
  }

  // Before (or during early) semester -- default semester phase
  const startDate = parseDate(config.startDate);
  if (date.getTime() >= startDate.getTime()) {
    return 'semester';
  }

  return 'buffer';
}

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

export function getDefaultConfig(): PlanConfig {
  return {
    startDate: '2026-04-06',
    examDate: '2026-10-14',
    semesterEndDate: '2026-07-20',
    juneVacation: { start: '2026-06-01', end: '2026-06-14' },
    septVacation: { start: '2026-09-07', end: '2026-09-13' },
    weekendsOff: true,
    semesterHoursPerDay: 2.5,
    fulltimeHoursPerDay: 7,
    pharmaPrioritized: true,
  };
}

// ---------------------------------------------------------------------------
// Calendar Generation
// ---------------------------------------------------------------------------

/**
 * Generate every calendar day from startDate to examDate (inclusive),
 * each annotated with its phase but not yet assigned any AMBOSS content.
 */
export function generateCalendar(config: PlanConfig): CalendarDay[] {
  const start = parseDate(config.startDate);
  const end = parseDate(config.examDate);
  const calendar: CalendarDay[] = [];

  let current = new Date(start.getTime());
  while (current.getTime() <= end.getTime()) {
    const phase = getPhaseForDate(current, config);
    const dayOfWeek = current.getUTCDay();

    // Base Anki target varies by phase
    let ankiTarget = 0;
    switch (phase) {
      case 'semester':
      case 'semester-late':
        ankiTarget = 100;
        break;
      case 'vacation-june':
        ankiTarget = 150; // vacation = Anki focus
        break;
      case 'vollzeit':
      case 'vollzeit-late':
        ankiTarget = 200;
        break;
      case 'exam-prep':
        ankiTarget = 100; // light Anki OK, focus is on AMBOSS Probeklausuren
        break;
      case 'weekend':
        ankiTarget = 50; // light weekend Anki
        break;
      case 'vacation-sept':
        ankiTarget = 0; // complete rest
        break;
      default:
        ankiTarget = 0;
    }

    calendar.push({
      date: formatDate(current),
      dayOfWeek,
      phase,
      ambossDay: null,
      splitFraction: 1.0,
      splitPart: null,
      ankiTarget,
      retainTestScheduled: false,
      isKreuzenOnly: false,
    });

    current = addDays(current, 1);
  }

  return calendar;
}

// ---------------------------------------------------------------------------
// AMBOSS Day Reordering
// ---------------------------------------------------------------------------

/** Pharmacology-related keywords used to identify pharma days. */
const PHARMA_KEYWORDS = [
  'pharmakologie',
  'pharmacology',
  'pharma',
  'arzneimittel',
  'arzneistoff',
  'medikament',
  'drug',
  'antibiotik',
  'zytostatik',
  'analgetik',
  'antihypertensiv',
  'antikoagul',
  'immunsuppress',
  'chemotherap',
];

function isPharmaDay(day: AmbossDay): boolean {
  const haystack = `${day.subject} ${day.sub_topic}`.toLowerCase();
  return PHARMA_KEYWORDS.some((kw) => haystack.includes(kw));
}

/**
 * Reorder AMBOSS days: if pharmaPrioritized, move all pharmacology days
 * to the front of the list while preserving relative order within each group.
 */
export function reorderAmbossDays(
  days: AmbossDay[],
  pharmaPrioritized: boolean
): AmbossDay[] {
  if (!pharmaPrioritized) {
    return [...days];
  }

  const pharma: AmbossDay[] = [];
  const rest: AmbossDay[] = [];

  for (const day of days) {
    if (isPharmaDay(day)) {
      pharma.push(day);
    } else {
      rest.push(day);
    }
  }

  return [...pharma, ...rest];
}

// ---------------------------------------------------------------------------
// Core Stretching Algorithm
// ---------------------------------------------------------------------------

/**
 * Determine whether a calendar day is available for scheduling AMBOSS content.
 * Available phases: semester, semester-late, vollzeit, vollzeit-late.
 */
function isSchedulablePhase(phase: Phase): boolean {
  return (
    phase === 'semester' ||
    phase === 'semester-late' ||
    phase === 'vollzeit' ||
    phase === 'vollzeit-late'
  );
}

/**
 * During semester phases the student has limited time (2-3h), so each AMBOSS
 * day is split across two calendar days:
 *   - Day 1: reading/study (0.5 fraction)
 *   - Day 2: Kreuzen questions (0.5 fraction)
 *
 * During Vollzeit phases the student studies full-time (6-8h), so each AMBOSS
 * day fits into a single calendar day (1.0 fraction).
 */
function isSemesterPhase(phase: Phase): boolean {
  return phase === 'semester' || phase === 'semester-late';
}

/**
 * Main stretching function. Assigns AMBOSS days to calendar days respecting
 * all constraints: phase-based splitting, vacations, weekends, retain tests,
 * and the final exam prep window.
 */
export function stretchPlan(
  ambossDays: AmbossDay[],
  calendar: CalendarDay[],
  config: PlanConfig
): CalendarDay[] {
  // Deep-clone the calendar so we don't mutate the input
  const result: CalendarDay[] = calendar.map((d) => ({ ...d }));

  // Count available study slots before the exam-prep window to make sure
  // we know how many we have. If there are more AMBOSS days than slots,
  // we will pack tighter (but this should not happen with 88 days / ~180 cal).
  const examPrepStart = addDays(parseDate(config.examDate), -EXAM_PREP_DAYS + 1);

  let ambossIndex = 0;
  let studyDayCounter = 0; // tracks every "study slot" consumed for retain-test cadence
  let pendingKreuzen: AmbossDay | null = null; // when in semester split mode

  for (let i = 0; i < result.length && ambossIndex < ambossDays.length; i++) {
    const cal = result[i];
    const calDate = parseDate(cal.date);

    // Do not schedule AMBOSS content in the exam-prep window
    if (calDate.getTime() >= examPrepStart.getTime()) {
      break;
    }

    // Only schedule on schedulable days
    if (!isSchedulablePhase(cal.phase)) {
      continue;
    }

    // ------------------------------------------------------------------
    // Semester split: reading day -> kreuzen day for the same AMBOSS day
    // ------------------------------------------------------------------
    if (isSemesterPhase(cal.phase)) {
      if (pendingKreuzen !== null) {
        // This calendar day becomes the Kreuzen half
        cal.ambossDay = pendingKreuzen;
        cal.splitFraction = 0.5;
        cal.splitPart = 'kreuzen';
        cal.isKreuzenOnly = true;
        pendingKreuzen = null;
        studyDayCounter++;

        // Retain test every 7 study-day slots
        if (studyDayCounter > 0 && studyDayCounter % 7 === 0) {
          cal.retainTestScheduled = true;
        }
      } else {
        // This calendar day becomes the Reading half; queue Kreuzen
        const ambossDay = ambossDays[ambossIndex];
        cal.ambossDay = ambossDay;
        cal.splitFraction = 0.5;
        cal.splitPart = 'reading';
        cal.isKreuzenOnly = false;
        pendingKreuzen = ambossDay;
        ambossIndex++;
        studyDayCounter++;
      }
    } else {
      // ----------------------------------------------------------------
      // Vollzeit: 1 AMBOSS day = 1 calendar day
      // ----------------------------------------------------------------

      // If there is a pending Kreuzen from a semester split that was not
      // yet placed (e.g., the student transitioned from semester to
      // Vollzeit mid-AMBOSS-day), finish it first.
      if (pendingKreuzen !== null) {
        cal.ambossDay = pendingKreuzen;
        cal.splitFraction = 0.5;
        cal.splitPart = 'kreuzen';
        cal.isKreuzenOnly = true;
        pendingKreuzen = null;
        studyDayCounter++;

        if (studyDayCounter > 0 && studyDayCounter % 7 === 0) {
          cal.retainTestScheduled = true;
        }
        continue;
      }

      const ambossDay = ambossDays[ambossIndex];
      cal.ambossDay = ambossDay;
      cal.splitFraction = 1.0;
      cal.splitPart = 'both';
      cal.isKreuzenOnly = false;
      ambossIndex++;
      studyDayCounter++;

      // Retain test every 7 study-day slots
      if (studyDayCounter > 0 && studyDayCounter % 7 === 0) {
        cal.retainTestScheduled = true;
      }
    }
  }

  // If there is still a pending Kreuzen that never got placed, try to
  // slot it into the next available day.
  if (pendingKreuzen !== null) {
    for (let i = 0; i < result.length; i++) {
      const cal = result[i];
      if (cal.ambossDay === null && isSchedulablePhase(cal.phase)) {
        cal.ambossDay = pendingKreuzen;
        cal.splitFraction = 0.5;
        cal.splitPart = 'kreuzen';
        cal.isKreuzenOnly = true;
        break;
      }
    }
  }

  // ------------------------------------------------------------------
  // Mark exam-prep days
  // ------------------------------------------------------------------
  for (const cal of result) {
    if (cal.phase === 'exam-prep' && cal.ambossDay === null) {
      // These 14 days are reserved for AMBOSS Probeklausuren only.
      // No regular study or Wiederholungen -- just mock exams.
      // Light Anki is OK but the focus is on Probeklausuren.
      cal.splitPart = null;
      cal.ankiTarget = 100;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Progress / Analytics Helpers
// ---------------------------------------------------------------------------

/** Count calendar days that have an AMBOSS day assigned. */
export function getStudyDaysCompleted(calendar: CalendarDay[]): number {
  const today = formatDate(new Date());
  return calendar.filter(
    (d) => d.ambossDay !== null && d.date <= today
  ).length;
}

/** Total number of calendar days that have any AMBOSS content. */
export function getTotalStudyDays(calendar: CalendarDay[]): number {
  return calendar.filter((d) => d.ambossDay !== null).length;
}

/** Progress as a percentage (0-100) of study days completed vs total. */
export function getProgressPercent(calendar: CalendarDay[]): number {
  const total = getTotalStudyDays(calendar);
  if (total === 0) return 0;
  const completed = getStudyDaysCompleted(calendar);
  return Math.round((completed / total) * 100);
}

// ---------------------------------------------------------------------------
// Convenience: Full Pipeline
// ---------------------------------------------------------------------------

/**
 * Run the entire plan generation pipeline from raw AMBOSS days and config.
 *
 * 1. Reorder AMBOSS days (pharma prioritization).
 * 2. Generate blank calendar.
 * 3. Stretch the AMBOSS days across the calendar.
 *
 * Returns the fully populated CalendarDay array.
 */
export function buildStudyPlan(
  ambossDays: AmbossDay[],
  config?: Partial<PlanConfig>
): CalendarDay[] {
  const fullConfig: PlanConfig = { ...getDefaultConfig(), ...config };
  const reordered = reorderAmbossDays(ambossDays, fullConfig.pharmaPrioritized);
  const calendar = generateCalendar(fullConfig);
  return stretchPlan(reordered, calendar, fullConfig);
}
