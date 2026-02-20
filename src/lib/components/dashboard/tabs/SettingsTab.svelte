<script lang="ts">
  let examDate = $state("2026-10-14");
  let semesterEnd = $state("2026-07-20");
  let juneVacStart = $state("2026-06-01");
  let juneVacEnd = $state("2026-06-14");
  let septVacStart = $state("2026-09-07");
  let septVacEnd = $state("2026-09-13");
  let semesterHours = $state(2.5);
  let fulltimeHours = $state(7);
  let pharmaPriority = $state(true);
  let weekendsOff = $state(true);
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold text-text-primary">Einstellungen</h2>
    <p class="text-sm text-text-secondary">Lernplan-Konfiguration und Präferenzen</p>
  </div>

  <!-- Dates -->
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

  <!-- Vacations -->
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

  <!-- Study Parameters -->
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

  <!-- Toggles -->
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

  <button class="rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover">
    Einstellungen speichern
  </button>
</div>
