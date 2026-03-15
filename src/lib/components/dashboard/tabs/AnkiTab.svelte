<script lang="ts">
  import {
    isConnected,
    getDeckNamesList,
    getCardsDueCount_,
    getDeckStatsMap,
    getLastSynced,
    syncAnki,
  } from "$lib/stores/ankiStore.svelte";
  import { toastInfo } from "$lib/stores/toastStore.svelte";

  let connected = $derived(isConnected());
  let deckNames = $derived(getDeckNamesList());
  let cardsDue = $derived(getCardsDueCount_());
  let deckStats = $derived(getDeckStatsMap());
  let lastSynced = $derived(getLastSynced());
  let syncing = $state(false);

  // Compute due per deck (new + learn + review)
  let deckDueList = $derived.by(() => {
    return deckNames.map(deck => {
      const stats = deckStats[deck];
      const due = stats ? (stats.new_count ?? 0) + (stats.learn_count ?? 0) + (stats.review_count ?? 0) : 0;
      return { name: deck, stats, due };
    }).sort((a, b) => b.due - a.due);
  });

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
    // AnkiConnect: guiDeckBrowser opens the deck browser, or guiCurrentCard
    // Best UX: just tell user to open Anki since we can't launch it from here
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      // Open Anki via its custom URL scheme if available, fallback to info toast
      if (deckName) {
        toastInfo(`Öffne "${deckName}" in Anki...`);
      } else {
        toastInfo("Öffne Anki-Review...");
      }
      await openUrl("anki://");
    } catch {
      toastInfo("Bitte öffne Anki Desktop manuell und starte dein Review.");
    }
  }
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold text-text-primary">Anki-Integration</h2>
    <p class="text-sm text-text-secondary">AnkiZin & AnkiPhil High-Yield Karten</p>
  </div>

  <!-- Connection Status -->
  <div class="rounded-xl bg-bg-secondary border border-border p-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="h-3 w-3 rounded-full {connected ? 'bg-success' : 'bg-danger'}"></div>
        <div>
          <div class="text-sm font-medium text-text-primary">
            AnkiConnect {connected ? "Verbunden" : "Nicht verbunden"}
          </div>
          <div class="text-xs text-text-muted">
            localhost:8765 &middot; Zuletzt: {formatTime(lastSynced)}
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
          class="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          {syncing ? "Sync..." : "Synchronisieren"}
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
    <!-- Overview Cards -->
    <div class="grid grid-cols-3 gap-4">
      <div class="rounded-xl bg-bg-secondary border border-border p-4 text-center">
        <div class="text-2xl font-bold {cardsDue > 0 ? 'text-accent' : 'text-success'}">{cardsDue}</div>
        <div class="text-xs text-text-muted">Karten fällig</div>
      </div>
      <div class="rounded-xl bg-bg-secondary border border-border p-4 text-center">
        <div class="text-2xl font-bold text-text-primary">{deckNames.length}</div>
        <div class="text-xs text-text-muted">M2-Decks</div>
      </div>
      <div class="rounded-xl bg-bg-secondary border border-border p-4 text-center">
        <div class="text-2xl font-bold text-text-primary">{totalCards}</div>
        <div class="text-xs text-text-muted">Karten gesamt</div>
      </div>
    </div>

    {#if cardsDue > 0}
      <button
        onclick={() => openAnkiReview()}
        class="w-full rounded-xl bg-accent/10 border border-accent/20 p-4 text-left hover:bg-accent/15 transition-colors cursor-pointer group"
      >
        <div class="flex items-center justify-between">
          <div>
            <h4 class="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
              {cardsDue} Karten warten auf dein Review
            </h4>
            <p class="text-xs text-text-secondary mt-0.5">Klicke hier um Anki zu öffnen und dein tägliches Review zu starten</p>
          </div>
          <svg class="w-5 h-5 text-accent" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </div>
      </button>
    {/if}

    <!-- Deck List with due cards per deck -->
    <div class="rounded-xl bg-bg-secondary border border-border p-5">
      <h3 class="text-base font-semibold text-text-primary mb-4">Erkannte M2-Decks</h3>
      {#if deckNames.length === 0}
        <p class="text-sm text-text-muted">
          Keine M2-Decks gefunden. Stelle sicher, dass AnkiZin oder AnkiPhil installiert sind.
        </p>
      {:else}
        <div class="space-y-2">
          {#each deckDueList as deck}
            <button
              onclick={() => openAnkiReview(deck.name)}
              class="w-full flex items-center justify-between rounded-lg bg-white/5 px-4 py-3 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <div class="min-w-0">
                <div class="text-sm font-medium text-text-primary truncate">{deck.name}</div>
                {#if deck.stats}
                  <div class="text-xs text-text-muted">
                    {deck.stats.total_in_deck ?? 0} Karten
                  </div>
                {/if}
              </div>
              <div class="flex items-center gap-4">
                {#if deck.stats}
                  <div class="flex gap-3 text-xs">
                    <div class="text-center">
                      <div class="font-medium text-blue-400">{deck.stats.new_count ?? 0}</div>
                      <div class="text-text-muted">Neu</div>
                    </div>
                    <div class="text-center">
                      <div class="font-medium text-amber-400">{deck.stats.learn_count ?? 0}</div>
                      <div class="text-text-muted">Lernen</div>
                    </div>
                    <div class="text-center">
                      <div class="font-medium text-green-400">{deck.stats.review_count ?? 0}</div>
                      <div class="text-text-muted">Review</div>
                    </div>
                  </div>
                {/if}
                {#if deck.due > 0}
                  <span class="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                    {deck.due} fällig
                  </span>
                {:else}
                  <span class="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
                    fertig
                  </span>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Info -->
    <div class="rounded-xl bg-bg-primary border border-border/50 p-4">
      <p class="text-xs text-text-muted">
        Anki-Daten werden alle 5 Minuten automatisch synchronisiert. Die fälligen Karten werden auch im Widget angezeigt.
      </p>
    </div>
  {/if}
</div>
