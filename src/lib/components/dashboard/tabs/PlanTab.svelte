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
  import { formatISODateShort } from "$lib/utils/dateUtils";
  import { toastSuccess, toastError, toastInfo, toastWarning } from "$lib/stores/toastStore.svelte";

  // ---------------------------------------------------------------------------
  // Local state
  // ---------------------------------------------------------------------------
  let generating = $state(false);
  let error = $state("");
  let selectedDayIndex = $state<number | null>(null);
  let activeView = $state<"calendar" | "list">("calendar");

  // Drag-and-drop state for list view reordering
  let dragSourceIndex = $state<number | null>(null);
  let dragOverIndex = $state<number | null>(null);

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
  // Subject color map for calendar cells
  // ---------------------------------------------------------------------------
  const SUBJECT_COLORS: Record<string, { bg: string; text: string }> = {
    "Innere Medizin": { bg: "bg-red-500/25", text: "text-red-400" },
    "Chirurgie": { bg: "bg-orange-500/25", text: "text-orange-400" },
    "Anästhesiologie": { bg: "bg-emerald-500/25", text: "text-emerald-400" },
    "Augenheilkunde": { bg: "bg-cyan-500/25", text: "text-cyan-400" },
    "Dermatologie": { bg: "bg-yellow-500/25", text: "text-yellow-400" },
    "Gynäkologie & Geburtshilfe": { bg: "bg-pink-500/25", text: "text-pink-400" },
    "Hals-Nasen-Ohren-Heilkunde": { bg: "bg-teal-500/25", text: "text-teal-400" },
    "Orthopädie & Unfallchirurgie": { bg: "bg-amber-500/25", text: "text-amber-400" },
    "Neurologie": { bg: "bg-blue-500/25", text: "text-blue-400" },
    "Psychiatrie": { bg: "bg-indigo-500/25", text: "text-indigo-400" },
    "Pädiatrie": { bg: "bg-green-500/25", text: "text-green-400" },
    "Radiologie": { bg: "bg-slate-500/25", text: "text-slate-400" },
    "Notfallmedizin": { bg: "bg-rose-500/25", text: "text-rose-400" },
    "Urologie": { bg: "bg-lime-500/25", text: "text-lime-400" },
    "Pharmakologie": { bg: "bg-purple-500/25", text: "text-purple-400" },
    "Klinische Chemie & Labormedizin": { bg: "bg-fuchsia-500/25", text: "text-fuchsia-400" },
    "Rechtsmedizin": { bg: "bg-stone-500/25", text: "text-stone-400" },
    "Arbeitsmedizin & Hygiene": { bg: "bg-zinc-500/25", text: "text-zinc-400" },
    "Allgemeinmedizin": { bg: "bg-sky-500/25", text: "text-sky-400" },
    "Mikrobiologie": { bg: "bg-violet-500/25", text: "text-violet-400" },
    "Wiederholung": { bg: "bg-gray-500/25", text: "text-gray-400" },
    "Generalprobe": { bg: "bg-red-600/25", text: "text-red-300" },
  };

  const DEFAULT_SUBJECT_STYLE = { bg: "bg-gray-500/20", text: "text-gray-400" };

  function subjectStyle(subject: string | undefined): { bg: string; text: string } {
    if (!subject) return DEFAULT_SUBJECT_STYLE;
    return SUBJECT_COLORS[subject] ?? DEFAULT_SUBJECT_STYLE;
  }

  function cellStyle(cell: CalendarDay): { bg: string; text: string } {
    if (cell.ambossDay) {
      return subjectStyle(cell.ambossDay.subject);
    }
    if (cell.phase === "vacation-june" || cell.phase === "vacation-sept") {
      return { bg: "bg-amber-500/15", text: "text-amber-400" };
    }
    if (cell.phase === "exam-prep") {
      return { bg: "bg-red-500/20", text: "text-red-400" };
    }
    if (cell.phase === "weekend") {
      return { bg: "bg-bg-primary", text: "text-text-muted" };
    }
    return { bg: "bg-transparent", text: "text-text-muted" };
  }

  function splitLabel(part: CalendarDay["splitPart"]): string {
    switch (part) {
      case "reading": return "Lesen";
      case "kreuzen": return "Kreuzen";
      case "both": return "Lesen + Kreuzen";
      default: return "";
    }
  }

  function isExamDate(dateStr: string): boolean {
    const settings = getSettings();
    return dateStr === settings.examDate;
  }

  // --- AMBOSS link helpers ---

  async function openAmbossChapter(chapter: string) {
    if (!chapter) {
      toastWarning("Kein Kapitel verknüpft. Öffne AMBOSS manuell und suche das Thema.");
      return;
    }
    const url = `https://next.amboss.com/de/search?q=${encodeURIComponent(chapter)}`;
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      toastInfo(`Öffne "${chapter}" in AMBOSS...`);
    } catch {
      window.open(url, "_blank");
      toastInfo(`Öffne "${chapter}" im Browser...`);
    }
  }

  async function openAmbossKreuzen() {
    const url = "https://next.amboss.com/de/questions";
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      toastInfo("Öffne AMBOSS-Kreuzsitzung...");
    } catch {
      window.open(url, "_blank");
      toastInfo("Öffne AMBOSS-Kreuzsitzung im Browser...");
    }
  }

  async function openAmbossProbeklausur() {
    const url = "https://next.amboss.com/de/exams";
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      toastInfo("Öffne AMBOSS-Probeklausuren...");
    } catch {
      window.open(url, "_blank");
      toastInfo("Öffne AMBOSS-Probeklausuren im Browser...");
    }
  }

  const MONTH_NAMES_DE = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ];

  const WEEKDAY_HEADERS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  function monthLabel(key: string): string {
    const [year, month] = key.split("-").map(Number);
    return `${MONTH_NAMES_DE[month - 1]} ${year}`;
  }

  function parseISO(iso: string): Date {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  function dayToGridCol(dayOfWeek: number): number {
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  }

  function buildMonthGrid(days: CalendarDay[]): (CalendarDay | null)[][] {
    if (days.length === 0) return [];
    const weeks: (CalendarDay | null)[][] = [];
    let currentWeek: (CalendarDay | null)[] = new Array(7).fill(null);

    for (const day of days) {
      const col = dayToGridCol(day.dayOfWeek);
      currentWeek[col] = day;

      if (col === 6) {
        weeks.push(currentWeek);
        currentWeek = new Array(7).fill(null);
      }
    }

    if (currentWeek.some((d) => d !== null)) {
      weeks.push(currentWeek);
    }

    return weeks;
  }

  // ---------------------------------------------------------------------------
  // Subject legend for the calendar
  // ---------------------------------------------------------------------------
  let activeSubjects = $derived.by(() => {
    const subjects = new Set<string>();
    for (const day of calendarDays) {
      if (day.ambossDay) {
        subjects.add(day.ambossDay.subject);
      }
    }
    return [...subjects];
  });

  // ---------------------------------------------------------------------------
  // Generate plan action
  // ---------------------------------------------------------------------------
  async function generatePlan() {
    generating = true;
    error = "";
    toastInfo("Plan wird generiert...");
    try {
      const response = await fetch("/amboss-plan.json");
      if (!response.ok) throw new Error("Konnte AMBOSS-Plan nicht laden");
      const ambossData = await response.json();

      const { importAmbossPlan } = await import("$lib/stores/planStore.svelte");
      await importAmbossPlan(ambossData);

      const settings = getSettings();
      const planConfig = {
        startDate: settings.planStartDate,
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
      toastSuccess("Lernplan erfolgreich generiert!");
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : "Unbekannter Fehler";
      toastError(`Plan-Generierung fehlgeschlagen: ${error}`);
      console.error("Plan generation failed:", e);
    } finally {
      generating = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Drag-and-drop reordering in list view
  // ---------------------------------------------------------------------------
  function handleDragStart(idx: number) {
    dragSourceIndex = idx;
  }

  function handleDragOver(e: DragEvent, idx: number) {
    e.preventDefault();
    dragOverIndex = idx;
  }

  function handleDragEnd() {
    dragSourceIndex = null;
    dragOverIndex = null;
  }

  async function handleDrop(targetIdx: number) {
    if (dragSourceIndex === null || dragSourceIndex === targetIdx) {
      dragSourceIndex = null;
      dragOverIndex = null;
      return;
    }

    const sourceDay = studyDaysList[dragSourceIndex];
    const targetDay = studyDaysList[targetIdx];

    if (!sourceDay || !targetDay) return;

    const sourceCalIdx = calendarDays.findIndex((d) => d.date === sourceDay.date);
    const targetCalIdx = calendarDays.findIndex((d) => d.date === targetDay.date);

    if (sourceCalIdx < 0 || targetCalIdx < 0) return;

    // Clone calendar and swap the amboss day assignments
    const newCalendar = calendarDays.map((d) => ({ ...d }));
    const tempAmboss = newCalendar[sourceCalIdx].ambossDay;
    newCalendar[sourceCalIdx].ambossDay = newCalendar[targetCalIdx].ambossDay;
    newCalendar[targetCalIdx].ambossDay = tempAmboss;

    await setCalendarDays(newCalendar);
    toastSuccess("Lerneinheiten getauscht!");

    dragSourceIndex = null;
    dragOverIndex = null;
  }
</script>

<div class="flex flex-col h-full">
<div class="space-y-6 flex-1 overflow-y-auto p-6">
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
      {#if calendarDays.length > 0}
        <h3 class="text-lg font-semibold text-text-primary">Lernplan noch nicht gestartet</h3>
        <p class="text-sm text-text-muted mt-2 mb-6">
          Dein Lernplan wurde erstellt, hat aber noch nicht begonnen. Schau bald wieder vorbei!
        </p>
      {:else}
        <h3 class="text-lg font-semibold text-text-primary">Lernplan generieren</h3>
        <p class="text-sm text-text-muted mt-2 mb-6">
          Erstelle deinen personalisierten Lernplan basierend auf dem AMBOSS 100-Tage-Plan
          und deinen Einstellungen.
        </p>
      {/if}

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
          {calendarDays.length > 0 ? "Plan neu generieren" : "Plan generieren"}
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

    <!-- Subject Color Legend (replaces Phase Legend) -->
    <div class="rounded-xl bg-bg-secondary border border-border p-4">
      <h4 class="text-xs font-medium uppercase tracking-wider text-text-muted mb-3">Fächer-Legende</h4>
      <div class="flex flex-wrap gap-2">
        {#each activeSubjects as subject}
          {@const style = subjectStyle(subject)}
          <div class="flex items-center gap-1.5">
            <span class="inline-block h-3 w-3 rounded-sm {style.bg} border border-current/20 {style.text}"></span>
            <span class="text-[10px] text-text-secondary">{subject}</span>
          </div>
        {/each}
        <div class="flex items-center gap-1.5 ml-2 pl-2 border-l border-border">
          <span class="inline-block h-3 w-3 rounded-sm bg-amber-500/15 border border-amber-400/20"></span>
          <span class="text-[10px] text-text-secondary">Urlaub</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="inline-block h-3 w-3 rounded-sm bg-red-500/20 border border-red-400/20"></span>
          <span class="text-[10px] text-text-secondary">Probeklausuren</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="inline-block h-3 w-3 rounded-sm bg-bg-primary border-2 border-danger"></span>
          <span class="text-[10px] text-text-secondary font-bold">Examen</span>
        </div>
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
                    {@const style = cellStyle(cell)}
                    {@const isToday = cell.date === todayStr}
                    {@const hasAmboss = cell.ambossDay !== null}
                    {@const isSelected = selectedDayIndex !== null && calendarDays[selectedDayIndex]?.date === cell.date}
                    {@const isExam = isExamDate(cell.date)}
                    <button
                      onclick={() => {
                        const idx = calendarDays.findIndex((d) => d.date === cell.date);
                        selectedDayIndex = idx >= 0 ? idx : null;
                      }}
                      class="h-14 rounded-md p-1 flex flex-col items-center justify-start text-center transition-all
                        {style.bg} {style.text}
                        {isToday ? 'ring-2 ring-accent ring-offset-1 ring-offset-bg-primary' : ''}
                        {isSelected ? 'ring-2 ring-text-primary' : ''}
                        {isExam ? 'ring-2 ring-danger' : ''}
                        hover:brightness-125 cursor-pointer"
                    >
                      <span class="text-xs leading-none mt-0.5 {isExam ? 'font-black text-danger' : 'font-medium'}">
                        {parseISO(cell.date).getUTCDate()}
                      </span>
                      {#if isExam}
                        <span class="text-[8px] leading-none mt-0.5 font-bold text-danger">EXAM</span>
                      {:else if cell.phase === "vacation-june" || cell.phase === "vacation-sept"}
                        <span class="text-[9px] leading-none mt-1 opacity-70">Url.</span>
                      {:else if cell.phase === "exam-prep"}
                        <span class="text-[9px] leading-none mt-1 opacity-70">Probe</span>
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

    {:else}
      <!-- List View: Study days only (draggable) -->
      <div class="rounded-xl bg-bg-secondary border border-border overflow-hidden">
        <div class="px-4 py-2 border-b border-border bg-bg-secondary/50">
          <p class="text-[10px] text-text-muted">Ziehe Zeilen per Drag &amp; Drop, um Lerneinheiten umzuordnen.</p>
        </div>
        <div class="overflow-y-auto max-h-[600px]">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-bg-secondary border-b border-border">
              <tr class="text-xs text-text-muted uppercase tracking-wider">
                <th class="text-left px-2 py-2 font-medium w-6"></th>
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
                {@const style = cellStyle(day)}
                {@const isSelected = selectedDayIndex !== null && calendarDays[selectedDayIndex]?.date === day.date}
                {@const isDragOver = dragOverIndex === idx && dragSourceIndex !== null && dragSourceIndex !== idx}
                <tr
                  draggable="true"
                  ondragstart={() => handleDragStart(idx)}
                  ondragover={(e: DragEvent) => handleDragOver(e, idx)}
                  ondragend={handleDragEnd}
                  ondrop={() => handleDrop(idx)}
                  onclick={() => {
                    const calIdx = calendarDays.findIndex((d) => d.date === day.date);
                    selectedDayIndex = calIdx >= 0 ? calIdx : null;
                  }}
                  class="border-b border-border/50 cursor-grab transition-colors hover:bg-bg-primary
                    {isToday ? 'bg-accent/10 border-l-2 border-l-accent' : ''}
                    {isSelected ? 'bg-bg-primary' : ''}
                    {isDragOver ? 'bg-accent/20 border-t-2 border-t-accent' : ''}"
                >
                  <td class="px-2 py-2 text-text-muted">
                    <svg class="w-3.5 h-3.5 opacity-40" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
                      <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                      <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                    </svg>
                  </td>
                  <td class="px-3 py-2 whitespace-nowrap">
                    <span class="text-text-secondary">
                      {formatISODateShort(day.date)}
                    </span>
                  </td>
                  <td class="px-3 py-2">
                    <span class="{style.bg} {style.text} rounded px-1.5 py-0.5 text-xs font-medium">
                      {day.ambossDay?.day_number ?? ""}
                    </span>
                  </td>
                  <td class="px-3 py-2 text-text-primary font-medium truncate max-w-[120px]">
                    {#if day.ambossDay}
                      <button
                        onclick={(e: MouseEvent) => { e.stopPropagation(); openAmbossChapter(day.ambossDay!.chapters?.[0] ?? day.ambossDay!.subject); }}
                        class="hover:text-accent transition-colors"
                      >
                        {day.ambossDay.subject}
                      </button>
                    {/if}
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
</div><!-- end scrollable content -->

<!-- Selected Day Detail: docked to bottom outside scroll area -->
{#if selectedDayIndex !== null && calendarDays[selectedDayIndex]}
  {@const sel = calendarDays[selectedDayIndex]}
  {@const selStyle = cellStyle(sel)}
  <div class="shrink-0 border-t border-border bg-bg-secondary p-4">
    <div class="flex items-start justify-between">
      <div class="flex-1 min-w-0">
        <div class="text-xs font-medium uppercase tracking-wider {selStyle.text}">
          {sel.ambossDay?.subject ?? sel.phase}
        </div>
        <h3 class="text-base font-semibold text-text-primary mt-0.5">
          {formatISODateShort(sel.date)}
          {#if isExamDate(sel.date)}
            <span class="ml-2 text-danger font-bold">EXAMEN</span>
          {/if}
        </h3>
        {#if sel.ambossDay}
          <p class="text-sm text-text-secondary mt-1">
            Tag {sel.ambossDay.day_number}: {sel.ambossDay.subject} &ndash; {sel.ambossDay.sub_topic}
          </p>

          {#if sel.ambossDay.chapters && sel.ambossDay.chapters.length > 0}
            <div class="mt-2">
              <div class="text-xs font-medium text-text-muted mb-1.5">Kapitel:</div>
              <div class="flex flex-wrap gap-1.5">
                {#each sel.ambossDay.chapters as chapter}
                  <button
                    onclick={() => openAmbossChapter(chapter)}
                    class="rounded-md bg-bg-primary border border-border/50 px-2 py-0.5 text-xs text-text-secondary hover:text-accent hover:border-accent/40 transition-colors cursor-pointer"
                  >
                    {chapter}
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          <div class="flex flex-wrap gap-2 mt-3">
            {#if sel.splitPart === "reading" || sel.splitPart === "both"}
              <button
                onclick={() => openAmbossChapter(sel.ambossDay!.chapters[0] ?? sel.ambossDay!.subject)}
                class="rounded-md bg-accent/15 px-3 py-1 text-xs font-medium text-accent hover:bg-accent/25 transition-colors cursor-pointer"
              >
                Kapitel lesen
              </button>
            {/if}
            {#if sel.splitPart === "kreuzen" || sel.splitPart === "both"}
              <button
                onclick={openAmbossKreuzen}
                class="rounded-md bg-accent/15 px-3 py-1 text-xs font-medium text-accent hover:bg-accent/25 transition-colors cursor-pointer"
              >
                {sel.ambossDay.question_count} Fragen kreuzen
              </button>
            {/if}
            <span class="rounded-md bg-bg-primary px-2 py-0.5 text-xs text-text-secondary">
              Anki: {sel.ankiTarget}
            </span>
            {#if sel.retainTestScheduled}
              <span class="rounded-md bg-accent/20 px-2 py-0.5 text-xs text-accent">
                Retain-Test
              </span>
            {/if}
          </div>
        {:else}
          {#if sel.phase === "exam-prep"}
            <p class="text-sm text-text-secondary mt-1">
              Nur AMBOSS-Probeklausuren &ndash; keine Wiederholungen oder neuen Themen.
            </p>
            <div class="flex flex-wrap gap-2 mt-2">
              <button
                onclick={openAmbossProbeklausur}
                class="rounded-md bg-red-500/15 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-500/25 transition-colors cursor-pointer"
              >
                AMBOSS-Probeklausur starten
              </button>
              <span class="rounded-md bg-bg-primary px-2 py-0.5 text-xs text-text-secondary">
                Anki: {sel.ankiTarget} (leicht)
              </span>
            </div>
          {:else}
            <p class="text-sm text-text-muted mt-1">
              {#if sel.phase === "vacation-june" || sel.phase === "vacation-sept"}
                Urlaub &ndash; Nur Anki ({sel.ankiTarget} Karten)
              {:else if sel.phase === "weekend"}
                Wochenende &ndash; Leichtes Anki ({sel.ankiTarget} Karten)
              {:else}
                Kein AMBOSS-Tag zugewiesen
              {/if}
            </p>
          {/if}
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
</div><!-- end outer flex container -->
