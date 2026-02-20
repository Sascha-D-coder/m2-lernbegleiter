<script lang="ts">
  import {
    isConnected,
    getDeckNamesList,
    getCardsDueCount_,
    getDeckStatsMap,
    getLastSynced,
    syncAnki,
  } from "$lib/stores/ankiStore.svelte";
  let connected = $derived(isConnected());
  let deckNames = $derived(getDeckNamesList());
  let cardsDue = $derived(getCardsDueCount_());
  let deckStats = $derived(getDeckStatsMap());
  let lastSynced = $derived(getLastSynced());
  let syncing = $state(false);

  async function handleSync() {
    syncing = true;
    await syncAnki();
    syncing = false;
  }

  function formatTime(date: Date | null): string {
    if (!date) return "Nie";
    return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
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
      <button
        onclick={handleSync}
        disabled={syncing}
        class="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-white/10 disabled:opacity-50"
      >
        {syncing ? "Synchronisiere..." : "Jetzt synchronisieren"}
      </button>
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
        <div class="text-2xl font-bold text-accent">{cardsDue}</div>
        <div class="text-xs text-text-muted">Karten fällig</div>
      </div>
      <div class="rounded-xl bg-bg-secondary border border-border p-4 text-center">
        <div class="text-2xl font-bold text-text-primary">{deckNames.length}</div>
        <div class="text-xs text-text-muted">M2-Decks gefunden</div>
      </div>
      <div class="rounded-xl bg-bg-secondary border border-border p-4 text-center">
        <div class="text-2xl font-bold text-text-primary">
          {Object.values(deckStats).reduce((s, d) => s + (d.total_in_deck ?? 0), 0)}
        </div>
        <div class="text-xs text-text-muted">Karten gesamt</div>
      </div>
    </div>

    <!-- Deck List -->
    <div class="rounded-xl bg-bg-secondary border border-border p-5">
      <h3 class="text-base font-semibold text-text-primary mb-4">Erkannte M2-Decks</h3>
      {#if deckNames.length === 0}
        <p class="text-sm text-text-muted">
          Keine M2-Decks gefunden. Stelle sicher, dass AnkiZin oder AnkiPhil installiert sind.
        </p>
      {:else}
        <div class="space-y-2">
          {#each deckNames as deck}
            {@const stats = deckStats[deck]}
            <div class="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
              <div>
                <div class="text-sm font-medium text-text-primary">{deck}</div>
                {#if stats}
                  <div class="text-xs text-text-muted">
                    {stats.total_in_deck ?? 0} Karten
                  </div>
                {/if}
              </div>
              {#if stats}
                <div class="flex gap-4 text-xs">
                  <div class="text-center">
                    <div class="font-medium text-blue-400">{stats.new_count ?? 0}</div>
                    <div class="text-text-muted">Neu</div>
                  </div>
                  <div class="text-center">
                    <div class="font-medium text-amber-400">{stats.learn_count ?? 0}</div>
                    <div class="text-text-muted">Lernen</div>
                  </div>
                  <div class="text-center">
                    <div class="font-medium text-green-400">{stats.review_count ?? 0}</div>
                    <div class="text-text-muted">Review</div>
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Info -->
    <div class="rounded-xl bg-accent/10 border border-accent/20 p-4">
      <h4 class="text-sm font-medium text-text-primary">Auto-Sync aktiv</h4>
      <p class="text-xs text-text-secondary">
        Anki-Daten werden alle 5 Minuten automatisch synchronisiert. Die Karten-Anzahl wird auch im Widget angezeigt.
      </p>
    </div>
  {/if}
</div>
