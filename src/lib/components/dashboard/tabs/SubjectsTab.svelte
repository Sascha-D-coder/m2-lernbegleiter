<script lang="ts">
  import { getCalendarDays, getAmbossDays, isPlanGenerated } from "$lib/stores/planStore.svelte";
  import { getMasteryMap, getMasteryLevel, loadMastery } from "$lib/stores/retainStore.svelte";
  import { getProgressMap } from "$lib/stores/progressStore.svelte";
  import { toastInfo, toastWarning } from "$lib/stores/toastStore.svelte";

  let calendarDays = $derived(getCalendarDays());
  let ambossDays = $derived(getAmbossDays());
  let planGenerated = $derived(isPlanGenerated());
  let masteryMap = $derived(getMasteryMap());
  let progressMap = $derived(getProgressMap());

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
    "Innere Medizin": "bg-red-500",
    "Chirurgie": "bg-orange-500",
    "Anästhesie": "bg-emerald-500",
    "Augenheilkunde": "bg-cyan-500",
    "Dermatologie": "bg-yellow-500",
    "Gynäkologie": "bg-pink-500",
    "HNO": "bg-teal-500",
    "Orthopädie": "bg-amber-500",
    "Neurologie": "bg-blue-500",
    "Psychiatrie": "bg-indigo-500",
    "Pädiatrie": "bg-green-500",
    "Radiologie": "bg-slate-500",
    "Intensiv- und Notfallmedizin": "bg-rose-500",
    "Urologie": "bg-lime-500",
    "Pharmakologie": "bg-purple-500",
    "Infektiologie und Hygiene": "bg-violet-500",
    "Rechtsmedizin": "bg-stone-500",
    "Arbeits- und Umweltmedizin": "bg-zinc-500",
    "Humangenetik": "bg-sky-500",
    "Pathologie": "bg-fuchsia-500",
    "Epidemiologie": "bg-teal-600",
    "Sozialmedizin & Alternative Heilverfahren und Rehabilitation": "bg-zinc-600",
  };

  // Build subject summary
  let subjectSummary = $derived.by(() => {
    const subjects: Record<string, {
      name: string;
      totalDays: number;
      completedDays: number;
      totalQuestions: number;
      mastery: number;
      color: string;
      dayNumbers: number[];
      subTopics: {
        subTopic: string;
        dayNumber: number;
        chapters: string[];
        chapterUrls: Record<string, string>;
        ambossUrl: string;
        questionCount: number;
        estimatedHours: number;
      }[];
    }> = {};

    const todayStr = new Date().toISOString().split("T")[0];

    for (const amboss of ambossDays) {
      if (amboss.is_optional) continue;
      const name = amboss.subject;

      if (!subjects[name]) {
        let color = colorMap[name] ?? "bg-gray-500";
        if (name.startsWith("Wiederholung")) color = "bg-gray-500";
        if (name.startsWith("Generalprobe")) color = "bg-red-600";
        subjects[name] = {
          name,
          totalDays: 0,
          completedDays: 0,
          totalQuestions: 0,
          mastery: masteryMap[name]?.masteryScore ?? 0,
          color,
          dayNumbers: [],
          subTopics: [],
        };
      }
      subjects[name].totalQuestions += amboss.question_count;
      subjects[name].totalDays++;
      subjects[name].dayNumbers.push(amboss.day_number);

      subjects[name].subTopics.push({
        subTopic: amboss.sub_topic || name,
        dayNumber: amboss.day_number,
        chapters: amboss.chapters,
        chapterUrls: amboss.chapter_urls ?? {},
        ambossUrl: amboss.amboss_url ?? "",
        questionCount: amboss.question_count,
        estimatedHours: amboss.estimated_hours,
      });
    }

    // Count completed days from actual progress data
    for (const cal of calendarDays) {
      if (cal.ambossDay) {
        const name = cal.ambossDay.subject;
        if (subjects[name]) {
          const progress = progressMap.get(cal.date);
          if (progress && progress.readingCompleted && progress.kreuzenCompleted) {
            subjects[name].completedDays++;
          }
        }
      }
    }

    // Sort by first day_number (plan order)
    return Object.values(subjects).sort((a, b) => {
      return (a.dayNumbers[0] ?? 999) - (b.dayNumbers[0] ?? 999);
    });
  });

  $effect(() => {
    loadMastery();
  });

  function dayRange(dayNumbers: number[]): string {
    if (dayNumbers.length === 0) return "";
    if (dayNumbers.length === 1) return `Tag ${dayNumbers[0]}`;
    return `Tag ${dayNumbers[0]}–${dayNumbers[dayNumbers.length - 1]}`;
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

  async function openUrl(url: string, label: string) {
    try {
      const { openUrl: open } = await import("@tauri-apps/plugin-opener");
      await open(url);
      toastInfo(`Öffne ${label} in AMBOSS...`);
    } catch {
      window.open(url, "_blank");
    }
  }

  function openChapter(chapter: string, chapterUrls: Record<string, string>) {
    const directUrl = chapterUrls[chapter];
    if (directUrl) {
      openUrl(directUrl, `"${chapter}"`);
    } else {
      openUrl(`https://next.amboss.com/de/search?q=${encodeURIComponent(chapter)}`, `"${chapter}"`);
    }
  }

  function openDayUrl(ambossUrl: string, dayNumber: number) {
    if (ambossUrl) {
      openUrl(ambossUrl, `Tag ${dayNumber}`);
    }
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
              <span class="ml-auto shrink-0 rounded-md bg-accent/10 border border-accent/20 px-2 py-0.5 text-[10px] font-mono font-medium text-accent">
                {dayRange(subject.dayNumbers)}
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
                        <button
                          onclick={() => openDayUrl(entry.ambossUrl, entry.dayNumber)}
                          class="shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-mono font-medium text-accent hover:bg-accent/20 transition-colors cursor-pointer"
                        >
                          Tag {entry.dayNumber}
                        </button>
                        <span class="text-xs font-medium text-text-secondary truncate">{entry.subTopic}</span>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        <span class="text-[10px] text-text-muted">{entry.questionCount} Fragen</span>
                        <span class="text-[10px] text-text-muted">&middot; ~{entry.estimatedHours}h</span>
                      </div>
                    </div>

                    {#if entry.chapters.length > 0}
                      <div class="flex flex-wrap gap-1.5 mt-1.5">
                        {#each entry.chapters as chapter}
                          <button
                            onclick={() => openChapter(chapter, entry.chapterUrls)}
                            class="rounded-md bg-bg-secondary border border-border/50 px-2 py-0.5 text-[11px] text-text-secondary hover:text-accent hover:border-accent/30 transition-colors cursor-pointer"
                          >
                            {chapter}
                          </button>
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
