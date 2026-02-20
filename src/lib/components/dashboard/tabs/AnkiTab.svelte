<script lang="ts">
  let connected = $state(false);

  async function checkConnection() {
    try {
      const response = await fetch("http://localhost:8765", {
        method: "POST",
        body: JSON.stringify({ action: "version", version: 6 }),
      });
      const data = await response.json();
      connected = data.result != null;
    } catch {
      connected = false;
    }
  }

  $effect(() => {
    checkConnection();
  });
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
          <div class="text-xs text-text-muted">localhost:8765</div>
        </div>
      </div>
      <button
        onclick={checkConnection}
        class="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-white/10"
      >
        Verbindung testen
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
    <div class="rounded-xl bg-bg-secondary border border-border p-8 text-center">
      <div class="text-4xl mb-3">🃏</div>
      <h3 class="text-lg font-semibold text-text-primary">Anki verbunden!</h3>
      <p class="text-sm text-text-muted mt-2">
        Detaillierte Deck-Statistiken und High-Yield Tracking werden in Phase 3 implementiert.
      </p>
    </div>
  {/if}
</div>
