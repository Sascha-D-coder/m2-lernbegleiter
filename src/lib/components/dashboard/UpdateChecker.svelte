<script lang="ts">
  import { check } from "@tauri-apps/plugin-updater";

  let updateAvailable = $state(false);
  let updateVersion = $state("");
  let updateNotes = $state("");
  let downloading = $state(false);
  let downloadProgress = $state(0);
  let error = $state("");
  let dismissed = $state(false);

  let updateObj: Awaited<ReturnType<typeof check>> | null = null;

  $effect(() => {
    checkForUpdate();
  });

  async function checkForUpdate() {
    try {
      const update = await check();
      if (update) {
        updateObj = update;
        updateAvailable = true;
        updateVersion = update.version;
        updateNotes = update.body ?? "";
      }
    } catch (e) {
      // Silently fail - no update server available or offline
      console.log("Update check skipped:", e);
    }
  }

  async function installUpdate() {
    if (!updateObj) return;
    downloading = true;
    error = "";
    try {
      let totalBytes = 0;
      let downloadedBytes = 0;
      await updateObj.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data.contentLength) {
          totalBytes = event.data.contentLength;
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          if (totalBytes > 0) {
            downloadProgress = Math.round((downloadedBytes / totalBytes) * 100);
          }
        } else if (event.event === "Finished") {
          downloadProgress = 100;
        }
      });
      // The app will restart automatically after install
    } catch (e) {
      error = e instanceof Error ? e.message : "Update fehlgeschlagen";
      downloading = false;
    }
  }

  function dismiss() {
    dismissed = true;
  }
</script>

{#if updateAvailable && !dismissed}
  <div class="mx-4 mb-3 rounded-lg bg-accent/10 border border-accent/25 p-3">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <div class="text-xs font-semibold text-accent">
          Update verfügbar: v{updateVersion}
        </div>
        {#if updateNotes}
          <p class="text-[10px] text-text-muted mt-0.5 line-clamp-2">{updateNotes}</p>
        {/if}
      </div>
      <button onclick={dismiss} class="text-text-muted hover:text-text-primary text-sm shrink-0">
        &times;
      </button>
    </div>

    {#if downloading}
      <div class="mt-2">
        <div class="h-1.5 overflow-hidden rounded-full bg-border">
          <div
            class="h-full rounded-full bg-accent transition-all duration-300"
            style="width: {downloadProgress}%"
          ></div>
        </div>
        <div class="text-[10px] text-text-muted mt-1">
          {downloadProgress}% – App wird nach Download neu gestartet...
        </div>
      </div>
    {:else}
      <div class="flex gap-2 mt-2">
        <button
          onclick={installUpdate}
          class="rounded-md bg-accent px-3 py-1 text-[11px] font-medium text-white hover:bg-accent-hover transition-colors"
        >
          Jetzt aktualisieren
        </button>
        <button
          onclick={dismiss}
          class="rounded-md border border-border px-3 py-1 text-[11px] text-text-muted hover:text-text-primary transition-colors"
        >
          Später
        </button>
      </div>
    {/if}

    {#if error}
      <div class="mt-1.5 text-[10px] text-danger">{error}</div>
    {/if}
  </div>
{/if}
