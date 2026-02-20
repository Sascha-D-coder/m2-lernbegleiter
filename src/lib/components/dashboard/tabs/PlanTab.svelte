<script lang="ts">
  import {
    getCalendarDays,
    getAmbossDays,
    getTodayIndex,
    isPlanGenerated,
    loadAmbossDays,
    setCalendarDays,
  } from "$lib/stores/planStore.svelte";
  import { getSettings } from "$lib/stores/settingsStore.svelte";
  import { buildStudyPlan, type CalendarDay, type Phase } from "$lib/utils/planEngine";
  import { formatDateGerman } from "$lib/utils/dateUtils";

  // ---------------------------------------------------------------------------
  // Local state
  // ---------------------------------------------------------------------------
  let generating = $state(false);
  let error = $state("");
  let selectedDayIndex = $state<number | null>(null);
  let activeView = $state<"calendar" | "list">("calendar");

  // ---------------------------------------------------------------------------
  // Derived from stores
  // ---------------------------------------------------------------------------
  let calendarDays = $derived(getCalendarDays());
  let ambossDays = $derived(getAmbossDays());
  let todayIndex = $derived(getTodayIndex());
  let planReady = $derived(isPlanGenerated());

  let todayStr = $derived(new Date().toISOString().split("T")[0]);

  // Stats
  let totalStudyDays = $derived(
    calendarDays.filter((d) => d.ambossDay !== null).length
  );
  let completedStudyDays = $derived(
    calendarDays.filter((d) => d.ambossDay !== null && d.date < todayStr).length
  );
  let daysUntilExam = $derived.by(() => {
    const settings = getSettings();
    const exam = new Date(settings.examDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    exam.setHours(0, 0, 0, 0);
    return Math.max(0, Math.ceil((exam.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  });
  let progressPercent = $derived(
    totalStudyDays > 0 ? Math.round((completedStudyDays / totalStudyDays) * 100) : 0
  );

  // Group calendar days by month (YYYY-MM key)
  let monthGroups = $derived.by(() => {
    const groups: Map<string, CalendarDay[]> = new Map();
    for (const day of calendarDays) {
      const key = day.date.substring(0, 7); // YYYY-MM
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(day);
    }
    return groups;
  });

  // Study days only (for list view)
  let studyDaysList = $derived(
    calendarDays.filter(
      (d) =>
        d.ambossDay !== null &&
        d.phase !== "weekend" &&
        d.phase !== "vacation-june" &&
        d.phase !== "vacation-sept"
    )
  );

  // ---------------------------------------------------------------------------
  // Phase styling helpers
  // ---------------------------------------------------------------------------
  const PHASE_COLORS: Record<Phase, { bg: string; text: string; label: string }> = {
    semester: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Semester" },
    "semester-late": { bg: "bg-blue-400/20", text: "text-blue-300", label: "Semester (sp\u00e4t)" },
    vollzeit: { bg: "bg-green-500/20", text: "text-green-400", label: "Vollzeit" },
    "vollzeit-late": { bg: "bg-green-400/20", text: "text-green-300", label: "Vollzeit (sp\u00e4t)" },
    "vacation-june": { bg: "bg-amber-500/20", text: "text-amber-400", label: "Urlaub Juni" },
    "vacation-sept": { bg: "bg-amber-500/20", text: "text-amber-400", label: "Urlaub Sept" },
    weekend: { bg: "bg-white/5", text: "text-text-muted", label: "Wochenende" },
    "exam-prep": { bg: "bg-red-500/20", text: "text-red-400", label: "Pr\u00fcfungsvorbereitung" },
    buffer: { bg: "bg-transparent", text: "text-text-muted", label: "Puffer" },
  };

  function phaseStyle(phase: Phase): { bg: string; text: string } {
    return PHASE_COLORS[phase] ?? { bg: "bg-transparent", text: "text-text-muted" };
  }

  function splitLabel(part: CalendarDay["splitPart"]): string {
    switch (part) {
      case "reading": return "Lesen";
      case "kreuzen": return "Kreuzen";
      case "both": return "Lesen + Kreuzen";
      default: return "";
    }
  }

  const MONTH_NAMES_DE = [
    "Januar", "Februar", "M\u00e4rz", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ];

  const WEEKDAY_HEADERS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  function monthLabel(key: string): string {
    const [year, month] = key.split("-").map(Number);
    return `${MONTH_NAMES_DE[month - 1]} ${year}`;
  }

  /** Parse ISO date to Date object (UTC). */
  function parseISO(iso: string): Date {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  /**
   * For the calendar grid we need to know which column (0-6, Mon-Sun)
   * each day falls in. ISO dayOfWeek: 0=Sunday. We remap to Mon=0..Sun=6.
   */
  function dayToGridCol(dayOfWeek: number): number {
    // dayOfWeek: 0=Sun,1=Mon,...,6=Sat -> Mon=0,Tue=1,...,Sun=6
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  }

  /** Build the grid rows for a given month. Returns a 2D array (weeks x 7 slots). */
  function buildMonthGrid(days: CalendarDay[]): (CalendarDay | null)[][] {
    if (days.length === 0) return [];
    const weeks: (CalendarDay | null)[][] = [];
    let currentWeek: (CalendarDay | null)[] = new Array(7).fill(null);

    for (const day of days) {
      const col = dayToGridCol(day.dayOfWeek);
      currentWeek[col] = day;

      // If we placed a Sunday (col=6), push and start new week
      if (col === 6) {
        weeks.push(currentWeek);
        currentWeek = new Array(7).fill(null);
      }
    }

    // Push the last partial week if it has any days
    if (currentWeek.some((d) => d !== null)) {
      weeks.push(currentWeek);
    }

    return weeks;
  }

  // ---------------------------------------------------------------------------
  // Generate plan action
  // ---------------------------------------------------------------------------
  async function generatePlan() {
    generating = true;
    error = "";
    try {
      // Fetch AMBOSS plan from static JSON
      const response = await fetch("/amboss-plan.json");
      if (!response.ok) throw new Error("Konnte AMBOSS-Plan nicht laden");
      const ambossData = await response.json();

      // Import into store (which also saves to DB)
      const { importAmbossPlan } = await import("$lib/stores/planStore.svelte");
      await importAmbossPlan(ambossData);

      // Build the study plan using settings
      const settings = getSettings();
      const planConfig = {
        startDate: "2026-04-01",
        examDate: settings.examDate,
        semesterEndDate: settings.semesterEndDate,
        juneVacation: {
          start: settings.juneVacationStart,
          end: settings.juneVacationEnd,
        },
        septVacation: {
          start: settings.septVacationStart,
          end: settings.septVacationEnd,
        },
        weekendsOff: settings.weekendsOff,
        semesterHoursPerDay: settings.semesterHoursPerDay,
        fulltimeHoursPerDay: settings.fulltimeHoursPerDay,
        pharmaPrioritized: settings.pharmaPrioritized,
      };

      const days = buildStudyPlan(ambossData, planConfig);
      setCalendarDays(days);
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : "Unbekannter Fehler";
      console.error("Plan generation failed:", e);
    } finally {
      generating = false;
    }
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div>
    <h2 class="text-2xl font-bold text-text-primary">Lernplan</h2>
    <p class="text-sm text-text-secondary">
      April 2026 &ndash; Oktober 2026 &middot; {totalStudyDays} Lerntage gestreckt
    </p>
  </div>

  {#if !planReady}
    <!-- Generate Plan CTA -->
    <div class="rounded-xl bg-bg-secondary border border-border p-8 text-center">
      <div class="text-4xl mb-3">&#128197;</div>
      <h3 class="text-lg font-semibold text-text-primary">Lernplan generieren</h3>
      <p class="text-sm text-text-muted mt-2 mb-6">
        Erstelle deinen personalisierten Lernplan basierend auf dem AMBOSS 100-Tage-Plan
        und deinen Einstellungen.
      </p>

      {#if error}
        <div class="mb-4 rounded-lg bg-danger/10 border border-danger/20 p-3 text-sm text-danger">
          {error}
        </div>
      {/if}

      <button
        onclick={generatePlan}
        disabled={generating}
        class="rounded-lg bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {#if generating}
          <span class="inline-flex items-center gap-2">
            <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25" />
              <path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" class="opacity-75" />
            </svg>
            Plan wird generiert...
          </span>
        {:else}
          Plan generieren
        {/if}
      </button>
    </div>
  {:else}
    <!-- Stats Summary -->
    <div class="grid grid-cols-4 gap-3">
      <div class="rounded-xl bg-bg-secondary border border-border p-3 text-center">
        <div class="text-xl font-bold text-text-primary">{totalStudyDays}</div>
        <div class="text-xs text-text-muted">Lerntage gesamt</div>
      </div>
      <div class="rounded-xl bg-bg-secondary border border-border p-3 text-center">
        <div class="text-xl font-bold text-text-primary">{completedStudyDays}</div>
        <div class="text-xs text-text-muted">Abgeschlossen</div>
      </div>
      <div class="rounded-xl bg-bg-secondary border border-border p-3 text-center">
        <div class="text-xl font-bold text-accent">{daysUntilExam}</div>
        <div class="text-xs text-text-muted">Tage bis Examen</div>
      </div>
      <div class="rounded-xl bg-bg-secondary border border-border p-3 text-center">
        <div class="text-xl font-bold text-success">{progressPercent}%</div>
        <div class="text-xs text-text-muted">Fortschritt</div>
      </div>
    </div>

    <!-- Phase Legend -->
    <div class="rounded-xl bg-bg-secondary border border-border p-4">
      <h4 class="text-xs font-medium uppercase tracking-wider text-text-muted mb-3">Phasen-Legende</h4>
      <div class="flex flex-wrap gap-3">
        {#each Object.entries(PHASE_COLORS) as [phase, colors]}
          {#if phase !== "buffer"}
            <div class="flex items-center gap-1.5">
              <span class="inline-block h-3 w-3 rounded-sm {colors.bg} {colors.text} border border-current/20"></span>
              <span class="text-xs text-text-secondary">{colors.label}</span>
            </div>
          {/if}
        {/each}
      </div>
    </div>

    <!-- View Toggle -->
    <div class="flex gap-2">
      <button
        onclick={() => (activeView = "calendar")}
        class="rounded-lg px-4 py-2 text-sm font-medium transition-colors {activeView === 'calendar'
          ? 'bg-accent text-white'
          : 'bg-bg-secondary text-text-secondary border border-border hover:text-text-primary'}"
      >
        Kalender
      </button>
      <button
        onclick={() => (activeView = "list")}
        class="rounded-lg px-4 py-2 text-sm font-medium transition-colors {activeView === 'list'
          ? 'bg-accent text-white'
          : 'bg-bg-secondary text-text-secondary border border-border hover:text-text-primary'}"
      >
        Liste
      </button>
    </div>

    {#if activeView === "calendar"}
      <!-- Calendar View: Month by Month -->
      <div class="space-y-6">
        {#each [...monthGroups.entries()] as [monthKey, days]}
          <div class="rounded-xl bg-bg-secondary border border-border p-4">
            <h3 class="text-base font-semibold text-text-primary mb-3">{monthLabel(monthKey)}</h3>

            <!-- Weekday headers -->
            <div class="grid grid-cols-7 gap-1 mb-1">
              {#each WEEKDAY_HEADERS as header}
                <div class="text-center text-xs font-medium text-text-muted py-1">{header}</div>
              {/each}
            </div>

            <!-- Day cells -->
            {#each buildMonthGrid(days) as week}
              <div class="grid grid-cols-7 gap-1">
                {#each week as cell}
                  {#if cell === null}
                    <div class="h-14 rounded-md"></div>
                  {:else}
                    {@const style = phaseStyle(cell.phase)}
                    {@const isToday = cell.date === todayStr}
                    {@const hasAmboss = cell.ambossDay !== null}
                    {@const isSelected = selectedDayIndex !== null && calendarDays[selectedDayIndex]?.date === cell.date}
                    <button
                      onclick={() => {
                        const idx = calendarDays.findIndex((d) => d.date === cell.date);
                        selectedDayIndex = idx >= 0 ? idx : null;
                      }}
                      class="h-14 rounded-md p-1 flex flex-col items-center justify-start text-center transition-all
                        {style.bg} {style.text}
                        {isToday ? 'ring-2 ring-accent ring-offset-1 ring-offset-bg-primary' : ''}
                        {isSelected ? 'ring-2 ring-text-primary' : ''}
                        hover:brightness-125 cursor-pointer"
                    >
                      <span class="text-xs font-medium leading-none mt-0.5">
                        {parseISO(cell.date).getUTCDate()}
                      </span>
                      {#if cell.phase === "vacation-june" || cell.phase === "vacation-sept"}
                        <span class="text-[9px] leading-none mt-1 opacity-70">Url.</span>
                      {:else if cell.phase === "exam-prep"}
                        <span class="text-[9px] leading-none mt-1 opacity-70">Exam</span>
                      {:else if hasAmboss}
                        <span class="text-[9px] leading-tight mt-0.5 line-clamp-2 w-full overflow-hidden">
                          {cell.ambossDay!.subject.substring(0, 4)}
                        </span>
                        {#if cell.splitPart === "reading"}
                          <span class="text-[8px] opacity-60">R</span>
                        {:else if cell.splitPart === "kreuzen"}
                          <span class="text-[8px] opacity-60">K</span>
                        {/if}
                      {:else if cell.phase === "weekend"}
                        <span class="text-[9px] leading-none mt-1 opacity-40">WE</span>
                      {/if}
                    </button>
                  {/if}
                {/each}
              </div>
            {/each}
          </div>
        {/each}
      </div>

      <!-- Selected Day Detail -->
      {#if selectedDayIndex !== null && calendarDays[selectedDayIndex]}
        {@const sel = calendarDays[selectedDayIndex]}
        {@const selStyle = phaseStyle(sel.phase)}
        <div class="rounded-xl bg-bg-secondary border border-border p-4 sticky bottom-0">
          <div class="flex items-start justify-between">
            <div>
              <div class="text-xs font-medium uppercase tracking-wider {selStyle.text}">
                {PHASE_COLORS[sel.phase]?.label ?? sel.phase}
              </div>
              <h3 class="text-base font-semibold text-text-primary mt-0.5">
                {formatDateGerman(parseISO(sel.date))}
              </h3>
              {#if sel.ambossDay}
                <p class="text-sm text-text-secondary mt-1">
                  Tag {sel.ambossDay.day_number}: {sel.ambossDay.subject} &ndash; {sel.ambossDay.sub_topic}
                </p>
                <div class="flex flex-wrap gap-2 mt-2">
                  {#if sel.splitPart}
                    <span class="rounded-md bg-white/5 px-2 py-0.5 text-xs text-text-secondary">
                      {splitLabel(sel.splitPart)}
                    </span>
                  {/if}
                  <span class="rounded-md bg-white/5 px-2 py-0.5 text-xs text-text-secondary">
                    {sel.ambossDay.question_count} Fragen
                  </span>
                  <span class="rounded-md bg-white/5 px-2 py-0.5 text-xs text-text-secondary">
                    Anki: {sel.ankiTarget}
                  </span>
                  {#if sel.retainTestScheduled}
                    <span class="rounded-md bg-accent/20 px-2 py-0.5 text-xs text-accent">
                      Retain-Test
                    </span>
                  {/if}
                </div>
              {:else}
                <p class="text-sm text-text-muted mt-1">
                  {#if sel.phase === "vacation-june" || sel.phase === "vacation-sept"}
                    Urlaub &ndash; Nur Anki ({sel.ankiTarget} Karten)
                  {:else if sel.phase === "exam-prep"}
                    Generalprobe / Mock-Examen &ndash; Anki: {sel.ankiTarget}
                  {:else if sel.phase === "weekend"}
                    Wochenende &ndash; Leichtes Anki ({sel.ankiTarget} Karten)
                  {:else}
                    Kein AMBOSS-Tag zugewiesen
                  {/if}
                </p>
              {/if}
            </div>
            <button
              onclick={() => (selectedDayIndex = null)}
              class="text-text-muted hover:text-text-primary text-lg leading-none p-1"
            >
              &times;
            </button>
          </div>
        </div>
      {/if}
    {:else}
      <!-- List View: Study days only -->
      <div class="rounded-xl bg-bg-secondary border border-border overflow-hidden">
        <div class="overflow-y-auto max-h-[600px]">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-bg-secondary border-b border-border">
              <tr class="text-xs text-text-muted uppercase tracking-wider">
                <th class="text-left px-3 py-2 font-medium">Datum</th>
                <th class="text-left px-3 py-2 font-medium">Tag</th>
                <th class="text-left px-3 py-2 font-medium">Fach</th>
                <th class="text-left px-3 py-2 font-medium">Thema</th>
                <th class="text-left px-3 py-2 font-medium">Modus</th>
                <th class="text-right px-3 py-2 font-medium">Fragen</th>
              </tr>
            </thead>
            <tbody>
              {#each studyDaysList as day, idx}
                {@const isToday = day.date === todayStr}
                {@const style = phaseStyle(day.phase)}
                {@const isSelected = selectedDayIndex !== null && calendarDays[selectedDayIndex]?.date === day.date}
                <tr
                  onclick={() => {
                    const calIdx = calendarDays.findIndex((d) => d.date === day.date);
                    selectedDayIndex = calIdx >= 0 ? calIdx : null;
                  }}
                  class="border-b border-border/50 cursor-pointer transition-colors hover:bg-white/5
                    {isToday ? 'bg-accent/10 border-l-2 border-l-accent' : ''}
                    {isSelected ? 'bg-white/10' : ''}"
                >
                  <td class="px-3 py-2 whitespace-nowrap">
                    <span class="text-text-secondary">
                      {parseISO(day.date).getUTCDate()}.{String(parseISO(day.date).getUTCMonth() + 1).padStart(2, "0")}.
                    </span>
                  </td>
                  <td class="px-3 py-2">
                    <span class="{style.bg} {style.text} rounded px-1.5 py-0.5 text-xs font-medium">
                      {day.ambossDay?.day_number ?? ""}
                    </span>
                  </td>
                  <td class="px-3 py-2 text-text-primary font-medium truncate max-w-[120px]">
                    {day.ambossDay?.subject ?? ""}
                  </td>
                  <td class="px-3 py-2 text-text-secondary truncate max-w-[180px]">
                    {day.ambossDay?.sub_topic ?? ""}
                  </td>
                  <td class="px-3 py-2">
                    <span class="text-xs text-text-muted">
                      {splitLabel(day.splitPart)}
                    </span>
                  </td>
                  <td class="px-3 py-2 text-right text-text-secondary tabular-nums">
                    {day.ambossDay?.question_count ?? ""}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  {/if}
</div>
