<script lang="ts">
  import { getCalendarDays, getAmbossDays, isPlanGenerated } from "$lib/stores/planStore.svelte";
  import { getMasteryMap, getMasteryLevel, getMasteryColor, loadMastery } from "$lib/stores/retainStore.svelte";
  import { formatISODateShort } from "$lib/utils/dateUtils";
  import { getDb } from "$lib/api/db";

  let calendarDays = $derived(getCalendarDays());
  let ambossDays = $derived(getAmbossDays());
  let planGenerated = $derived(isPlanGenerated());
  let masteryMap = $derived(getMasteryMap());

  let expandedSubjects = $state<Set<string>>(new Set());

  function toggleExpand(name: string) {
    const next = new Set(expandedSubjects);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    expandedSubjects = next;
  }

  const colorMap: Record<string, string> = {
    "Pharmakologie": "bg-purple-500",
    "Innere Medizin": "bg-red-500",
    "Chirurgie": "bg-orange-500",
    "Neurologie": "bg-blue-500",
    "Pädiatrie": "bg-green-500",
    "Gynäkologie & Geburtshilfe": "bg-pink-500",
    "Orthopädie & Unfallchirurgie": "bg-amber-500",
    "Psychiatrie": "bg-indigo-500",
    "Dermatologie": "bg-yellow-500",
    "Hals-Nasen-Ohren-Heilkunde": "bg-teal-500",
    "Augenheilkunde": "bg-cyan-500",
    "Anästhesiologie": "bg-emerald-500",
    "Urologie": "bg-lime-500",
    "Radiologie": "bg-slate-500",
    "Rechtsmedizin": "bg-stone-500",
    "Notfallmedizin": "bg-rose-500",
    "Allgemeinmedizin": "bg-sky-500",
    "Klinische Chemie & Labormedizin": "bg-fuchsia-500",
    "Arbeitsmedizin & Hygiene": "bg-zinc-500",
    "Mikrobiologie": "bg-violet-500",
  };

  // Build a mapping from AMBOSS day_number -> calendar date(s)
  let dayNumberToCalendarDates = $derived.by(() => {
    const map: Record<number, string[]> = {};
    for (const cal of calendarDays) {
      if (cal.ambossDay) {
        const dn = cal.ambossDay.day_number;
        if (!map[dn]) map[dn] = [];
        map[dn].push(cal.date);
      }
    }
    return map;
  });

  // Build subject summary with actual calendar dates from the plan
  let subjectSummary = $derived.by(() => {
    const subjects: Record<string, {
      name: string;
      totalDays: number;
      completedDays: number;
      totalQuestions: number;
      mastery: number;
      color: string;
      dayNumbers: number[];
      firstCalendarDate: string;
      lastCalendarDate: string;
      subTopics: { subTopic: string; dayNumber: number; calendarDates: string[]; chapters: string[]; questionCount: number }[];
    }> = {};

    const todayStr = new Date().toISOString().split("T")[0];

    for (const amboss of ambossDays) {
      if (amboss.is_optional) continue;
      const name = amboss.subject;
      const calDates = dayNumberToCalendarDates[amboss.day_number] ?? [];

      if (!subjects[name]) {
        subjects[name] = {
          name,
          totalDays: 0,
          completedDays: 0,
          totalQuestions: 0,
          mastery: masteryMap[name]?.masteryScore ?? 0,
          color: colorMap[name] ?? "bg-gray-500",
          dayNumbers: [],
          firstCalendarDate: calDates[0] ?? "",
          lastCalendarDate: calDates[calDates.length - 1] ?? "",
          subTopics: [],
        };
      }
      subjects[name].totalQuestions += amboss.question_count;
      subjects[name].totalDays++;
      subjects[name].dayNumbers.push(amboss.day_number);

      for (const d of calDates) {
        if (!subjects[name].firstCalendarDate || d < subjects[name].firstCalendarDate) {
          subjects[name].firstCalendarDate = d;
        }
        if (!subjects[name].lastCalendarDate || d > subjects[name].lastCalendarDate) {
          subjects[name].lastCalendarDate = d;
        }
      }

      subjects[name].subTopics.push({
        subTopic: amboss.sub_topic || name,
        dayNumber: amboss.day_number,
        calendarDates: calDates,
        chapters: amboss.chapters,
        questionCount: amboss.question_count,
      });
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

    // Sort by first calendar date (actual plan order)
    return Object.values(subjects).sort((a, b) => {
      if (!a.firstCalendarDate) return 1;
      if (!b.firstCalendarDate) return -1;
      return a.firstCalendarDate.localeCompare(b.firstCalendarDate);
    });
  });

  $effect(() => {
    loadMastery();
  });

  function calendarDateRange(first: string, last: string): string {
    if (!first) return "";
    if (first === last) return formatISODateShort(first);
    return `${formatISODateShort(first)} – ${formatISODateShort(last)}`;
  }

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

  function ambossSearchUrl(chapterName: string): string {
    return `https://next.amboss.com/de/search?q=${encodeURIComponent(chapterName)}&v=overview`;
  }
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold text-text-primary">Fächer</h2>
    <p class="text-sm text-text-secondary">Fortschritt pro Fachgebiet mit Lernplan-Daten</p>
  </div>

  {#if !planGenerated}
    <div class="rounded-xl bg-bg-secondary border border-border p-8 text-center">
      <div class="text-4xl mb-3">&#128218;</div>
      <h3 class="text-lg font-semibold text-text-primary">Plan noch nicht generiert</h3>
      <p class="text-sm text-text-muted mt-2">
        Generiere zuerst deinen Lernplan unter dem <span class="font-medium text-accent">Plan</span>-Tab, um den Fortschritt pro Fach zu sehen.
      </p>
    </div>
  {:else if subjectSummary.length === 0}
    <div class="rounded-xl bg-bg-secondary border border-border p-8 text-center">
      <div class="text-4xl mb-3">&#128203;</div>
      <h3 class="text-lg font-semibold text-text-primary">Keine Fächer gefunden</h3>
      <p class="text-sm text-text-muted mt-2">
        Es wurden noch keine AMBOSS-Lerntage importiert.
      </p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each subjectSummary as subject}
        {@const progressPercent = subject.totalDays > 0 ? Math.round((subject.completedDays / subject.totalDays) * 100) : 0}
        {@const isExpanded = expandedSubjects.has(subject.name)}
        <div class="rounded-xl bg-bg-secondary border border-border transition-colors hover:border-accent/30">
          <button
            class="w-full p-4 text-left"
            onclick={() => toggleExpand(subject.name)}
          >
            <div class="flex items-center gap-2 mb-2">
              <div class="h-2.5 w-2.5 shrink-0 rounded-full {subject.color}"></div>
              <h4 class="text-sm font-medium text-text-primary truncate">{subject.name}</h4>
              <span class="ml-auto shrink-0 rounded-md bg-accent/10 border border-accent/20 px-2 py-0.5 text-[10px] font-medium text-accent">
                {calendarDateRange(subject.firstCalendarDate, subject.lastCalendarDate)}
              </span>
              <svg
                class="h-4 w-4 shrink-0 text-text-muted transition-transform {isExpanded ? 'rotate-180' : ''}"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            <div class="flex items-end justify-between">
              <div class="space-y-0.5">
                <div class="text-xs text-text-muted">
                  {subject.completedDays}/{subject.totalDays} Lerntage &middot; {subject.totalQuestions} Fragen
                </div>
              </div>
              <div class="text-lg font-bold text-text-secondary">{progressPercent}%</div>
            </div>

            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
              <div
                class="h-full rounded-full {subject.color} opacity-70 transition-all duration-500"
                style="width: {progressPercent}%"
              ></div>
            </div>

            <div class="mt-2">
              {#if subject.mastery > 0}
                <span class="inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-medium {masteryBgColor(subject.mastery)}">
                  {masteryLabel(subject.mastery)} ({Math.round(subject.mastery * 100)}%)
                </span>
              {:else}
                <span class="text-[10px] text-text-muted">Mastery: --</span>
              {/if}
            </div>
          </button>

          {#if isExpanded}
            <div class="border-t border-border px-4 pb-4 pt-3">
              <div class="space-y-2.5">
                {#each subject.subTopics as entry}
                  <div class="rounded-lg bg-bg-primary border border-border/50 px-3 py-2.5">
                    <div class="flex items-center justify-between mb-1.5">
                      <div class="flex items-center gap-2 min-w-0">
                        <span class="shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-mono font-medium text-accent">
                          {#if entry.calendarDates.length > 0}
                            {formatISODateShort(entry.calendarDates[0])}
                          {:else}
                            Tag {entry.dayNumber}
                          {/if}
                        </span>
                        <span class="text-xs font-medium text-text-secondary truncate">{entry.subTopic}</span>
                      </div>
                      <span class="shrink-0 text-[10px] text-text-muted">{entry.questionCount} Fragen</span>
                    </div>

                    {#if entry.chapters.length > 0}
                      <div class="flex flex-wrap gap-1.5 mt-1.5">
                        {#each entry.chapters as chapter}
                          <a
                            href={ambossSearchUrl(chapter)}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="rounded-md bg-bg-secondary border border-border/50 px-2 py-0.5 text-[11px] text-text-secondary hover:text-accent hover:border-accent/30 transition-colors cursor-pointer"
                          >
                            {chapter}
                          </a>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
