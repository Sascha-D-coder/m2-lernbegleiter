<script lang="ts">
  import { getTodayCalendarDay, getTodayAmbossDay, getProgressPercent, getCurrentDayNumber, getTotalStudyDays, getCalendarDays } from "$lib/stores/planStore.svelte";
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
</script>

<div class="space-y-6">
  {#if !todayAmboss}
    <!-- No plan generated yet -->
    <div class="rounded-xl bg-bg-secondary border border-border p-8 text-center">
      <div class="text-4xl mb-4">📋</div>
      <h2 class="text-xl font-bold text-text-primary mb-2">Kein Plan generiert</h2>
      <p class="text-sm text-text-secondary mb-4">
        Du hast noch keinen Lernplan erstellt. Gehe zum <span class="font-medium text-accent">Plan</span>-Tab, um deinen Studienplan zu generieren.
      </p>
    </div>
  {:else}
    <!-- Header -->
    <div>
      <h2 class="text-2xl font-bold text-text-primary">Heute</h2>
      <p class="text-sm text-text-secondary">
        Tag {dayNumber} von {totalDays} &middot;
        {formatDateLong(new Date())}
      </p>
    </div>

    <!-- Subject Hero -->
    <div class="rounded-xl bg-bg-secondary border border-border p-5">
      <div class="flex items-start justify-between">
        <div>
          <div class="text-xs font-medium uppercase tracking-wider text-accent">
            Heutiges Thema
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
              <span class="rounded-md bg-white/5 px-2.5 py-1 text-xs text-text-secondary">
                {chapter}
              </span>
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
      <div class="rounded-xl bg-bg-secondary border border-border p-4">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-medium text-text-primary">Kapitel lesen</h4>
          <label class="cursor-pointer">
            <input
              type="checkbox"
              checked={readingDone}
              onchange={toggleReading}
              class="h-5 w-5 rounded border-text-muted accent-accent"
            />
          </label>
        </div>
        <p class="mt-2 text-xs text-text-muted">
          {readingDone ? "Erledigt!" : "AMBOSS-Kapitel durcharbeiten"}
        </p>
      </div>

      <!-- Kreuzen Card -->
      <div class="rounded-xl bg-bg-secondary border border-border p-4">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-medium text-text-primary">{todayAmboss.question_count} Fragen kreuzen</h4>
          <label class="cursor-pointer">
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
            {kreuzenDone ? "Erledigt!" : "AMBOSS-Kreuzsitzung starten"}
          </p>
        {/if}
      </div>
    </div>

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
