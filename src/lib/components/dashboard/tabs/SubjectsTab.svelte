<script lang="ts">
  import { getCalendarDays, getAmbossDays, isPlanGenerated } from "$lib/stores/planStore.svelte";
  import { getMasteryMap, getMasteryLevel, getMasteryColor, loadMastery } from "$lib/stores/retainStore.svelte";
  import { getDb } from "$lib/api/db";

  let calendarDays = $derived(getCalendarDays());
  let ambossDays = $derived(getAmbossDays());
  let planGenerated = $derived(isPlanGenerated());
  let masteryMap = $derived(getMasteryMap());

  // Build subject summary from calendar/amboss days
  let subjectSummary = $derived.by(() => {
    const subjects: Record<string, {
      name: string;
      totalDays: number;
      completedDays: number;
      totalQuestions: number;
      mastery: number;
      color: string;
    }> = {};

    const colorMap: Record<string, string> = {
      "Pharmakologie": "bg-purple-500",
      "Innere Medizin": "bg-red-500",
      "Chirurgie": "bg-orange-500",
      "Neurologie": "bg-blue-500",
      "Pädiatrie": "bg-green-500",
      "Gynäkologie": "bg-pink-500",
      "Orthopädie/Unfallchirurgie": "bg-amber-500",
      "Psychiatrie": "bg-indigo-500",
      "Dermatologie": "bg-yellow-500",
      "HNO": "bg-teal-500",
      "Augenheilkunde": "bg-cyan-500",
      "Anästhesiologie": "bg-emerald-500",
      "Urologie": "bg-lime-500",
      "Radiologie": "bg-slate-500",
      "Rechtsmedizin": "bg-stone-500",
      "Notfallmedizin": "bg-rose-500",
      "Allgemeinmedizin": "bg-sky-500",
    };

    const todayStr = new Date().toISOString().split("T")[0];

    for (const amboss of ambossDays) {
      if (amboss.is_optional) continue;
      const name = amboss.subject;
      if (!subjects[name]) {
        subjects[name] = {
          name,
          totalDays: 0,
          completedDays: 0,
          totalQuestions: amboss.question_count,
          mastery: masteryMap[name]?.masteryScore ?? 0,
          color: colorMap[name] ?? "bg-gray-500",
        };
      } else {
        subjects[name].totalQuestions += amboss.question_count;
      }
      subjects[name].totalDays++;
    }

    // Count completed days from calendar
    for (const cal of calendarDays) {
      if (cal.ambossDay && cal.date <= todayStr) {
        const name = cal.ambossDay.subject;
        if (subjects[name]) {
          if (cal.splitPart === 'both' || cal.splitPart === 'kreuzen') {
            subjects[name].completedDays++;
          }
        }
      }
    }

    return Object.values(subjects).sort((a, b) => b.totalDays - a.totalDays);
  });

  $effect(() => {
    loadMastery();
  });

  function masteryLabel(score: number): string {
    const level = getMasteryLevel(score);
    const labels: Record<string, string> = {
      unsicher: "Unsicher",
      grundlagen: "Grundlagen",
      solide: "Solide",
      sicher: "Sicher",
    };
    return labels[level];
  }

  function masteryBgColor(score: number): string {
    const level = getMasteryLevel(score);
    const colors: Record<string, string> = {
      unsicher: "bg-mastery-unsicher/15 border-mastery-unsicher/30 text-mastery-unsicher",
      grundlagen: "bg-mastery-grundlagen/15 border-mastery-grundlagen/30 text-mastery-grundlagen",
      solide: "bg-mastery-solide/15 border-mastery-solide/30 text-mastery-solide",
      sicher: "bg-mastery-sicher/15 border-mastery-sicher/30 text-mastery-sicher",
    };
    return colors[level];
  }
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold text-text-primary">Fächer</h2>
    <p class="text-sm text-text-secondary">Fortschritt pro Fachgebiet</p>
  </div>

  {#if !planGenerated}
    <div class="rounded-xl bg-bg-secondary border border-border p-8 text-center">
      <div class="text-4xl mb-3">📚</div>
      <h3 class="text-lg font-semibold text-text-primary">Plan noch nicht generiert</h3>
      <p class="text-sm text-text-muted mt-2">
        Generiere zuerst deinen Lernplan, um den Fortschritt pro Fach zu sehen.
      </p>
    </div>
  {:else if subjectSummary.length === 0}
    <div class="rounded-xl bg-bg-secondary border border-border p-8 text-center">
      <div class="text-4xl mb-3">📋</div>
      <h3 class="text-lg font-semibold text-text-primary">Keine Fächer gefunden</h3>
      <p class="text-sm text-text-muted mt-2">
        Es wurden noch keine AMBOSS-Lerntage importiert.
      </p>
    </div>
  {:else}
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {#each subjectSummary as subject}
        {@const progressPercent = subject.totalDays > 0 ? Math.round((subject.completedDays / subject.totalDays) * 100) : 0}
        <div class="rounded-xl bg-bg-secondary border border-border p-4 transition-colors hover:border-accent/30">
          <div class="flex items-center gap-2 mb-3">
            <div class="h-2.5 w-2.5 shrink-0 rounded-full {subject.color}"></div>
            <h4 class="text-sm font-medium text-text-primary truncate">{subject.name}</h4>
          </div>

          <div class="space-y-2">
            <div class="flex items-end justify-between">
              <div class="space-y-0.5">
                <div class="text-xs text-text-muted">
                  {subject.completedDays}/{subject.totalDays} Lerntage
                </div>
                <div class="text-xs text-text-muted">
                  {subject.totalQuestions} Fragen
                </div>
              </div>
              <div class="text-lg font-bold text-text-secondary">{progressPercent}%</div>
            </div>

            <div class="h-1.5 overflow-hidden rounded-full bg-border">
              <div
                class="h-full rounded-full {subject.color} opacity-70 transition-all duration-500"
                style="width: {progressPercent}%"
              ></div>
            </div>

            <div class="pt-1">
              {#if subject.mastery > 0}
                <span class="inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-medium {masteryBgColor(subject.mastery)}">
                  {masteryLabel(subject.mastery)} ({Math.round(subject.mastery * 100)}%)
                </span>
              {:else}
                <span class="text-[10px] text-text-muted">Mastery: --</span>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
