<script lang="ts">
  // Placeholder for Retain-Test system
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold text-text-primary">Retain-Test</h2>
    <p class="text-sm text-text-secondary">IMPP-realistische Wissenstests auf 3 Niveaus</p>
  </div>

  <!-- Test Configuration (preview) -->
  <div class="rounded-xl bg-bg-secondary border border-border p-5">
    <h3 class="text-base font-semibold text-text-primary mb-4">Neuen Test starten</h3>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="text-xs font-medium text-text-muted mb-1.5 block">Umfang</label>
        <select class="w-full rounded-lg bg-white/5 border border-border px-3 py-2 text-sm text-text-primary">
          <option>Themenübergreifend (letzte 2 Wochen)</option>
          <option>Fachspezifisch</option>
        </select>
      </div>

      <div>
        <label class="text-xs font-medium text-text-muted mb-1.5 block">Schwierigkeit</label>
        <select class="w-full rounded-lg bg-white/5 border border-border px-3 py-2 text-sm text-text-primary">
          <option>Gemischt (IMPP-realistisch)</option>
          <option>Basis (Fakten)</option>
          <option>Anwendung (Klinische Szenarien)</option>
          <option>Transfer (Fächerübergreifend)</option>
        </select>
      </div>

      <div>
        <label class="text-xs font-medium text-text-muted mb-1.5 block">Fragenanzahl</label>
        <select class="w-full rounded-lg bg-white/5 border border-border px-3 py-2 text-sm text-text-primary">
          <option>10 Fragen</option>
          <option>5 Fragen</option>
          <option>20 Fragen</option>
        </select>
      </div>

      <div class="flex items-end">
        <button
          disabled
          class="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white opacity-50 cursor-not-allowed"
        >
          Test starten (Phase 4)
        </button>
      </div>
    </div>
  </div>

  <!-- Mastery Preview -->
  <div class="rounded-xl bg-bg-secondary border border-border p-5">
    <h3 class="text-base font-semibold text-text-primary mb-3">Mastery-Übersicht</h3>
    <p class="text-sm text-text-muted">
      Hier siehst du nach den ersten Tests deine Beherrschungsgrade pro Thema.
    </p>
    <div class="mt-4 grid grid-cols-4 gap-2">
      <div class="rounded-lg bg-mastery-unsicher/10 border border-mastery-unsicher/20 p-2 text-center">
        <div class="text-xs font-medium text-mastery-unsicher">Unsicher</div>
        <div class="text-[10px] text-text-muted">0-30%</div>
      </div>
      <div class="rounded-lg bg-mastery-grundlagen/10 border border-mastery-grundlagen/20 p-2 text-center">
        <div class="text-xs font-medium text-mastery-grundlagen">Grundlagen</div>
        <div class="text-[10px] text-text-muted">30-60%</div>
      </div>
      <div class="rounded-lg bg-mastery-solide/10 border border-mastery-solide/20 p-2 text-center">
        <div class="text-xs font-medium text-mastery-solide">Solide</div>
        <div class="text-[10px] text-text-muted">60-80%</div>
      </div>
      <div class="rounded-lg bg-mastery-sicher/10 border border-mastery-sicher/20 p-2 text-center">
        <div class="text-xs font-medium text-mastery-sicher">Sicher</div>
        <div class="text-[10px] text-text-muted">80-100%</div>
      </div>
    </div>
  </div>
</div>
