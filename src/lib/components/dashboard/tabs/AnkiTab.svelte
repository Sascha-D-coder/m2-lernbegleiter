<script lang="ts">
  import {
    isConnected,
    getDeckNamesList,
    getCardsDueCount_,
    getDeckStatsMap,
    getLastSynced,
    getUnseenMap,
    syncAnki,
  } from "$lib/stores/ankiStore.svelte";
  import { guiDeckReview, guiDeckBrowser, bringAnkiToFront } from "$lib/api/ankiConnect";
  import { toastInfo } from "$lib/stores/toastStore.svelte";

  let connected = $derived(isConnected());
  let deckNames = $derived(getDeckNamesList());
  let cardsDue = $derived(getCardsDueCount_());
  let deckStats = $derived(getDeckStatsMap());
  let unseenMap = $derived(getUnseenMap());
  let lastSynced = $derived(getLastSynced());
  let syncing = $state(false);

  // --- Tree data structure ---
  interface DeckTreeNode {
    name: string;
    fullName: string;
    due: number;
    totalDue: number;
    totalUnseen: number;
    totalCards: number;
    stats: { new_count: number; learn_count: number; review_count: number } | null;
    children: DeckTreeNode[];
    isLeaf: boolean;
  }

  let deckTree = $derived.by(() => {
    const roots: DeckTreeNode[] = [];
    const nodeMap = new Map<string, DeckTreeNode>();
    const sorted = [...deckNames].sort();

    for (const fullName of sorted) {
      const parts = fullName.split("::");
      let currentPath = "";

      for (let i = 0; i < parts.length; i++) {
        const prevPath = currentPath;
        currentPath = i === 0 ? parts[i] : currentPath + "::" + parts[i];

        if (!nodeMap.has(currentPath)) {
          const stats = deckStats[currentPath];
          const due = stats
            ? (stats.new_count ?? 0) + (stats.learn_count ?? 0) + (stats.review_count ?? 0)
            : 0;
          const unseen = unseenMap[currentPath] ?? -1;

          const node: DeckTreeNode = {
            name: parts[i],
            fullName: currentPath,
            due,
            totalDue: due,
            totalUnseen: unseen >= 0 ? unseen : 0,
            totalCards: stats?.total_in_deck ?? 0,
            stats: stats
              ? { new_count: stats.new_count ?? 0, learn_count: stats.learn_count ?? 0, review_count: stats.review_count ?? 0 }
              : null,
            children: [],
            isLeaf: true,
          };
          nodeMap.set(currentPath, node);

          if (i === 0) {
            roots.push(node);
          } else {
            const parent = nodeMap.get(prevPath);
            if (parent) {
              parent.children.push(node);
              parent.isLeaf = false;
            }
          }
        }
      }
    }

    function aggregate(node: DeckTreeNode): { due: number; unseen: number } {
      let totalDue = node.due;
      let totalUnseen = unseenMap[node.fullName] ?? 0;
      if (totalUnseen < 0) totalUnseen = 0;

      for (const child of node.children) {
        const childTotals = aggregate(child);
        totalDue += childTotals.due;
        totalUnseen += childTotals.unseen;
      }

      node.totalDue = totalDue;
      node.totalUnseen = totalUnseen;
      return { due: totalDue, unseen: totalUnseen };
    }

    for (const root of roots) aggregate(root);
    roots.sort((a, b) => b.totalDue - a.totalDue);
    return roots;
  });

  // Persist expanded state
  const STORAGE_KEY = "anki-deck-expanded";
  let expanded = $state<Record<string, boolean>>(
    (() => {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); }
      catch { return {}; }
    })()
  );

  function toggleExpand(fullName: string) {
    expanded[fullName] = !expanded[fullName];
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(expanded)); }
    catch { /* ignore */ }
  }

  let totalCards = $derived(
    Object.values(deckStats).reduce((s, d) => s + (d.total_in_deck ?? 0), 0)
  );

  async function handleSync() {
    syncing = true;
    await syncAnki();
    syncing = false;
  }

  function formatTime(date: Date | null): string {
    if (!date) return "Nie";
    return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }

  async function openAnkiReview(deckName?: string) {
    if (deckName) {
      toastInfo(`Öffne „${deckName}" in Anki…`);
      const ok = await guiDeckReview(deckName);
      if (!ok) toastInfo("Konnte Anki nicht in den Vordergrund bringen.");
    } else {
      const ok = await guiDeckBrowser();
      if (!ok) toastInfo("Konnte Anki nicht öffnen. Ist Anki gestartet?");
    }
  }

  function getBadge(node: DeckTreeNode): { text: string; variant: "due" | "done" | "complete" } {
    const due = node.children.length > 0 ? node.totalDue : node.due;
    if (due > 0) return { text: `${due} fällig`, variant: "due" };
    if (node.totalUnseen === 0) return { text: "abgeschlossen", variant: "complete" };
    return { text: "heute fertig", variant: "done" };
  }
