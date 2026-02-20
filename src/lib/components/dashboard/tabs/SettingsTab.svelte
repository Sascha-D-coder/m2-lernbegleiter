<script lang="ts">
  import { getSettings, loadSettings, saveSettings, isLoaded } from "$lib/stores/settingsStore.svelte";
  import { setCalendarDays, importAmbossPlan, getAmbossDays } from "$lib/stores/planStore.svelte";
  import { buildStudyPlan } from "$lib/utils/planEngine";
  import type { AmbossDay } from "$lib/utils/planEngine";

  let loaded = $derived(isLoaded());
  let settings = $derived(getSettings());

  // Local form values - initialized from settings
  let examDate = $state("");
  let semesterEnd = $state("");
  let juneVacStart = $state("");
  let juneVacEnd = $state("");
  let septVacStart = $state("");
  let septVacEnd = $state("");
  let semesterHours = $state(2.5);
  let fulltimeHours = $state(7);
  let pharmaPriority = $state(true);
  let weekendsOff = $state(true);
  let llmProvider = $state("claude");
  let llmApiKey = $state("");
  let llmModel = $state("claude-sonnet-4-5-20250929");
  let notificationEnabled = $state(true);
  let morningTime = $state("08:00");
  let eveningTime = $state("20:00");

  let saving = $state(false);
  let saved = $state(false);
  let regenerating = $state(false);

  // Sync from store on load
  $effect(() => {
    if (loaded) {
      const s = settings;
      examDate = s.examDate;
      semesterEnd = s.semesterEndDate;
      juneVacStart = s.juneVacationStart;
      juneVacEnd = s.juneVacationEnd;
      septVacStart = s.septVacationStart;
      septVacEnd = s.septVacationEnd;
      semesterHours = s.semesterHoursPerDay;
      fulltimeHours = s.fulltimeHoursPerDay;
      pharmaPriority = s.pharmaPrioritized;
      weekendsOff = s.weekendsOff;
      llmProvider = s.llmProvider;
      llmApiKey = s.llmApiKey;
      llmModel = s.llmModel;
      notificationEnabled = s.notificationEnabled;
      morningTime = s.notificationMorningTime;
      eveningTime = s.notificationEveningTime;
    }
  });

  async function handleSave() {
    saving = true;
    saved = false;
    await saveSettings({
      examDate,
      semesterEndDate: semesterEnd,
      juneVacationStart: juneVacStart,
      juneVacationEnd: juneVacEnd,
      septVacationStart: septVacStart,
      septVacationEnd: septVacEnd,
      semesterHoursPerDay: semesterHours,
      fulltimeHoursPerDay: fulltimeHours,
      weekendsOff,
      pharmaPrioritized: pharmaPriority,
      llmProvider,
      llmApiKey,
      llmModel,
      notificationEnabled,
      notificationMorningTime: morningTime,
      notificationEveningTime: eveningTime,
    });
    saving = false;
    saved = true;
    setTimeout(() => (saved = false), 2000);
  }

  async function regeneratePlan() {
    regenerating = true;
    try {
      let ambossDays = getAmbossDays();
      if (ambossDays.length === 0) {
        const resp = await fetch("/amboss-plan.json");
        const days: AmbossDay[] = await resp.json();
        await importAmbossPlan(days);
        ambossDays = days;
      }
      const calendar = buildStudyPlan(ambossDays, {
        examDate,
        semesterEndDate: semesterEnd,
        juneVacation: { start: juneVacStart, end: juneVacEnd },
        septVacation: { start: septVacStart, end: septVacEnd },
        weekendsOff,
        semesterHoursPerDay: semesterHours,
        fulltimeHoursPerDay: fulltimeHours,
        pharmaPrioritized: pharmaPriority,
      });
      setCalendarDays(calendar);
    } catch (error) {
      console.error("Failed to regenerate plan:", error);
    }
    regenerating = false;
  }
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold text-text-primary">Einstellungen</h2>
    <p class="text-sm text-text-secondary">Lernplan-Konfiguration und Präferenzen</p>
  </div>

  <!-- Termine -->
  <div class="rounded-xl bg-bg-secondary border border-border p-5">
    <h3 class="text-base font-semibold text-text-primary mb-4">Termine</h3>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="text-xs font-medium text-text-muted mb-1.5 block">Examstermin</label>
        <input type="date" bind:value={examDate}
          class="w-full rounded-lg bg-white/5 border border-border px-3 py-2 text-sm text-text-primary" />
      </div>
      <div>
        <label class="text-xs font-medium text-text-muted mb-1.5 block">Semesterende</label>
        <input type="date" bind:value={semesterEnd}
          class="w-full rounded-lg bg-white/5 border border-border px-3 py-2 text-sm text-text-primary" />
      </div>
    </div>
  </div>

  <!-- Urlaub -->
  <div class="rounded-xl bg-bg-secondary border border-border p-5">
    <h3 class="text-base font-semibold text-text-primary mb-4">Urlaub</h3>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="text-xs font-medium text-text-muted mb-1.5 block">Juni-Urlaub Start</label>
        <input type="date" bind:value={juneVacStart}
          class="w-full rounded-lg bg-white/5 border border-border px-3 py-2 text-sm text-text-primary" />
      </div>
      <div>
        <label class="text-xs font-medium text-text-muted mb-1.5 block">Juni-Urlaub Ende</label>
        <input type="date" bind:value={juneVacEnd}
          class="w-full rounded-lg bg-white/5 border border-border px-3 py-2 text-sm text-text-primary" />
      </div>
      <div>
        <label class="text-xs font-medium text-text-muted mb-1.5 block">September-Urlaub Start</label>
        <input type="date" bind:value={septVacStart}
          class="w-full rounded-lg bg-white/5 border border-border px-3 py-2 text-sm text-text-primary" />
      </div>
      <div>
        <label class="text-xs font-medium text-text-muted mb-1.5 block">September-Urlaub Ende</label>
        <input type="date" bind:value={septVacEnd}
          class="w-full rounded-lg bg-white/5 border border-border px-3 py-2 text-sm text-text-primary" />
      </div>
    </div>
  </div>

  <!-- Lernzeit -->
  <div class="rounded-xl bg-bg-secondary border border-border p-5">
    <h3 class="text-base font-semibold text-text-primary mb-4">Lernzeit</h3>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="text-xs font-medium text-text-muted mb-1.5 block">
          Stunden/Tag (Semester): {semesterHours}h
        </label>
        <input type="range" min="1" max="4" step="0.5" bind:value={semesterHours}
          class="w-full accent-accent" />
      </div>
      <div>
        <label class="text-xs font-medium text-text-muted mb-1.5 block">
          Stunden/Tag (Vollzeit): {fulltimeHours}h
        </label>
        <input type="range" min="4" max="10" step="0.5" bind:value={fulltimeHours}
          class="w-full accent-accent" />
      </div>
    </div>
  </div>

  <!-- Plan-Optionen -->
  <div class="rounded-xl bg-bg-secondary border border-border p-5">
    <h3 class="text-base font-semibold text-text-primary mb-4">Plan-Optionen</h3>
    <div class="space-y-3">
      <label class="flex items-center justify-between cursor-pointer">
        <span class="text-sm text-text-secondary">Wochenenden frei</span>
        <input type="checkbox" bind:checked={weekendsOff}
          class="h-5 w-5 rounded accent-accent" />
      </label>
      <label class="flex items-center justify-between cursor-pointer">
        <span class="text-sm text-text-secondary">Pharmakologie priorisieren</span>
        <input type="checkbox" bind:checked={pharmaPriority}
          class="h-5 w-5 rounded accent-accent" />
      </label>
    </div>
  </div>

  <!-- KI-Einstellungen -->
  <div class="rounded-xl bg-bg-secondary border border-border p-5">
    <h3 class="text-base font-semibold text-text-primary mb-4">KI-Einstellungen</h3>
    <p class="text-xs text-text-muted mb-4">Konfiguration für Retain-Tests und KI-gestützte Lernhilfen</p>
    <div class="space-y-4">
      <div>
        <label class="text-xs font-medium text-text-muted mb-1.5 block">LLM Provider</label>
        <select bind:value={llmProvider}
          class="w-full rounded-lg bg-white/5 border border-border px-3 py-2 text-sm text-text-primary">
          <option value="claude">Claude API</option>
          <option value="ollama">Ollama (Lokal)</option>
        </select>
      </div>

      {#if llmProvider === "claude"}
        <div>
          <label class="text-xs font-medium text-text-muted mb-1.5 block">API Key</label>
          <input type="password" bind:value={llmApiKey} placeholder="sk-ant-..."
            class="w-full rounded-lg bg-white/5 border border-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/40" />
        </div>
      {/if}

      <div>
        <label class="text-xs font-medium text-text-muted mb-1.5 block">Modell</label>
        <select bind:value={llmModel}
          class="w-full rounded-lg bg-white/5 border border-border px-3 py-2 text-sm text-text-primary">
          {#if llmProvider === "claude"}
            <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</option>
            <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
          {:else}
            <option value="llama3.1">Llama 3.1</option>
            <option value="mistral">Mistral</option>
            <option value="gemma2">Gemma 2</option>
          {/if}
        </select>
      </div>
    </div>
  </div>

  <!-- Benachrichtigungen -->
  <div class="rounded-xl bg-bg-secondary border border-border p-5">
    <h3 class="text-base font-semibold text-text-primary mb-4">Benachrichtigungen</h3>
    <div class="space-y-4">
      <label class="flex items-center justify-between cursor-pointer">
        <span class="text-sm text-text-secondary">Benachrichtigungen aktiviert</span>
        <input type="checkbox" bind:checked={notificationEnabled}
          class="h-5 w-5 rounded accent-accent" />
      </label>

      {#if notificationEnabled}
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-xs font-medium text-text-muted mb-1.5 block">Morgens</label>
            <input type="time" bind:value={morningTime}
              class="w-full rounded-lg bg-white/5 border border-border px-3 py-2 text-sm text-text-primary" />
          </div>
          <div>
            <label class="text-xs font-medium text-text-muted mb-1.5 block">Abends</label>
            <input type="time" bind:value={eveningTime}
              class="w-full rounded-lg bg-white/5 border border-border px-3 py-2 text-sm text-text-primary" />
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Buttons -->
  <div class="flex items-center gap-3">
    <button
      onclick={handleSave}
      disabled={saving}
      class="rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
    >
      {#if saving}
        <span class="inline-flex items-center gap-2">
          <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          Speichern...
        </span>
      {:else if saved}
        Gespeichert!
      {:else}
        Einstellungen speichern
      {/if}
    </button>

    <button
      onclick={regeneratePlan}
      disabled={regenerating}
      class="rounded-lg bg-white/5 border border-border px-6 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-white/10 disabled:opacity-50"
    >
      {#if regenerating}
        <span class="inline-flex items-center gap-2">
          <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          Generiere...
        </span>
      {:else}
        Plan neu generieren
      {/if}
    </button>
  </div>
</div>
