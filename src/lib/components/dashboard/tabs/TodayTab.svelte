<script lang="ts">
  import { getTodayCalendarDay, getTodayAmbossDay, getProgressPercent, getCurrentDayNumber, getTotalStudyDays, getCalendarDays, isPlanGenerated } from "$lib/stores/planStore.svelte";
  import { getCardsDueCount_, isConnected as isAnkiConnected } from "$lib/stores/ankiStore.svelte";
  import { getDb } from "$lib/api/db";
  import { formatDateLong } from "$lib/utils/dateUtils";

  // Derived reactive values from stores
  let todayCalDay = $derived(getTodayCalendarDay());
  let todayAmboss = $derived(getTodayAmbossDay());
  let dayNumber = $derived(getCurrentDayNumber());
  let totalDays = $derived(getTotalStudyDays());
  let progressPercent = $derived(getProgressPercent());
  let ankiDue = $derived(getCardsDueCount_());
  let planReady = $derived(isPlanGenerated());
  let calendarDays = $derived(getCalendarDays());

  // Determine the plan status (mirrors Widget.svelte logic)
  let planStatus = $derived.by(() => {
    if (!planReady) return { type: "no-plan" as const };

    const todayStr = new Date().toISOString().split("T")[0];

    if (todayCalDay) {
      if (todayAmboss) {
        return { type: "study-day" as const };
      }
      const phase = todayCalDay.phase;
      if (phase === "weekend") return { type: "free-day" as const, message: "Wochenende - nur Anki" };
      if (phase === "vacation-june" || phase === "vacation-sept") return { type: "free-day" as const, message: "Urlaub - nur Anki" };
      if (phase === "exam-prep") return { type: "free-day" as const, message: "Probeklausuren-Phase" };
      return { type: "free-day" as const, message: "Heute frei" };
    }

    if (calendarDays.length > 0) {
      const firstDate = calendarDays[0].date;
      if (todayStr < firstDate) {
        const d = new Date(firstDate + "T00:00:00");
        const formatted = d.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
        return { type: "not-started" as const, message: `Dein Plan startet am ${formatted}` };
      }
      return { type: "free-day" as const, message: "Plan abgeschlossen" };
    }

    return { type: "no-plan" as const };
  });

  // Local progress state
  let readingDone = $state(false);
  let kreuzenDone = $state(false);
  let kreuzenCorrect = $state(0);
  let kreuzenTotal = $state(0);
  let streak = $state(0);

  // Load progress from DB on mount
  $effect(() => {
    loadTodayProgress();
    loadStreak();
  });

  async function loadTodayProgress() {
    const today = new Date().toISOString().split("T")[0];
    const db = await getDb();
    const rows = await db.select<Record<string,unknown>[]>(
      "SELECT * FROM daily_progress WHERE date = ?", [today]
    );
    if (rows.length > 0) {
      readingDone = Boolean(rows[0].reading_completed);
      kreuzenDone = Boolean(rows[0].kreuzen_completed);
      kreuzenCorrect = (rows[0].kreuzen_correct as number) ?? 0;
      kreuzenTotal = (rows[0].kreuzen_total as number) ?? 0;
    }
  }

  async function loadStreak() {
    const db = await getDb();
    const rows = await db.select<Record<string,unknown>[]>(
      "SELECT current_streak FROM streaks WHERE id = 1"
    );
    if (rows.length > 0) {
      streak = (rows[0].current_streak as number) ?? 0;
    }
  }

  async function toggleReading() {
    readingDone = !readingDone;
    await saveProgress();
  }

  async function toggleKreuzen() {
    kreuzenDone = !kreuzenDone;
    await saveProgress();
  }

  async function saveProgress() {
    const today = new Date().toISOString().split("T")[0];
    const db = await getDb();
    await db.execute(
      `INSERT INTO daily_progress (date, amboss_day_id, reading_completed, kreuzen_completed, kreuzen_correct, kreuzen_total)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(date, amboss_day_id) DO UPDATE SET
         reading_completed = excluded.reading_completed,
         kreuzen_completed = excluded.kreuzen_completed,
         kreuzen_correct = excluded.kreuzen_correct,
         kreuzen_total = excluded.kreuzen_total`,
      [today, todayAmboss?.day_number ?? null, readingDone ? 1 : 0, kreuzenDone ? 1 : 0, kreuzenCorrect, kreuzenTotal]
    );
    await updateStreak();
  }

  async function updateStreak() {
    if (!readingDone && !kreuzenDone) return;
    const today = new Date().toISOString().split("T")[0];
    const db = await getDb();
    const rows = await db.select<Record<string,unknown>[]>(
      "SELECT last_study_date, current_streak, longest_streak FROM streaks WHERE id = 1"
    );
    if (rows.length > 0) {
      const lastDate = rows[0].last_study_date as string | null;
      let newStreak = (rows[0].current_streak as number) ?? 0;
      const longest = (rows[0].longest_streak as number) ?? 0;
      if (lastDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];
        newStreak = lastDate === yesterdayStr ? newStreak + 1 : 1;
      }
      const newLongest = Math.max(longest, newStreak);
      await db.execute(
        "UPDATE streaks SET current_streak = ?, longest_streak = ?, last_study_date = ?, updated_at = datetime('now') WHERE id = 1",
        [newStreak, newLongest, today]
      );
      streak = newStreak;
    }
  }

  function formatPercent(correct: number, total: number): string {
    if (total === 0) return "\u2013";
    return Math.round((correct / total) * 100) + "%";
  }

  // --- AMBOSS link helpers ---

  import { toastInfo, toastWarning } from "$lib/stores/toastStore.svelte";

  async function openAmbossChapter(chapter: string) {
    if (!chapter) {
      toastWarning("Kein Kapitel verknüpft. Öffne AMBOSS manuell und suche das Thema.");
      return;
    }
    const url = `https://next.amboss.com/de/search?q=${encodeURIComponent(chapter)}`;
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
      toastInfo(`Öffne "${chapter}" in AMBOSS...`);
    } catch {
      window.open(url, "_blank");
      toastInfo(`Öffne "${chapter}" im Browser...`);
    }
  }

  async function openAmbossKreuzen() {
    const url = "https://next.amboss.com/de/questions";
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
      toastInfo("Öffne AMBOSS-Kreuzsitzung...");
    } catch {
      window.open(url, "_blank");
      toastInfo("Öffne AMBOSS-Kreuzsitzung im Browser...");
    }
  }

  async function openAmbossProbeklausur() {
    const url = "https://next.amboss.com/de/exams";
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
      toastInfo("Öffne AMBOSS-Probeklausuren...");
    } catch {
      window.open(url, "_blank");
      toastInfo("Öffne AMBOSS-Probeklausuren im Browser...");
    }
  }
