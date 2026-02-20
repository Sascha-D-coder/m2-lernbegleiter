<script lang="ts">
  import { getCalendarDays, getTotalStudyDays, getProgressPercent, isPlanGenerated } from "$lib/stores/planStore.svelte";
  import { getTestHistory, loadTestHistory, getMasteryMap, loadMastery, getMasteryLevel } from "$lib/stores/retainStore.svelte";
  import { getDb } from "$lib/api/db";
  import { daysUntil } from "$lib/utils/dateUtils";
  import { getSettings } from "$lib/stores/settingsStore.svelte";

  let recentActivity = $state<{date: string; subject: string; kreuzenCorrect: number; kreuzenTotal: number; studyHours: number}[]>([]);
  let totalKreuzenCorrect = $state(0);
  let totalKreuzenTotal = $state(0);
  let longestStreak = $state(0);
  let currentStreak = $state(0);
  let studyHoursTotal = $state(0);

  $effect(() => {
    loadStats();
    loadTestHistory();
    loadMastery();
  });

  async function loadStats() {
    try {
      const db = await getDb();

      // Load streak
      const streakRows = await db.select<Record<string, unknown>[]>(
        "SELECT * FROM streaks WHERE id = 1"
      );
      if (streakRows.length > 0) {
        currentStreak = (streakRows[0].current_streak as number) ?? 0;
        longestStreak = (streakRows[0].longest_streak as number) ?? 0;
      }

      // Load overall kreuzen stats
      const kreuzenRows = await db.select<Record<string, unknown>[]>(
        "SELECT SUM(kreuzen_correct) as correct, SUM(kreuzen_total) as total, SUM(study_hours) as hours FROM daily_progress"
      );
      if (kreuzenRows.length > 0) {
        totalKreuzenCorrect = (kreuzenRows[0].correct as number) ?? 0;
        totalKreuzenTotal = (kreuzenRows[0].total as number) ?? 0;
        studyHoursTotal = (kreuzenRows[0].hours as number) ?? 0;
      }

      // Load recent activity (last 7 entries)
      const activityRows = await db.select<Record<string, unknown>[]>(
        "SELECT date, subject, kreuzen_correct, kreuzen_total, study_hours FROM daily_progress ORDER BY date DESC LIMIT 7"
      );
      recentActivity = activityRows.map((row) => ({
        date: row.date as string,
        subject: (row.subject as string) ?? "---",
        kreuzenCorrect: (row.kreuzen_correct as number) ?? 0,
        kreuzenTotal: (row.kreuzen_total as number) ?? 0,
        studyHours: (row.study_hours as number) ?? 0,
      }));
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  }

  let settings = $derived(getSettings());
  let calendarDays = $derived(getCalendarDays());
  let planGenerated = $derived(isPlanGenerated());
  let progressPercent = $derived(getProgressPercent());
  let examDaysLeft = $derived(daysUntil(settings.examDate));
  let testHistory = $derived(getTestHistory());
  let masteryMap = $derived(getMasteryMap());

  let overallKreuzenPercent = $derived(
    totalKreuzenTotal > 0 ? Math.round((totalKreuzenCorrect / totalKreuzenTotal) * 100) : 0
  );

  let retainTestAvg = $derived.by(() => {
    const completed = testHistory.filter(t => t.scorePercent !== null);
    if (completed.length === 0) return 0;
    return Math.round(completed.reduce((sum, t) => sum + (t.scorePercent ?? 0), 0) / completed.length);
  });

  // Count subjects per mastery level
  let masteryCounts = $derived.by(() => {
    const counts = { unsicher: 0, grundlagen: 0, solide: 0, sicher: 0, ungetestet: 0 };
    const subjects = new Set<string>();

    // Gather unique subjects from mastery map
    for (const [key, entry] of Object.entries(masteryMap)) {
      if (entry.subTopic) continue; // Only count top-level subjects
      subjects.add(entry.subject);
      const level = getMasteryLevel(entry.masteryScore);
      counts[level]++;
    }

    return counts;
  });

  let recentTests = $derived(testHistory.slice(0, 10));

  function formatDate(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
    } catch {
      return dateStr;
    }
  }

  function formatDateLong(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
      return dateStr;
    }
  }
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold text-text-primary">Statistiken</h2>
    <p class="text-sm text-text-secondary">Lernfortschritt und Leistungsanalyse</p>
  </div>

  {#if !planGenerated}
    <div class="rounded-xl bg-bg-secondary border border-border p-8 text-center">
      <div class="text-4xl mb-3">📊</div>
      <h3 class="text-lg font-semibold text-text-primary">Plan noch nicht generiert</h3>
      <p class="text-sm text-text-muted mt-2">
        Generiere zuerst deinen Lernplan, um Statistiken zu sehen.
      </p>
    </div>
  {:else}
    <!-- Overview Cards -->
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <!-- Days until exam -->
      <div class="rounded-xl bg-bg-secondary border border-border p-4">
        <div class="text-xs text-text-muted mb-1">Tage bis Examen</div>
        <div class="text-2xl font-bold text-text-primary">{examDaysLeft}</div>
        <div class="text-[10px] text-text-muted mt-0.5">{settings.examDate}</div>
      </div>

      <!-- Progress -->
      <div class="rounded-xl bg-bg-secondary border border-border p-4">
        <div class="text-xs text-text-muted mb-1">Lernfortschritt</div>
        <div class="text-2xl font-bold text-accent">{progressPercent}%</div>
        <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
          <div class="h-full rounded-full bg-accent transition-all duration-500" style="width: {progressPercent}%"></div>
        </div>
      </div>

      <!-- Kreuzen Score -->
      <div class="rounded-xl bg-bg-secondary border border-border p-4">
        <div class="text-xs text-text-muted mb-1">Kreuzen-Score</div>
        <div class="text-2xl font-bold {overallKreuzenPercent >= 70 ? 'text-mastery-sicher' : overallKreuzenPercent >= 50 ? 'text-mastery-grundlagen' : 'text-text-primary'}">
          {overallKreuzenPercent > 0 ? `${overallKreuzenPercent}%` : '--'}
        </div>
        <div class="text-[10px] text-text-muted mt-0.5">
          {totalKreuzenCorrect}/{totalKreuzenTotal} richtig
        </div>
      </div>

      <!-- Streak -->
      <div class="rounded-xl bg-bg-secondary border border-border p-4">
        <div class="text-xs text-text-muted mb-1">Lernstreak</div>
        <div class="text-2xl font-bold text-text-primary">
          {currentStreak} <span class="text-sm font-normal text-text-muted">Tage</span>
        </div>
        <div class="text-[10px] text-text-muted mt-0.5">
          Längster: {longestStreak} Tage
        </div>
      </div>

      <!-- Study hours -->
      <div class="rounded-xl bg-bg-secondary border border-border p-4">
        <div class="text-xs text-text-muted mb-1">Lernstunden</div>
        <div class="text-2xl font-bold text-text-primary">
          {studyHoursTotal > 0 ? Math.round(studyHoursTotal * 10) / 10 : '--'}
        </div>
        <div class="text-[10px] text-text-muted mt-0.5">Stunden gesamt</div>
      </div>

      <!-- Retain Tests -->
      <div class="rounded-xl bg-bg-secondary border border-border p-4">
        <div class="text-xs text-text-muted mb-1">Retain-Tests</div>
        <div class="text-2xl font-bold text-text-primary">{testHistory.length}</div>
        <div class="text-[10px] text-text-muted mt-0.5">
          {retainTestAvg > 0 ? `Durchschnitt: ${retainTestAvg}%` : 'Noch keine Tests'}
        </div>
      </div>
    </div>

    <!-- Mastery Overview -->
    <div class="rounded-xl bg-bg-secondary border border-border p-4">
      <h3 class="text-sm font-semibold text-text-primary mb-3">Mastery-Verteilung</h3>
      <div class="grid grid-cols-4 gap-2">
        <div class="rounded-lg bg-mastery-unsicher/10 border border-mastery-unsicher/20 p-3 text-center">
          <div class="text-xl font-bold text-mastery-unsicher">{masteryCounts.unsicher}</div>
          <div class="text-[10px] font-medium text-mastery-unsicher mt-0.5">Unsicher</div>
          <div class="text-[9px] text-text-muted">0-30%</div>
        </div>
        <div class="rounded-lg bg-mastery-grundlagen/10 border border-mastery-grundlagen/20 p-3 text-center">
          <div class="text-xl font-bold text-mastery-grundlagen">{masteryCounts.grundlagen}</div>
          <div class="text-[10px] font-medium text-mastery-grundlagen mt-0.5">Grundlagen</div>
          <div class="text-[9px] text-text-muted">30-60%</div>
        </div>
        <div class="rounded-lg bg-mastery-solide/10 border border-mastery-solide/20 p-3 text-center">
          <div class="text-xl font-bold text-mastery-solide">{masteryCounts.solide}</div>
          <div class="text-[10px] font-medium text-mastery-solide mt-0.5">Solide</div>
          <div class="text-[9px] text-text-muted">60-80%</div>
        </div>
        <div class="rounded-lg bg-mastery-sicher/10 border border-mastery-sicher/20 p-3 text-center">
          <div class="text-xl font-bold text-mastery-sicher">{masteryCounts.sicher}</div>
          <div class="text-[10px] font-medium text-mastery-sicher mt-0.5">Sicher</div>
          <div class="text-[9px] text-text-muted">80-100%</div>
        </div>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="rounded-xl bg-bg-secondary border border-border p-4">
      <h3 class="text-sm font-semibold text-text-primary mb-3">Letzte Aktivität</h3>
      {#if recentActivity.length === 0}
        <p class="text-sm text-text-muted text-center py-4">Noch keine Lernaktivität erfasst</p>
      {:else}
        <div class="space-y-2">
          {#each recentActivity as entry}
            {@const entryPercent = entry.kreuzenTotal > 0 ? Math.round((entry.kreuzenCorrect / entry.kreuzenTotal) * 100) : null}
            <div class="flex items-center justify-between rounded-lg bg-bg-primary/50 border border-border/50 px-3 py-2">
              <div class="flex items-center gap-3 min-w-0">
                <div class="text-xs font-mono text-text-muted shrink-0">{formatDate(entry.date)}</div>
                <div class="text-sm text-text-secondary truncate">{entry.subject}</div>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                {#if entryPercent !== null}
                  <span class="text-xs font-medium {entryPercent >= 70 ? 'text-mastery-sicher' : entryPercent >= 50 ? 'text-mastery-grundlagen' : 'text-mastery-unsicher'}">
                    {entryPercent}% ({entry.kreuzenCorrect}/{entry.kreuzenTotal})
                  </span>
                {:else}
                  <span class="text-xs text-text-muted">--</span>
                {/if}
                {#if entry.studyHours > 0}
                  <span class="text-[10px] text-text-muted">{Math.round(entry.studyHours * 10) / 10}h</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Retain Test History -->
    <div class="rounded-xl bg-bg-secondary border border-border p-4">
      <h3 class="text-sm font-semibold text-text-primary mb-3">Retain-Test Verlauf</h3>
      {#if recentTests.length === 0}
        <p class="text-sm text-text-muted text-center py-4">Noch keine Retain-Tests absolviert</p>
      {:else}
        <div class="space-y-2">
          {#each recentTests as test}
            <div class="flex items-center justify-between rounded-lg bg-bg-primary/50 border border-border/50 px-3 py-2">
              <div class="flex items-center gap-3 min-w-0">
                <div class="text-xs font-mono text-text-muted shrink-0">{formatDateLong(test.startedAt)}</div>
                <div class="text-sm text-text-secondary truncate">
                  {test.subject ?? test.scope}
                </div>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                {#if test.scorePercent !== null}
                  <span class="text-xs font-medium {test.scorePercent >= 70 ? 'text-mastery-sicher' : test.scorePercent >= 50 ? 'text-mastery-grundlagen' : 'text-mastery-unsicher'}">
                    {Math.round(test.scorePercent)}%
                  </span>
                {:else}
                  <span class="text-xs text-text-muted">offen</span>
                {/if}
                <span class="rounded-md bg-bg-secondary border border-border px-1.5 py-0.5 text-[10px] text-text-muted capitalize">
                  {test.difficulty}
                </span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
