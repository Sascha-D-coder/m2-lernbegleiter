<script lang="ts">
  import {
    getCurrentTest,
    getCurrentQuestions,
    getCurrentQuestionIndex,
    getTestHistory,
    getMasteryMap,
    getMasteryLevel,
    getPerQuestionResults,
    startTest,
    answerQuestion,
    nextQuestion,
    finishTest,
    resetTest,
    loadTestHistory,
    loadMastery,
    loadCachedQuestions,
  } from "$lib/stores/retainStore.svelte";
  import { getSettings } from "$lib/stores/settingsStore.svelte";
  import { getCalendarDays, getAmbossDays } from "$lib/stores/planStore.svelte";
  import type { RetainTestConfig, LLMConfig } from "$lib/api/llm";

  // ---------------------------------------------------------------------------
  // Reactive store state
  // ---------------------------------------------------------------------------

  let test = $derived(getCurrentTest());
  let questions = $derived(getCurrentQuestions());
  let qIndex = $derived(getCurrentQuestionIndex());
  let testHistory = $derived(getTestHistory());
  let masteryMap = $derived(getMasteryMap());
  let perQuestionResults = $derived(getPerQuestionResults());

  // ---------------------------------------------------------------------------
  // Local config form state
  // ---------------------------------------------------------------------------

  let scope = $state<"cross-topic" | "single-subject">("cross-topic");
  let selectedSubject = $state("");
  let difficulty = $state<"mixed" | "basis" | "anwendung" | "transfer">("mixed");
  let questionCount = $state(10);
  let generating = $state(false);
  let error = $state("");

  // Test runner state
  let selectedAnswer = $state<string | null>(null);
  let showFeedback = $state(false);
  let elapsedSeconds = $state(0);
  let timerInterval = $state<ReturnType<typeof setInterval> | null>(null);

  // Results state
  let expandedQuestions = $state<Set<number>>(new Set());

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  let currentQuestion = $derived(
    questions.length > 0 && qIndex < questions.length ? questions[qIndex] : null
  );

  let isLastQuestion = $derived(qIndex >= questions.length - 1);

  let currentResult = $derived(
    perQuestionResults.length > qIndex ? perQuestionResults[qIndex] : null
  );

  // Get unique subjects from AMBOSS plan
  let ambossDays = $derived(getAmbossDays());
  let calendarDays = $derived(getCalendarDays());

  let subjectList = $derived(() => {
    const subjects = new Set<string>();
    for (const day of ambossDays) {
      if (day.subject) subjects.add(day.subject);
    }
    return Array.from(subjects).sort();
  });

  // Sub-topics for selected subject
  let subTopicsForSubject = $derived(() => {
    if (!selectedSubject) return [];
    const topics = new Set<string>();
    for (const day of ambossDays) {
      if (day.subject === selectedSubject && day.sub_topic) {
        topics.add(day.sub_topic);
      }
    }
    return Array.from(topics).sort();
  });

  // Recent subjects from the last 14 days of calendarDays
  let recentTopics = $derived(() => {
    const today = new Date();
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const cutoff = twoWeeksAgo.toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];

    const subjects = new Set<string>();
    for (const day of calendarDays) {
      if (day.date >= cutoff && day.date <= todayStr && day.ambossDay) {
        subjects.add(day.ambossDay.subject);
        if (day.ambossDay.sub_topic) {
          subjects.add(day.ambossDay.sub_topic);
        }
      }
    }
    return Array.from(subjects);
  });

  // Topics for the test config
  let configTopics = $derived(
    scope === "cross-topic" ? recentTopics() : subTopicsForSubject()
  );

  // Mastery overview counts
  let masteryCounts = $derived(() => {
    const counts = { unsicher: 0, grundlagen: 0, solide: 0, sicher: 0 };
    for (const entry of Object.values(masteryMap)) {
      const level = getMasteryLevel(entry.masteryScore);
      counts[level]++;
    }
    return counts;
  });

  // Recent 5 tests
  let recentTests = $derived(testHistory.slice(0, 5));

  // View determination
  let view = $derived<"config" | "runner" | "results">(
    test === null
      ? "config"
      : test.completedAt === null
        ? "runner"
        : "results"
  );

  // ---------------------------------------------------------------------------
  // Timer effect for test runner
  // ---------------------------------------------------------------------------

  $effect(() => {
    if (view === "runner" && test) {
      const startTime = new Date(test.startedAt).getTime();
      elapsedSeconds = Math.round((Date.now() - startTime) / 1000);

      const interval = setInterval(() => {
        elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
      }, 1000);
      timerInterval = interval;

      return () => {
        clearInterval(interval);
        timerInterval = null;
      };
    }
  });

  // Load history and mastery on mount
  $effect(() => {
    loadTestHistory();
    loadMastery();
  });

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async function handleStartTest() {
    error = "";
    generating = true;

    try {
      const settings = getSettings();
      const llmConfig: LLMConfig = {
        provider: settings.llmProvider as "claude" | "ollama",
        apiKey: settings.llmApiKey,
        model: settings.llmModel,
      };

      const topics = configTopics;
      const config: RetainTestConfig = {
        scope,
        subject: scope === "single-subject" ? selectedSubject : undefined,
        topics: topics.length > 0 ? topics : ["Allgemeinmedizin"],
        difficulty,
        questionCount,
      };

      try {
        await startTest(config, llmConfig);
      } catch (llmError) {
        console.warn("LLM generation failed, trying cache:", llmError);
        // Try cached questions as fallback
        const cached = await loadCachedQuestions(
          scope === "single-subject" ? selectedSubject : null,
          difficulty,
          questionCount
        );
        if (cached.length === 0) {
          throw new Error(
            "Fragengenerierung fehlgeschlagen und keine gecachten Fragen verfügbar. Bitte LLM-Einstellungen prüfen."
          );
        }
        // If we got cached questions, the startTest already created a test session that failed.
        // We need to retry with the cached questions approach - for now re-throw
        throw llmError;
      }

      selectedAnswer = null;
      showFeedback = false;
    } catch (e) {
      error = e instanceof Error ? e.message : "Unbekannter Fehler";
    } finally {
      generating = false;
    }
  }

  async function handleAnswer() {
    if (!selectedAnswer || showFeedback) return;
    await answerQuestion(selectedAnswer);
    showFeedback = true;
  }

  async function handleNextQuestion() {
    showFeedback = false;
    selectedAnswer = null;

    if (isLastQuestion) {
      await finishTest();
    } else {
      nextQuestion();
    }
  }

  function handleReset() {
    resetTest();
    selectedAnswer = null;
    showFeedback = false;
    elapsedSeconds = 0;
    expandedQuestions = new Set();
  }

  function toggleExpandQuestion(idx: number) {
    const next = new Set(expandedQuestions);
    if (next.has(idx)) {
      next.delete(idx);
    } else {
      next.add(idx);
    }
    expandedQuestions = next;
  }

  // ---------------------------------------------------------------------------
  // Formatting helpers
  // ---------------------------------------------------------------------------

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  function formatDate(isoStr: string): string {
    const d = new Date(isoStr);
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function difficultyLabel(d: string): string {
    const labels: Record<string, string> = {
      mixed: "Gemischt",
      basis: "Basis",
      anwendung: "Anwendung",
      transfer: "Transfer",
    };
    return labels[d] ?? d;
  }

  function scopeLabel(s: string): string {
    return s === "cross-topic" ? "Themenübergreifend" : "Fachspezifisch";
  }

  function scoreColor(percent: number): string {
    if (percent >= 80) return "text-mastery-sicher";
    if (percent >= 60) return "text-mastery-solide";
    if (percent >= 30) return "text-mastery-grundlagen";
    return "text-mastery-unsicher";
  }
</script>

<div class="space-y-6">
  {#if view === "config"}
    <!-- ================================================================== -->
    <!-- VIEW 1: TEST CONFIGURATION                                         -->
    <!-- ================================================================== -->

    <div>
      <h2 class="text-2xl font-bold text-text-primary">Retain-Test</h2>
      <p class="text-sm text-text-secondary">IMPP-realistische Wissenstests auf 3 Niveaus</p>
    </div>

    <!-- Config Form -->
    <div class="rounded-xl bg-bg-secondary border border-border p-5">
      <h3 class="text-base font-semibold text-text-primary mb-4">Neuen Test konfigurieren</h3>

      <div class="grid grid-cols-2 gap-4">
        <!-- Scope -->
        <div>
          <label for="scope" class="text-xs font-medium text-text-muted mb-1.5 block">Umfang</label>
          <select
            id="scope"
            bind:value={scope}
            class="w-full rounded-lg bg-white/5 border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="cross-topic">Themenübergreifend (letzte 2 Wochen)</option>
            <option value="single-subject">Fachspezifisch</option>
          </select>
        </div>

        <!-- Subject (conditional) -->
        {#if scope === "single-subject"}
          <div>
            <label for="subject" class="text-xs font-medium text-text-muted mb-1.5 block">Fachgebiet</label>
            <select
              id="subject"
              bind:value={selectedSubject}
              class="w-full rounded-lg bg-white/5 border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">Bitte wählen...</option>
              {#each subjectList() as subject}
                <option value={subject}>{subject}</option>
              {/each}
            </select>
          </div>
        {/if}

        <!-- Difficulty -->
        <div>
          <label for="difficulty" class="text-xs font-medium text-text-muted mb-1.5 block">Schwierigkeit</label>
          <select
            id="difficulty"
            bind:value={difficulty}
            class="w-full rounded-lg bg-white/5 border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="mixed">Gemischt (IMPP-realistisch)</option>
            <option value="basis">Basis (Fakten)</option>
            <option value="anwendung">Anwendung (Klinische Szenarien)</option>
            <option value="transfer">Transfer (Fächerübergreifend)</option>
          </select>
        </div>

        <!-- Question Count -->
        <div>
          <label for="count" class="text-xs font-medium text-text-muted mb-1.5 block">Fragenanzahl</label>
          <select
            id="count"
            bind:value={questionCount}
            class="w-full rounded-lg bg-white/5 border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value={5}>5 Fragen</option>
            <option value={10}>10 Fragen</option>
            <option value={20}>20 Fragen</option>
          </select>
        </div>
      </div>

      <!-- Topics Preview -->
      {#if configTopics.length > 0}
        <div class="mt-4">
          <div class="text-xs font-medium text-text-muted mb-2">
            {scope === "cross-topic" ? "Themen (letzte 14 Tage)" : "Unterthemen"}
          </div>
          <div class="flex flex-wrap gap-1.5">
            {#each configTopics as topic}
              <span class="rounded-md bg-accent/10 border border-accent/20 px-2 py-0.5 text-xs text-accent">
                {topic}
              </span>
            {/each}
          </div>
        </div>
      {:else}
        <div class="mt-4">
          <p class="text-xs text-text-muted italic">
            {scope === "cross-topic"
              ? "Keine Themen in den letzten 14 Tagen gefunden. Es werden allgemeine Fragen generiert."
              : "Bitte Fachgebiet wählen."}
          </p>
        </div>
      {/if}

      <!-- Error Message -->
      {#if error}
        <div class="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
          <p class="text-sm text-red-400">{error}</p>
        </div>
      {/if}

      <!-- Start Button -->
      <div class="mt-5">
        <button
          onclick={handleStartTest}
          disabled={generating || (scope === "single-subject" && !selectedSubject)}
          class="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if generating}
            <span class="inline-flex items-center gap-2">
              <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Fragen werden generiert...
            </span>
          {:else}
            Test starten
          {/if}
        </button>
      </div>
    </div>

    <!-- Mastery Overview -->
    <div class="rounded-xl bg-bg-secondary border border-border p-5">
      <h3 class="text-base font-semibold text-text-primary mb-3">Mastery-Übersicht</h3>
      <div class="grid grid-cols-4 gap-2">
        <div class="rounded-lg bg-mastery-unsicher/10 border border-mastery-unsicher/20 p-3 text-center">
          <div class="text-2xl font-bold text-mastery-unsicher">{masteryCounts().unsicher}</div>
          <div class="text-xs font-medium text-mastery-unsicher mt-1">Unsicher</div>
          <div class="text-[10px] text-text-muted">0-30%</div>
        </div>
        <div class="rounded-lg bg-mastery-grundlagen/10 border border-mastery-grundlagen/20 p-3 text-center">
          <div class="text-2xl font-bold text-mastery-grundlagen">{masteryCounts().grundlagen}</div>
          <div class="text-xs font-medium text-mastery-grundlagen mt-1">Grundlagen</div>
          <div class="text-[10px] text-text-muted">30-60%</div>
        </div>
        <div class="rounded-lg bg-mastery-solide/10 border border-mastery-solide/20 p-3 text-center">
          <div class="text-2xl font-bold text-mastery-solide">{masteryCounts().solide}</div>
          <div class="text-xs font-medium text-mastery-solide mt-1">Solide</div>
          <div class="text-[10px] text-text-muted">60-80%</div>
        </div>
        <div class="rounded-lg bg-mastery-sicher/10 border border-mastery-sicher/20 p-3 text-center">
          <div class="text-2xl font-bold text-mastery-sicher">{masteryCounts().sicher}</div>
          <div class="text-xs font-medium text-mastery-sicher mt-1">Sicher</div>
          <div class="text-[10px] text-text-muted">80-100%</div>
        </div>
      </div>
    </div>

    <!-- Recent Tests -->
    {#if recentTests.length > 0}
      <div class="rounded-xl bg-bg-secondary border border-border p-5">
        <h3 class="text-base font-semibold text-text-primary mb-3">Letzte Tests</h3>
        <div class="space-y-2">
          {#each recentTests as t}
            <div class="flex items-center justify-between rounded-lg bg-white/[0.03] border border-border/50 px-4 py-3">
              <div class="flex items-center gap-3">
                <div class="text-xs text-text-muted min-w-[70px]">{formatDate(t.startedAt)}</div>
                <div class="text-sm text-text-primary">{scopeLabel(t.scope)}</div>
                {#if t.subject}
                  <span class="text-xs text-text-secondary">({t.subject})</span>
                {/if}
              </div>
              <div class="flex items-center gap-3">
                <span class="rounded-md bg-white/5 px-2 py-0.5 text-xs text-text-muted">
                  {difficultyLabel(t.difficulty)}
                </span>
                {#if t.scorePercent !== null}
                  <span class="text-sm font-semibold {scoreColor(t.scorePercent)}">
                    {t.scorePercent}%
                  </span>
                {:else}
                  <span class="text-xs text-text-muted">--</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

  {:else if view === "runner"}
    <!-- ================================================================== -->
    <!-- VIEW 2: TEST RUNNER                                                -->
    <!-- ================================================================== -->

    {#if currentQuestion}
      <!-- Header with progress -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-text-primary">
            Frage {qIndex + 1} von {questions.length}
          </h2>
          <p class="text-xs text-text-secondary">
            {test?.subject ? test.subject : scopeLabel(test?.scope ?? "")}
            &middot; {difficultyLabel(currentQuestion.difficulty)}
          </p>
        </div>
        <div class="text-right">
          <div class="text-lg font-mono font-semibold text-accent">{formatTime(elapsedSeconds)}</div>
          <div class="text-[10px] text-text-muted uppercase tracking-wider">Laufzeit</div>
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="w-full rounded-full bg-white/5 h-1.5">
        <div
          class="rounded-full bg-accent h-1.5 transition-all duration-300"
          style="width: {((qIndex + (showFeedback ? 1 : 0)) / questions.length) * 100}%"
        ></div>
      </div>

      <!-- Question Stem -->
      <div class="rounded-xl bg-bg-secondary border border-border p-5">
        <p class="text-sm leading-relaxed text-text-primary whitespace-pre-wrap">{currentQuestion.stem}</p>
      </div>

      <!-- Answer Options -->
      <div class="space-y-2">
        {#each currentQuestion.options as option}
          {@const isSelected = selectedAnswer === option.label}
          {@const isCorrect = option.label === currentQuestion.correctAnswer}
          {@const wasChosen = showFeedback && currentResult?.answer === option.label}
          {@const bgClass = showFeedback
            ? isCorrect
              ? "bg-green-500/10 border-green-500/30"
              : wasChosen && !currentResult?.correct
                ? "bg-red-500/10 border-red-500/30"
                : "bg-white/[0.02] border-border/50"
            : isSelected
              ? "bg-accent/10 border-accent/40"
              : "bg-white/[0.02] border-border/50 hover:bg-white/[0.05]"}

          <button
            onclick={() => {
              if (!showFeedback) selectedAnswer = option.label;
            }}
            disabled={showFeedback}
            class="w-full text-left rounded-lg border px-4 py-3 transition-all {bgClass} disabled:cursor-default"
          >
            <div class="flex items-start gap-3">
              <span class="flex-shrink-0 mt-0.5 flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold {
                showFeedback && isCorrect
                  ? 'bg-green-500 text-white'
                  : showFeedback && wasChosen && !currentResult?.correct
                    ? 'bg-red-500 text-white'
                    : isSelected && !showFeedback
                      ? 'bg-accent text-white'
                      : 'bg-white/10 text-text-muted'
              }">
                {option.label}
              </span>
              <span class="text-sm text-text-primary leading-relaxed">{option.text}</span>
            </div>

            {#if showFeedback && isCorrect}
              <div class="mt-1 ml-9">
                <span class="text-xs font-medium text-green-400">Richtige Antwort</span>
              </div>
            {/if}
            {#if showFeedback && wasChosen && !currentResult?.correct}
              <div class="mt-1 ml-9">
                <span class="text-xs font-medium text-red-400">Deine Antwort</span>
              </div>
            {/if}
          </button>
        {/each}
      </div>

      <!-- Feedback / Explanation -->
      {#if showFeedback && currentResult}
        <div class="rounded-xl border px-5 py-4 {currentResult.correct ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}">
          <div class="flex items-center gap-2 mb-2">
            {#if currentResult.correct}
              <svg class="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-sm font-semibold text-green-400">Richtig!</span>
            {:else}
              <svg class="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span class="text-sm font-semibold text-red-400">Leider falsch</span>
            {/if}
          </div>
          <p class="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{currentQuestion.explanation}</p>
        </div>
      {/if}

      <!-- Action Buttons -->
      <div class="flex justify-end gap-3">
        {#if !showFeedback}
          <button
            onclick={handleAnswer}
            disabled={!selectedAnswer}
            class="rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Antwort bestätigen
          </button>
        {:else}
          <button
            onclick={handleNextQuestion}
            class="rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            {isLastQuestion ? "Test beenden" : "Nächste Frage"}
          </button>
        {/if}
      </div>
    {/if}

  {:else if view === "results"}
    <!-- ================================================================== -->
    <!-- VIEW 3: TEST RESULTS                                               -->
    <!-- ================================================================== -->

    <div class="text-center">
      <h2 class="text-2xl font-bold text-text-primary mb-1">Testergebnis</h2>
      <p class="text-sm text-text-secondary">
        {test?.subject ? test.subject : scopeLabel(test?.scope ?? "")}
        &middot; {difficultyLabel(test?.difficulty ?? "")}
      </p>
    </div>

    <!-- Score Circle -->
    <div class="flex justify-center">
      <div class="relative w-32 h-32">
        <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50" cy="50" r="42"
            stroke="currentColor"
            stroke-width="8"
            fill="none"
            class="text-white/5"
          />
          <circle
            cx="50" cy="50" r="42"
            stroke="currentColor"
            stroke-width="8"
            fill="none"
            stroke-linecap="round"
            stroke-dasharray={2 * Math.PI * 42}
            stroke-dashoffset={2 * Math.PI * 42 * (1 - (test?.scorePercent ?? 0) / 100)}
            class="{scoreColor(test?.scorePercent ?? 0)}"
          />
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span class="text-3xl font-bold {scoreColor(test?.scorePercent ?? 0)}">
            {test?.scorePercent ?? 0}%
          </span>
        </div>
      </div>
    </div>

    <!-- Stats Row -->
    <div class="grid grid-cols-3 gap-3">
      <div class="rounded-xl bg-bg-secondary border border-border p-4 text-center">
        <div class="text-xl font-bold text-text-primary">
          {test?.correctCount ?? 0}/{test?.totalAnswered ?? 0}
        </div>
        <div class="text-xs text-text-muted mt-1">Richtig</div>
      </div>
      <div class="rounded-xl bg-bg-secondary border border-border p-4 text-center">
        <div class="text-xl font-bold text-text-primary">
          {test?.durationSeconds ? formatTime(test.durationSeconds) : "--:--"}
        </div>
        <div class="text-xs text-text-muted mt-1">Dauer</div>
      </div>
      <div class="rounded-xl bg-bg-secondary border border-border p-4 text-center">
        <div class="text-xl font-bold text-text-primary">
          {difficultyLabel(test?.difficulty ?? "")}
        </div>
        <div class="text-xs text-text-muted mt-1">Schwierigkeit</div>
      </div>
    </div>

    <!-- Per-Subject Breakdown (cross-topic only) -->
    {#if test?.scope === "cross-topic" && questions.length > 0}
      {@const subjectBreakdown = (() => {
        const breakdown: Record<string, { correct: number; total: number }> = {};
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const r = perQuestionResults[i];
          if (!breakdown[q.subject]) breakdown[q.subject] = { correct: 0, total: 0 };
          breakdown[q.subject].total++;
          if (r?.correct) breakdown[q.subject].correct++;
        }
        return Object.entries(breakdown).sort((a, b) => a[0].localeCompare(b[0]));
      })()}

      {#if subjectBreakdown.length > 1}
        <div class="rounded-xl bg-bg-secondary border border-border p-5">
          <h3 class="text-base font-semibold text-text-primary mb-3">Ergebnis nach Fachgebiet</h3>
          <div class="space-y-2.5">
            {#each subjectBreakdown as [subject, stats]}
              {@const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0}
              <div>
                <div class="flex items-center justify-between mb-1">
                  <span class="text-sm text-text-primary">{subject}</span>
                  <span class="text-sm font-semibold {scoreColor(pct)}">{pct}%</span>
                </div>
                <div class="w-full rounded-full bg-white/5 h-1.5">
                  <div
                    class="rounded-full h-1.5 transition-all {pct >= 80 ? 'bg-mastery-sicher' : pct >= 60 ? 'bg-mastery-solide' : pct >= 30 ? 'bg-mastery-grundlagen' : 'bg-mastery-unsicher'}"
                    style="width: {pct}%"
                  ></div>
                </div>
                <div class="text-[10px] text-text-muted mt-0.5">{stats.correct} von {stats.total} richtig</div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/if}

    <!-- Question Review -->
    <div class="rounded-xl bg-bg-secondary border border-border p-5">
      <h3 class="text-base font-semibold text-text-primary mb-3">Fragenübersicht</h3>
      <div class="space-y-2">
        {#each questions as q, idx}
          {@const result = perQuestionResults[idx]}
          {@const isExpanded = expandedQuestions.has(idx)}

          <div class="rounded-lg border {result?.correct ? 'border-green-500/20 bg-green-500/[0.03]' : 'border-red-500/20 bg-red-500/[0.03]'}">
            <button
              onclick={() => toggleExpandQuestion(idx)}
              class="w-full text-left px-4 py-3 flex items-center justify-between"
            >
              <div class="flex items-center gap-3">
                <span class="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold {result?.correct ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">
                  {idx + 1}
                </span>
                <span class="text-sm text-text-primary line-clamp-1">
                  {q.stem.length > 80 ? q.stem.slice(0, 80) + "..." : q.stem}
                </span>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <span class="text-xs text-text-muted">{q.subject}</span>
                <svg
                  class="w-4 h-4 text-text-muted transition-transform {isExpanded ? 'rotate-180' : ''}"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {#if isExpanded}
              <div class="px-4 pb-4 border-t border-white/5 pt-3">
                <p class="text-sm text-text-secondary whitespace-pre-wrap mb-3">{q.stem}</p>

                <div class="space-y-1.5 mb-3">
                  {#each q.options as option}
                    {@const isCorrect = option.label === q.correctAnswer}
                    {@const wasChosen = result?.answer === option.label}
                    <div class="flex items-start gap-2 text-sm {isCorrect ? 'text-green-400' : wasChosen ? 'text-red-400' : 'text-text-muted'}">
                      <span class="font-semibold flex-shrink-0">{option.label}.</span>
                      <span>{option.text}</span>
                      {#if isCorrect}
                        <svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      {/if}
                      {#if wasChosen && !isCorrect}
                        <svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      {/if}
                    </div>
                  {/each}
                </div>

                <div class="rounded-lg bg-white/[0.03] border border-border/50 p-3">
                  <div class="text-xs font-medium text-text-muted mb-1">Erklärung</div>
                  <p class="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{q.explanation}</p>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <!-- Reset Button -->
    <div class="flex justify-center">
      <button
        onclick={handleReset}
        class="rounded-lg bg-accent px-8 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
      >
        Neuen Test starten
      </button>
    </div>
  {/if}
</div>
