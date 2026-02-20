<script lang="ts">
  import TodayTab from "./tabs/TodayTab.svelte";
  import PlanTab from "./tabs/PlanTab.svelte";
  import SubjectsTab from "./tabs/SubjectsTab.svelte";
  import AnkiTab from "./tabs/AnkiTab.svelte";
  import RetainTab from "./tabs/RetainTab.svelte";
  import StatsTab from "./tabs/StatsTab.svelte";
  import SettingsTab from "./tabs/SettingsTab.svelte";

  type TabId = "today" | "plan" | "subjects" | "anki" | "retain" | "stats" | "settings";

  let activeTab = $state<TabId>("today");

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "today", label: "Heute", icon: "📋" },
    { id: "plan", label: "Plan", icon: "📅" },
    { id: "subjects", label: "Fächer", icon: "📚" },
    { id: "anki", label: "Anki", icon: "🃏" },
    { id: "retain", label: "Retain-Test", icon: "🧪" },
    { id: "stats", label: "Statistiken", icon: "📊" },
    { id: "settings", label: "Einstellungen", icon: "⚙️" },
  ];
</script>

<div class="flex h-screen bg-bg-primary">
  <!-- Sidebar -->
  <nav class="flex w-52 flex-col border-r border-border bg-bg-secondary">
    <div class="px-4 py-5">
      <h1 class="text-base font-bold text-text-primary">M2 Lernbegleiter</h1>
      <p class="mt-0.5 text-xs text-text-muted">Dein Examens-Coach</p>
    </div>

    <div class="flex flex-1 flex-col gap-0.5 px-2">
      {#each tabs as tab}
        <button
          class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors
            {activeTab === tab.id
              ? 'bg-accent/15 text-accent font-medium'
              : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}"
          onclick={() => (activeTab = tab.id)}
        >
          <span class="text-base">{tab.icon}</span>
          {tab.label}
        </button>
      {/each}
    </div>

    <!-- Bottom info -->
    <div class="border-t border-border px-4 py-3">
      <div class="text-xs text-text-muted">
        Examen: <span class="text-text-secondary">Okt. 2026</span>
      </div>
    </div>
  </nav>

  <!-- Main content -->
  <main class="flex-1 overflow-y-auto p-6">
    {#if activeTab === "today"}
      <TodayTab />
    {:else if activeTab === "plan"}
      <PlanTab />
    {:else if activeTab === "subjects"}
      <SubjectsTab />
    {:else if activeTab === "anki"}
      <AnkiTab />
    {:else if activeTab === "retain"}
      <RetainTab />
    {:else if activeTab === "stats"}
      <StatsTab />
    {:else if activeTab === "settings"}
      <SettingsTab />
    {/if}
  </main>
</div>
