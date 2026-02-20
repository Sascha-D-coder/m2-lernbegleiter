<script lang="ts">
  const subjects = [
    { name: "Pharmakologie", days: 6, color: "bg-purple-500" },
    { name: "Innere Medizin", days: 23, color: "bg-red-500" },
    { name: "Chirurgie", days: 8, color: "bg-orange-500" },
    { name: "Neurologie", days: 6, color: "bg-blue-500" },
    { name: "Pädiatrie", days: 5, color: "bg-green-500" },
    { name: "Gynäkologie", days: 5, color: "bg-pink-500" },
    { name: "Orthopädie/Unfallchirurgie", days: 5, color: "bg-amber-500" },
    { name: "Psychiatrie", days: 4, color: "bg-indigo-500" },
    { name: "Dermatologie", days: 3, color: "bg-yellow-500" },
    { name: "HNO", days: 3, color: "bg-teal-500" },
    { name: "Augenheilkunde", days: 3, color: "bg-cyan-500" },
    { name: "Anästhesiologie", days: 3, color: "bg-emerald-500" },
    { name: "Urologie", days: 2, color: "bg-lime-500" },
    { name: "Radiologie", days: 2, color: "bg-slate-500" },
    { name: "Rechtsmedizin", days: 2, color: "bg-stone-500" },
    { name: "Notfallmedizin", days: 2, color: "bg-rose-500" },
    { name: "Allgemeinmedizin", days: 2, color: "bg-sky-500" },
    { name: "Sonstiges", days: 3, color: "bg-gray-500" },
  ];
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold text-text-primary">Fächer</h2>
    <p class="text-sm text-text-secondary">Fortschritt pro Fachgebiet</p>
  </div>

  <div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
    {#each subjects as subject}
      <div class="rounded-xl bg-bg-secondary border border-border p-4 transition-colors hover:border-accent/30">
        <div class="flex items-center gap-2 mb-2">
          <div class="h-2.5 w-2.5 rounded-full {subject.color}"></div>
          <h4 class="text-sm font-medium text-text-primary">{subject.name}</h4>
        </div>
        <div class="flex items-end justify-between">
          <div>
            <div class="text-xs text-text-muted">{subject.days} Lerntage</div>
            <div class="text-xs text-text-muted">Mastery: –</div>
          </div>
          <div class="text-lg font-bold text-text-muted">0%</div>
        </div>
        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
          <div class="h-full rounded-full {subject.color} opacity-60" style="width: 0%"></div>
        </div>
      </div>
    {/each}
  </div>
</div>