</script>

<div class="space-y-6">
  {#if planStatus.type === "no-plan"}
    <!-- No plan generated yet -->
    <div class="rounded-xl bg-bg-secondary border border-border p-8 text-center">
      <div class="text-4xl mb-4">📋</div>
      <h2 class="text-xl font-bold text-text-primary mb-2">Kein Plan generiert</h2>
      <p class="text-sm text-text-secondary mb-4">
        Du hast noch keinen Lernplan erstellt. Gehe zum <span class="font-medium text-accent">Plan</span>-Tab, um deinen Studienplan zu generieren.
      </p>
    </div>

  {:else if planStatus.type === "not-started"}
    <!-- Plan exists but hasn't started yet -->
    <div class="rounded-xl bg-bg-secondary border border-border p-8 text-center">
      <div class="text-4xl mb-4">📅</div>
      <h2 class="text-xl font-bold text-text-primary mb-2">{planStatus.message}</h2>
      <p class="text-sm text-text-secondary mb-4">
        Dein Lernplan ist erstellt. Nutze die Zeit bis dahin, um dich vorzubereiten.
      </p>
    </div>

  {:else if planStatus.type === "free-day"}
    <!-- Free day (weekend, vacation, exam-prep) -->
    <div>
      <h2 class="text-2xl font-bold text-text-primary">Heute</h2>
      <p class="text-sm text-text-secondary">
        {formatDateLong(new Date())}
      </p>
    </div>

    {#if todayCalDay?.phase === "exam-prep"}
      <!-- Exam prep: Probeklausuren only -->
      <div class="rounded-xl bg-red-500/10 border border-red-500/20 p-6">
        <div class="text-center mb-4">
          <div class="text-3xl mb-2">📝</div>
          <h3 class="text-lg font-semibold text-text-primary">Probeklausuren-Phase</h3>
          <p class="text-sm text-text-secondary mt-1">
            Nur AMBOSS-Probeklausuren. Keine neuen Themen, keine Wiederholungen.
          </p>
        </div>

        <button
          onclick={openAmbossProbeklausur}
          class="w-full rounded-lg bg-red-500/15 border border-red-500/30 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/25 transition-colors cursor-pointer group"
        >
          <div class="flex items-center justify-center gap-2">
            📝 AMBOSS-Probeklausur starten
            <svg class="w-4 h-4 text-red-400/60 group-hover:text-red-400 transition-colors" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </div>
          <p class="text-xs text-red-400/60 mt-1">Öffnet AMBOSS-Examen im Browser</p>
        </button>
      </div>
    {:else}
      <div class="rounded-xl bg-bg-secondary border border-border p-6 text-center">
        <div class="text-3xl mb-3">
          {#if todayCalDay?.phase === "weekend"}
            ☀️
          {:else}
            🏖️
          {/if}
        </div>
        <h3 class="text-lg font-semibold text-text-primary mb-1">{planStatus.message}</h3>
        <p class="text-sm text-text-secondary">Kein neues AMBOSS-Thema heute. Vergiss nicht deine Anki-Karten!</p>
      </div>
    {/if}

    <!-- Anki & Streak on free days -->
    <div class="grid grid-cols-3 gap-4">
      <div class="rounded-xl bg-bg-secondary border border-border p-4 text-center">
        <div class="text-2xl font-bold text-text-primary">{ankiDue}</div>
        <div class="text-xs text-text-muted">Anki-Karten fällig</div>
      </div>
      <div class="rounded-xl bg-bg-secondary border border-border p-4 text-center">
        <div class="text-2xl font-bold text-text-primary">{streak}</div>
        <div class="text-xs text-text-muted">Tage Streak</div>
      </div>
      <div class="rounded-xl bg-bg-secondary border border-border p-4 text-center">
        <div class="text-2xl font-bold text-accent">{progressPercent}%</div>
        <div class="text-xs text-text-muted">Gesamtfortschritt</div>
      </div>
    </div>

  {:else}
    <!-- study-day: Normal study day with AMBOSS content -->

    <!-- Header -->
    <div>
      <h2 class="text-2xl font-bold text-text-primary">Heute</h2>
      <p class="text-sm text-text-secondary">
        Tag {dayNumber} von {totalDays} &middot;
        {formatDateLong(new Date())}
      </p>
    </div>

    <!-- Subject Hero -->
    {#if todayAmboss}
      <div class="rounded-xl bg-bg-secondary border border-border p-5">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2">
              <div class="text-xs font-medium uppercase tracking-wider text-accent">
                Heutiges Thema
              </div>
              <span class="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                AMBOSS Tag {todayAmboss.day_number}
              </span>
            </div>
            <h3 class="mt-1 text-xl font-semibold text-text-primary">{todayAmboss.subject}</h3>
            <p class="text-sm text-text-secondary">{todayAmboss.sub_topic}</p>
          </div>
          <div class="text-right">
            <div class="text-2xl font-bold text-accent">{progressPercent}%</div>
            <div class="text-xs text-text-muted">Gesamtfortschritt</div>
          </div>
        </div>

        {#if todayAmboss.chapters.length > 0}
          <div class="mt-4">
            <div class="text-xs font-medium text-text-muted mb-2">Kapitel:</div>
            <div class="flex flex-wrap gap-2">
              {#each todayAmboss.chapters as chapter}
                <button
                  onclick={() => openAmbossChapter(chapter)}
                  class="rounded-md bg-bg-primary/50 border border-border/50 px-2.5 py-1 text-xs text-text-secondary hover:text-accent hover:border-accent/40 transition-colors cursor-pointer"
                >
                  {chapter}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Split info -->
        {#if todayCalDay?.splitPart === 'reading'}
          <div class="mt-3">
            <span class="inline-block rounded-md bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
              Heute: Kapitel lesen
            </span>
          </div>
        {:else if todayCalDay?.splitPart === 'kreuzen'}
          <div class="mt-3">
            <span class="inline-block rounded-md bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
              Heute: Fragen kreuzen
            </span>
          </div>
        {:else if todayCalDay?.splitPart === 'both'}
          <div class="mt-3 flex gap-2">
            <span class="inline-block rounded-md bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
              Kapitel lesen
            </span>
            <span class="inline-block rounded-md bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
              Fragen kreuzen
            </span>
          </div>
        {/if}

        {#if todayCalDay?.retainTestScheduled}
          <div class="mt-2">
            <span class="inline-block rounded-md bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning">
              Retain-Test geplant
            </span>
          </div>
        {/if}
      </div>

      <!-- Task Cards -->
      <div class="grid grid-cols-2 gap-4">
        <!-- Reading Card -->
        <button
          onclick={() => openAmbossChapter(todayAmboss!.chapters[0] ?? todayAmboss!.subject)}
          class="rounded-xl bg-bg-secondary border border-border p-4 text-left transition-colors hover:border-accent/40 cursor-pointer group"
        >
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-medium text-text-primary flex items-center gap-1.5">
              Kapitel lesen
              <svg class="w-3.5 h-3.5 text-text-muted group-hover:text-accent transition-colors" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </h4>
            <label class="cursor-pointer" onclick={(e: MouseEvent) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={readingDone}
                onchange={toggleReading}
                class="h-5 w-5 rounded border-text-muted accent-accent"
              />
            </label>
          </div>
          <p class="mt-2 text-xs text-text-muted">
            {readingDone ? "Erledigt!" : "Klicken → AMBOSS-Kapitel öffnen"}
          </p>
        </button>

        <!-- Kreuzen Card -->
        <button
          onclick={openAmbossKreuzen}
          class="rounded-xl bg-bg-secondary border border-border p-4 text-left transition-colors hover:border-accent/40 cursor-pointer group"
        >
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-medium text-text-primary flex items-center gap-1.5">
              {todayAmboss.question_count} Fragen kreuzen
              <svg class="w-3.5 h-3.5 text-text-muted group-hover:text-accent transition-colors" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </h4>
            <label class="cursor-pointer" onclick={(e: MouseEvent) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={kreuzenDone}
                onchange={toggleKreuzen}
                class="h-5 w-5 rounded border-text-muted accent-accent"
              />
            </label>
          </div>
          {#if kreuzenTotal > 0}
            <p class="mt-2 text-xs text-text-secondary">
              {kreuzenCorrect}/{kreuzenTotal} richtig ({formatPercent(kreuzenCorrect, kreuzenTotal)})
            </p>
          {:else}
            <p class="mt-2 text-xs text-text-muted">
              {kreuzenDone ? "Erledigt!" : "Klicken → AMBOSS-Kreuzsitzung öffnen"}
            </p>
          {/if}
        </button>
      </div>
    {/if}

    <!-- Anki & Streak -->
    <div class="grid grid-cols-3 gap-4">
      <div class="rounded-xl bg-bg-secondary border border-border p-4 text-center">
        <div class="text-2xl font-bold text-text-primary">{ankiDue}</div>
        <div class="text-xs text-text-muted">Anki-Karten fällig</div>
      </div>
      <div class="rounded-xl bg-bg-secondary border border-border p-4 text-center">
        <div class="text-2xl font-bold text-text-primary">{streak}</div>
        <div class="text-xs text-text-muted">Tage Streak</div>
      </div>
      <div class="rounded-xl bg-bg-secondary border border-border p-4 text-center">
        <div class="text-2xl font-bold text-accent">{dayNumber}/{totalDays}</div>
        <div class="text-xs text-text-muted">Lerntage</div>
      </div>
    </div>

    <!-- Retain Test Prompt -->
    {#if todayCalDay?.retainTestScheduled}
      <div class="rounded-xl bg-accent/10 border border-accent/20 p-4">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="text-sm font-medium text-text-primary">Wissen testen?</h4>
            <p class="text-xs text-text-secondary">Starte einen Retain-Test zu deinen letzten Themen</p>
          </div>
          <button class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover">
            Test starten
          </button>
        </div>
      </div>
    {/if}
  {/if}
</div>
