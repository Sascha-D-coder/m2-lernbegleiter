<script lang="ts">
  import {
    getSettings, loadSettings, saveSettings, isLoaded,
    getVacationDays, addVacationDay, addVacationRange, removeVacationDay, clearAllVacationDays,
    type VacationDay,
  } from "$lib/stores/settingsStore.svelte";
  import { setCalendarDays, importAmbossPlan, getAmbossDays } from "$lib/stores/planStore.svelte";
  import { buildStudyPlan } from "$lib/utils/planEngine";
  import type { AmbossDay } from "$lib/utils/planEngine";
  import { LLM_PROVIDERS, type LLMProvider } from "$lib/api/llm";
  import { toastSuccess, toastError } from "$lib/stores/toastStore.svelte";

  let loaded = $derived(isLoaded());
  let settings = $derived(getSettings());

  // Local form values
  let planStartDate = $state("");
  let examDate = $state("");
  let planEndDate = $state("");
  let semesterEnd = $state("");
  // Vacation UI state
  let vacDays = $derived(getVacationDays());
  let newVacDate = $state("");
  let newVacRangeStart = $state("");
  let newVacRangeEnd = $state("");
  let newVacType = $state<VacationDay["type"]>("anki-only");
  let vacMode = $state<"single" | "range">("single");
  let semesterHours = $state(2.5);
  let fulltimeHours = $state(7);
  let pharmaPriority = $state(true);
  let weekendsOff = $state(true);
  let llmProvider = $state("claude");
  let llmApiKey = $state("");
  let llmModel = $state("claude-sonnet-4-5-20250929");

  const providerEntries = Object.entries(LLM_PROVIDERS) as [LLMProvider, typeof LLM_PROVIDERS[LLMProvider]][];
  let providerMeta = $derived(LLM_PROVIDERS[llmProvider as LLMProvider] ?? LLM_PROVIDERS.claude);

  let notificationEnabled = $state(true);
  let morningTime = $state("08:00");
  let eveningTime = $state("20:00");
  let theme = $state("light");

  let saving = $state(false);
  let saved = $state(false);
  let regenerating = $state(false);
  let justRegenerated = $state(false);

  // Sync from store on load
  $effect(() => {
    if (loaded) {
      const s = settings;
      planStartDate = s.planStartDate;
      examDate = s.examDate;
      planEndDate = s.planEndDate;
      semesterEnd = s.semesterEndDate;
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
      theme = s.theme;
    }
  });

  // Validation warnings
  let planWarnings = $derived.by(() => {
    const warnings: string[] = [];
    if (!planStartDate || !examDate) return warnings;

    const start = new Date(planStartDate);
    const exam = new Date(examDate);
    const now = new Date();
    now.setHours(0,0,0,0);

    const totalDays = Math.round((exam.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (totalDays < 60) {
      warnings.push(`Nur ${totalDays} Tage Lernzeit. Das ist sehr knapp für 88 AMBOSS-Lerntage.`);
    } else if (totalDays < 100) {
      warnings.push(`${totalDays} Tage Lernzeit. Ambitioniert, aber machbar bei Vollzeit-Lernen.`);
    }

    if (start.getTime() < now.getTime()) {
      const daysPast = Math.round((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      warnings.push(`Startdatum liegt ${daysPast} Tage in der Vergangenheit.`);
    }

    if (exam.getTime() <= start.getTime()) {
      warnings.push("Examstermin muss nach dem Startdatum liegen.");
    }

    if (semesterEnd) {
      const semEnd = new Date(semesterEnd);
      if (semEnd.getTime() <= start.getTime()) {
        warnings.push("Semesterende sollte nach dem Startdatum liegen.");
      }
    }

    return warnings;
  });

  function applyTheme(t: string) {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", t);
    }
  }

  // Apply theme visually whenever local state changes
  $effect(() => {
    applyTheme(theme);
  });

  // Save theme immediately when toggled (don't wait for "Speichern")
  async function setTheme(t: string) {
    theme = t;
    applyTheme(t);
    await saveSettings({ theme: t });
  }

  async function handleSave() {
    saving = true;
    saved = false;
    await saveSettings({
      planStartDate,
      examDate,
      planEndDate,
      semesterEndDate: semesterEnd,
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
      theme,
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
        startDate: planStartDate,
        examDate,
        semesterEndDate: semesterEnd,
        juneVacation: { start: "", end: "" },
        septVacation: { start: "", end: "" },
        vacationDays: vacDays,
        weekendsOff,
        semesterHoursPerDay: semesterHours,
        fulltimeHoursPerDay: fulltimeHours,
        pharmaPrioritized: pharmaPriority,
      });
      setCalendarDays(calendar);
      toastSuccess("Lernplan erfolgreich neu generiert!");
      justRegenerated = true;
    } catch (error) {
      toastError("Plan-Generierung fehlgeschlagen!");
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

  <!-- Design -->
  <div class="rounded-xl bg-bg-secondary border border-border p-5">
    <h3 class="text-base font-semibold text-text-primary mb-4">Darstellung</h3>
    <div class="flex items-center justify-between">
      <div>
        <div class="text-sm text-text-secondary">Farbmodus</div>
        <div class="text-xs text-text-muted mt-0.5">Hell für den Tag, Dunkel für die Nacht</div>
      </div>
      <div class="flex rounded-lg border border-border overflow-hidden">
        <button
          onclick={() => setTheme("light")}
          class="px-3 py-1.5 text-xs font-medium transition-colors {theme === 'light' ? 'bg-accent text-white' : 'bg-bg-primary text-text-secondary hover:text-text-primary'}"
        >
          Hell
        </button>
        <button
          onclick={() => setTheme("dark")}
          class="px-3 py-1.5 text-xs font-medium transition-colors {theme === 'dark' ? 'bg-accent text-white' : 'bg-bg-primary text-text-secondary hover:text-text-primary'}"
        >
          Dunkel
        </button>
      </div>
    </div>
  </div>

  <!-- Termine -->
  <div class="rounded-xl bg-bg-secondary border border-border p-5">
    <h3 class="text-base font-semibold text-text-primary mb-4">Termine</h3>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="planStart" class="text-xs font-medium text-text-muted mb-1.5 block">Plan-Start</label>
        <input id="planStart" type="date" bind:value={planStartDate}
          class="w-full rounded-lg bg-bg-primary border border-border px-3 py-2 text-sm text-text-primary" />
      </div>
      <div>
        <label for="semesterEnd" class="text-xs font-medium text-text-muted mb-1.5 block">Semesterende (Vollzeit ab)</label>
        <input id="semesterEnd" type="date" bind:value={semesterEnd}
          class="w-full rounded-lg bg-bg-primary border border-border px-3 py-2 text-sm text-text-primary" />
      </div>
      <div>
        <label for="examDate" class="text-xs font-medium text-text-muted mb-1.5 block">Erster Klausurtag (M2)</label>
        <input id="examDate" type="date" bind:value={examDate}
          class="w-full rounded-lg bg-bg-primary border border-border px-3 py-2 text-sm text-text-primary" />
        <p class="text-[10px] text-text-muted mt-1">M2 Herbst 2026: 06.10. – 08.10.2026 (3 Tage)</p>
      </div>
      <div>
        <label for="planEnd" class="text-xs font-medium text-text-muted mb-1.5 block">Lernplan-Ende</label>
        <input id="planEnd" type="date" bind:value={planEndDate}
          class="w-full rounded-lg bg-bg-primary border border-border px-3 py-2 text-sm text-text-primary" />
        <p class="text-[10px] text-text-muted mt-1">Letzter Lerntag vor dem Examen (inkl. Probeklausuren)</p>
      </div>
    </div>

    {#if planWarnings.length > 0}
      <div class="mt-3 space-y-1.5">
        {#each planWarnings as warning}
          <div class="flex items-start gap-2 rounded-lg bg-warning/10 border border-warning/20 px-3 py-2">
            <span class="text-warning text-sm shrink-0">&#9888;</span>
            <span class="text-xs text-text-secondary">{warning}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Urlaub -->
  <div class="rounded-xl bg-bg-secondary border border-border p-5">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-base font-semibold text-text-primary">Urlaub</h3>
        <p class="text-xs text-text-muted mt-0.5">Optional – Tage ohne AMBOSS-Lerninhalte</p>
      </div>
      {#if vacDays.length > 0}
        <button onclick={clearAllVacationDays}
          class="text-[10px] text-danger/70 hover:text-danger transition-colors">
          Alle entfernen
        </button>
      {/if}
    </div>

    <!-- Add vacation days -->
    <div class="space-y-3 mb-4">
      <div class="flex gap-2">
        <button onclick={() => vacMode = "single"}
          class="px-3 py-1 text-xs rounded-lg transition-colors {vacMode === 'single' ? 'bg-accent/15 text-accent font-medium' : 'bg-bg-primary text-text-muted hover:text-text-secondary'}">
          Einzelner Tag
        </button>
        <button onclick={() => vacMode = "range"}
          class="px-3 py-1 text-xs rounded-lg transition-colors {vacMode === 'range' ? 'bg-accent/15 text-accent font-medium' : 'bg-bg-primary text-text-muted hover:text-text-secondary'}">
          Zeitraum
        </button>
      </div>

      <div class="flex items-end gap-2">
        {#if vacMode === "single"}
          <div class="flex-1">
            <label for="vacDate" class="text-xs font-medium text-text-muted mb-1.5 block">Datum</label>
            <input id="vacDate" type="date" bind:value={newVacDate}
              class="w-full rounded-lg bg-bg-primary border border-border px-3 py-2 text-sm text-text-primary" />
          </div>
        {:else}
          <div class="flex-1">
            <label for="vacRangeStart" class="text-xs font-medium text-text-muted mb-1.5 block">Von</label>
            <input id="vacRangeStart" type="date" bind:value={newVacRangeStart}
              class="w-full rounded-lg bg-bg-primary border border-border px-3 py-2 text-sm text-text-primary" />
          </div>
          <div class="flex-1">
            <label for="vacRangeEnd" class="text-xs font-medium text-text-muted mb-1.5 block">Bis</label>
            <input id="vacRangeEnd" type="date" bind:value={newVacRangeEnd}
              class="w-full rounded-lg bg-bg-primary border border-border px-3 py-2 text-sm text-text-primary" />
          </div>
        {/if}

        <div class="w-36">
          <label for="vacType" class="text-xs font-medium text-text-muted mb-1.5 block">Typ</label>
          <select id="vacType" bind:value={newVacType}
            class="w-full rounded-lg bg-bg-primary border border-border px-3 py-2 text-sm text-text-primary">
            <option value="anki-only">Nur Anki</option>
            <option value="full-rest">Komplett frei</option>
          </select>
        </div>

        <button
          onclick={async () => {
            if (vacMode === "single" && newVacDate) {
              await addVacationDay(newVacDate, newVacType);
              newVacDate = "";
            } else if (vacMode === "range" && newVacRangeStart && newVacRangeEnd) {
              await addVacationRange(newVacRangeStart, newVacRangeEnd, newVacType);
              newVacRangeStart = "";
              newVacRangeEnd = "";
            }
          }}
          class="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
        >
          +
        </button>
      </div>
    </div>

    <!-- List of vacation days as chips -->
    {#if vacDays.length > 0}
      <div class="flex flex-wrap gap-1.5">
        {#each vacDays as day}
          <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs
            {day.type === 'full-rest' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'}">
            {new Date(day.date + "T00:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
            <span class="text-[9px] opacity-60">{day.type === "full-rest" ? "frei" : "anki"}</span>
            <button onclick={() => removeVacationDay(day.date)}
              class="ml-0.5 opacity-50 hover:opacity-100 transition-opacity">&times;</button>
          </span>
        {/each}
      </div>
      <p class="text-[10px] text-text-muted mt-2">
        {vacDays.filter(d => d.type === "anki-only").length} Tage nur Anki · {vacDays.filter(d => d.type === "full-rest").length} Tage komplett frei
      </p>
    {:else}
      <p class="text-xs text-text-muted">Kein Urlaub geplant. Du kannst jederzeit Tage hinzufügen.</p>
    {/if}
  </div>

  <!-- Lernzeit -->
  <div class="rounded-xl bg-bg-secondary border border-border p-5">
    <h3 class="text-base font-semibold text-text-primary mb-4">Lernzeit</h3>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="semHours" class="text-xs font-medium text-text-muted mb-1.5 block">
          Stunden/Tag (Semester): {semesterHours}h
        </label>
        <input id="semHours" type="range" min="1" max="4" step="0.5" bind:value={semesterHours}
          class="w-full accent-accent" />
      </div>
      <div>
        <label for="ftHours" class="text-xs font-medium text-text-muted mb-1.5 block">
          Stunden/Tag (Vollzeit): {fulltimeHours}h
        </label>
        <input id="ftHours" type="range" min="4" max="10" step="0.5" bind:value={fulltimeHours}
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
    <p class="mt-3 text-xs text-text-muted">
      Die letzten 14 Tage vor dem ersten Klausurtag sind automatisch für AMBOSS-Probeklausuren reserviert. Keine neuen Themen, keine Wiederholungen — nur Probeklausuren und leichtes Anki.
    </p>
  </div>

  <!-- KI-Einstellungen -->
  <div class="rounded-xl bg-bg-secondary border border-border p-5">
    <h3 class="text-base font-semibold text-text-primary mb-4">KI-Einstellungen</h3>
    <p class="text-xs text-text-muted mb-4">Konfiguration für Retain-Tests und KI-gestützte Lernhilfen</p>
    <div class="space-y-4">
      <div>
        <label for="llmProvider" class="text-xs font-medium text-text-muted mb-1.5 block">LLM Provider</label>
        <select id="llmProvider" bind:value={llmProvider}
          onchange={() => { llmModel = providerMeta.models[0]?.value ?? ""; }}
          class="w-full rounded-lg bg-bg-primary border border-border px-3 py-2 text-sm text-text-primary">
          {#each providerEntries as [key, meta]}
            <option value={key}>{meta.label}</option>
          {/each}
        </select>
      </div>

      {#if providerMeta.needsApiKey}
        <div>
          <label for="apiKey" class="text-xs font-medium text-text-muted mb-1.5 block">API Key</label>
          <input id="apiKey" type="password" bind:value={llmApiKey} placeholder={providerMeta.keyPlaceholder}
            class="w-full rounded-lg bg-bg-primary border border-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/40" />
        </div>

        <div class="rounded-lg bg-accent/5 border border-accent/15 p-3">
          <h4 class="text-xs font-semibold text-accent mb-2">So bekommst du einen API Key:</h4>
          <ol class="text-xs text-text-secondary space-y-1.5 list-decimal list-inside">
            {#each providerMeta.helpSteps as step}
              <li>{step}</li>
            {/each}
          </ol>
          {#if providerMeta.costNote}
            <p class="text-[10px] text-text-muted mt-2">{providerMeta.costNote}</p>
          {/if}
        </div>
      {/if}

      <div>
        <label for="llmModel" class="text-xs font-medium text-text-muted mb-1.5 block">Modell</label>
        <select id="llmModel" bind:value={llmModel}
          class="w-full rounded-lg bg-bg-primary border border-border px-3 py-2 text-sm text-text-primary">
          {#each providerMeta.models as model}
            <option value={model.value}>{model.label}</option>
          {/each}
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
            <label for="morningTime" class="text-xs font-medium text-text-muted mb-1.5 block">Morgens</label>
            <input id="morningTime" type="time" bind:value={morningTime}
              class="w-full rounded-lg bg-bg-primary border border-border px-3 py-2 text-sm text-text-primary" />
          </div>
          <div>
            <label for="eveningTime" class="text-xs font-medium text-text-muted mb-1.5 block">Abends</label>
            <input id="eveningTime" type="time" bind:value={eveningTime}
              class="w-full rounded-lg bg-bg-primary border border-border px-3 py-2 text-sm text-text-primary" />
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
      onclick={() => { justRegenerated = false; regeneratePlan(); }}
      disabled={regenerating || justRegenerated}
      class="rounded-lg px-6 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed
        {justRegenerated ? 'bg-success/20 text-success border border-success/30' : 'border border-border bg-bg-primary text-text-primary hover:bg-border/30 disabled:opacity-50'}"
    >
      {#if regenerating}
        <span class="inline-flex items-center gap-2">
          <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          Generiere...
        </span>
      {:else if justRegenerated}
        Plan generiert &#10003;
      {:else}
        Plan neu generieren
      {/if}
    </button>
  </div>
</div>