</script>

<!-- Recursive deck tree node -->
{#snippet deckNode(node: DeckTreeNode, depth: number, isLast: boolean)}
  {@const hasChildren = node.children.length > 0}
  {@const isOpen = expanded[node.fullName] ?? false}
  {@const badge = getBadge(node)}
  {@const sortedChildren = [...node.children].sort((a, b) => b.totalDue - a.totalDue)}

  <div class="relative" style="--depth: {depth};">
    <button
      onclick={() => {
        if (hasChildren) toggleExpand(node.fullName);
        else openAnkiReview(node.fullName);
      }}
      class="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left cursor-pointer transition-colors hover:bg-white/5 {depth === 0 ? 'py-2.5' : ''}"
      style="padding-left: calc({depth} * 20px + 12px);"
    >
      <!-- Left: Chevron / dot + name -->
      <div class="flex items-center gap-2 min-w-0">
        {#if hasChildren}
          <div class="w-4 h-4 flex items-center justify-center shrink-0 text-text-muted transition-transform duration-200 {isOpen ? 'rotate-90 text-text-secondary' : ''}">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3.5 2L7 5L3.5 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        {:else}
          <div class="w-4 h-4 flex items-center justify-center shrink-0">
            <div class="w-1 h-1 rounded-full bg-border"></div>
          </div>
        {/if}

        <div class="flex items-baseline gap-2 min-w-0">
          <span class="text-[13px] text-text-primary truncate {hasChildren && depth === 0 ? 'font-semibold text-sm' : ''}">
            {node.name}
          </span>
          {#if node.totalCards > 0}
            <span class="text-[11px] text-text-muted tabular-nums shrink-0">
              {node.totalCards.toLocaleString("de-DE")}
            </span>
          {/if}
        </div>
      </div>

      <!-- Right: Stats + Badge -->
      <div class="flex items-center gap-3 shrink-0 ml-3">
        {#if node.isLeaf && node.stats}
          <div class="flex">
            <span class="w-8 text-center text-[11px] font-medium tabular-nums text-blue-400" title="Neue Karten">{node.stats.new_count}</span>
            <span class="w-8 text-center text-[11px] font-medium tabular-nums text-amber-400" title="Lernkarten">{node.stats.learn_count}</span>
            <span class="w-8 text-center text-[11px] font-medium tabular-nums text-green-400" title="Review">{node.stats.review_count}</span>
          </div>
        {:else if hasChildren}
          <!-- Spacer to keep badges aligned -->
          <div class="w-24"></div>
        {/if}

        <span
          class="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums w-[76px]
            {badge.variant === 'due' ? 'bg-accent/12 text-accent' : ''}
            {badge.variant === 'done' ? 'bg-success/12 text-success' : ''}
            {badge.variant === 'complete' ? 'bg-emerald-500/12 text-emerald-400' : ''}"
        >
          {#if badge.variant === "complete"}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" class="inline-block mr-0.5 -mt-px shrink-0">
              <path d="M2.5 5.5L4.5 7.5L7.5 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          {/if}
          {badge.text}
        </span>
      </div>
    </button>

    <!-- Children -->
    {#if hasChildren && isOpen}
      <div class="relative">
        <!-- Vertical connector line -->
        <div
          class="absolute top-0 bottom-2 pointer-events-none"
          style="left: calc({depth} * 20px + 20px); border-left: 1.5px solid var(--color-border);"
        ></div>
        {#each sortedChildren as child, i}
          {@render deckNode(child, depth + 1, i === sortedChildren.length - 1)}
        {/each}
      </div>
    {/if}
  </div>
{/snippet}


<div class="space-y-5">

  <!-- Header -->
  <div>
    <h2 class="text-2xl font-bold text-text-primary tracking-tight">Anki-Integration</h2>
    <p class="text-sm text-text-secondary mt-0.5">AnkiZin & AnkiPhil High-Yield Karten</p>
  </div>

  <!-- Connection bar -->
  <div class="rounded-xl bg-bg-secondary border border-border p-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="relative">
          <div class="h-2.5 w-2.5 rounded-full {connected ? 'bg-success' : 'bg-danger'}"></div>
          {#if connected}
            <div class="absolute inset-0 h-2.5 w-2.5 rounded-full bg-success animate-ping opacity-40"></div>
          {/if}
        </div>
        <div>
          <div class="text-sm font-medium text-text-primary">
            AnkiConnect {connected ? "Verbunden" : "Nicht verbunden"}
          </div>
          <div class="text-xs text-text-muted">
            localhost:8765 · Zuletzt: {formatTime(lastSynced)}
          </div>
        </div>
      </div>
      <div class="flex gap-2">
        <button
          onclick={() => openAnkiReview()}
          class="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Anki öffnen
        </button>
        <button
          onclick={handleSync}
          disabled={syncing}
          class="rounded-lg bg-white/5 border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          {#if syncing}
            <svg class="inline-block w-3 h-3 mr-1 animate-spin" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="20 10" stroke-linecap="round"/>
            </svg>
          {/if}
          {syncing ? "Sync…" : "Synchronisieren"}
        </button>
      </div>
    </div>
  </div>

  {#if !connected}
    <div class="rounded-xl bg-warning/10 border border-warning/20 p-4">
      <h4 class="text-sm font-medium text-text-primary">Anki nicht erreichbar</h4>
      <p class="mt-1 text-xs text-text-secondary">
        Stelle sicher, dass Anki Desktop geöffnet ist und das AnkiConnect-Plugin installiert ist.
      </p>
      <ol class="mt-2 space-y-1 text-xs text-text-muted list-decimal pl-4">
        <li>Öffne Anki Desktop</li>
        <li>Installiere AnkiConnect (Code: 2055492159)</li>
        <li>Starte Anki neu</li>
      </ol>
    </div>
  {:else}

    <!-- Stats row -->
    <div class="grid grid-cols-3 gap-3">
      <div class="rounded-xl bg-bg-secondary border border-border px-4 py-3.5 text-center">
        <div class="text-2xl font-bold tabular-nums tracking-tight {cardsDue > 0 ? 'text-accent' : 'text-success'}">{cardsDue}</div>
        <div class="text-[11px] text-text-muted mt-0.5 font-medium">Karten fällig</div>
      </div>
      <div class="rounded-xl bg-bg-secondary border border-border px-4 py-3.5 text-center">
        <div class="text-2xl font-bold tabular-nums tracking-tight text-text-primary">{deckNames.length}</div>
        <div class="text-[11px] text-text-muted mt-0.5 font-medium">M2-Decks</div>
      </div>
      <div class="rounded-xl bg-bg-secondary border border-border px-4 py-3.5 text-center">
        <div class="text-2xl font-bold tabular-nums tracking-tight text-text-primary">{totalCards.toLocaleString("de-DE")}</div>
        <div class="text-[11px] text-text-muted mt-0.5 font-medium">Karten gesamt</div>
      </div>
    </div>

    <!-- Review CTA -->
    {#if cardsDue > 0}
      <button
        onclick={() => openAnkiReview()}
        class="w-full flex items-center justify-between rounded-xl border border-accent/20 bg-accent/5 px-4 py-3.5 text-left cursor-pointer transition-all hover:bg-accent/10 hover:border-accent/30 group"
      >
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center text-accent shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 010-5H20"/>
              <path d="M9 10l2 2 4-4"/>
            </svg>
          </div>
          <div>
            <div class="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
              {cardsDue} Karten warten auf dein Review
            </div>
            <div class="text-xs text-text-muted mt-0.5">Klicke um Anki zu öffnen</div>
          </div>
        </div>
        <svg class="w-4 h-4 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
        </svg>
      </button>
    {/if}

    <!-- Deck Tree -->
    <div class="rounded-xl bg-bg-secondary border border-border">
      <div class="flex items-center justify-between px-5 pt-4 pb-3">
        <h3 class="text-sm font-semibold text-text-primary">Erkannte M2-Decks</h3>
        <div class="flex items-center gap-0 text-[10px] text-text-muted/50 font-medium tracking-wide uppercase">
          <span class="w-8 text-center">N</span>
          <span class="w-8 text-center">L</span>
          <span class="w-8 text-center">R</span>
          <span class="w-[76px]"></span>
        </div>
      </div>

      {#if deckTree.length === 0}
        <div class="px-5 pb-5">
          <p class="text-sm text-text-muted">
            Keine M2-Decks gefunden. Stelle sicher, dass AnkiZin oder AnkiPhil installiert sind.
          </p>
        </div>
      {:else}
        <div class="px-2 pb-2">
          {#each deckTree as root, i}
            {@render deckNode(root, 0, i === deckTree.length - 1)}
          {/each}
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <p class="text-[11px] text-text-muted text-center">
      Daten werden alle 5 Min. synchronisiert · Fällige Karten erscheinen auch im Dashboard-Widget
    </p>
  {/if}
</div>
