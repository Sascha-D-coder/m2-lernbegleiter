<script lang="ts">
  // Will be connected to planStore and DB
  let dayNumber = $state(1);
  let totalDays = $state(88);
  let subject = $state("Pharmakologie");
  let subTopic = $state("Grundlagen der Pharmakologie");
  let chapters = $state(["Pharmakodynamik", "Pharmakokinetik", "Arzneimittelinteraktionen"]);
  let readingDone = $state(false);
  let kreuzenDone = $state(false);
  let kreuzenTarget = $state(80);
  let kreuzenCorrect = $state(0);
  let kreuzenTotal = $state(0);
  let ankiDue = $state(0);
  let streak = $state(0);
  let progressPercent = $state(0);

  function formatPercent(correct: number, total: number): string {
    if (total === 0) return "–";
    return Math.round((correct / total) * 100) + "%";
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div>
    <h2 class="text-2xl font-bold text-text-primary">Heute</h2>
    <p class="text-sm text-text-secondary">
      Tag {dayNumber} von {totalDays} &middot;
      {new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
    </p>
  </div>

  <!-- Subject Hero -->
  <div class="rounded-xl bg-bg-secondary border border-border p-5">
    <div class="flex items-start justify-between">
      <div>
        <div class="text-xs font-medium uppercase tracking-wider text-accent">
          Heutiges Thema
        </div>
        <h3 class="mt-1 text-xl font-semibold text-text-primary">{subject}</h3>
        <p class="text-sm text-text-secondary">{subTopic}</p>
      </div>
      <div class="text-right">
        <div class="text-2xl font-bold text-accent">{progressPercent}%</div>
        <div class="text-xs text-text-muted">Gesamtfortschritt</div>
      </div>
    </div>

    {#if chapters.length > 0}
      <div class="mt-4">
        <div class="text-xs font-medium text-text-muted mb-2">Kapitel:</div>
        <div class="flex flex-wrap gap-2">
          {#each chapters as chapter}
            <span class="rounded-md bg-white/5 px-2.5 py-1 text-xs text-text-secondary">
              {chapter}
            </span>
          {/each}
        </div>
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
            bind:checked={readingDone}
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
        <h4 class="text-sm font-medium text-text-primary">{kreuzenTarget} Fragen kreuzen</h4>
        <label class="cursor-pointer">
          <input
            type="checkbox"
            bind:checked={kreuzenDone}
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
</div>
