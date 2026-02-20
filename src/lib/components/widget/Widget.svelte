<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import DayProgress from "./DayProgress.svelte";
  import QuickStats from "./QuickStats.svelte";

  let todaySummary = $state({
    day_number: 1,
    total_days: 88,
    subject: "Pharmakologie",
    sub_topic: "Grundlagen",
    progress_percent: 0,
    anki_due: 0,
    streak: 0,
    reading_done: false,
    kreuzen_done: false,
    kreuzen_target: 80,
  });

  let isMinimal = $state(false);

  async function openDashboard() {
    await invoke("toggle_dashboard");
  }

  async function closeWidget() {
    const window = getCurrentWindow();
    await window.hide();
  }

  function toggleMinimal() {
    isMinimal = !isMinimal;
  }

  // Format today's date in German
  const today = new Date();
  const dateStr = today.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  $effect(() => {
    invoke("get_today_summary").then((result) => {
      if (typeof result === "string") {
        todaySummary = JSON.parse(result);
      }
    });
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="widget-container"
  data-tauri-drag-region
>
  {#if isMinimal}
    <!-- Minimal Mode -->
    <div class="flex items-center justify-between px-3 py-2">
      <div class="flex items-center gap-2">
        <span class="text-xs text-text-secondary">Tag {todaySummary.day_number}/{todaySummary.total_days}</span>
        <div class="h-2 w-24 overflow-hidden rounded-full bg-border">
          <div
            class="h-full rounded-full bg-accent transition-all duration-500"
            style="width: {todaySummary.progress_percent}%"
          ></div>
        </div>
        <span class="text-xs text-text-muted">{todaySummary.progress_percent}%</span>
      </div>
      <div class="flex gap-1">
        <button onclick={toggleMinimal} class="widget-btn" title="Erweitern">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
        </button>
        <button onclick={closeWidget} class="widget-btn" title="Ausblenden">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
  {:else}
    <!-- Full Widget -->
    <div class="flex items-center justify-between px-3 pt-2 pb-1" data-tauri-drag-region>
      <span class="text-[11px] font-medium text-text-muted tracking-wide uppercase">M2 Lernbegleiter</span>
      <div class="flex gap-1">
        <button onclick={toggleMinimal} class="widget-btn" title="Minimieren">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button onclick={openDashboard} class="widget-btn" title="Dashboard">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
        </button>
        <button onclick={closeWidget} class="widget-btn" title="Ausblenden">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>

    <div class="px-3 pb-1">
      <DayProgress
        dayNumber={todaySummary.day_number}
        totalDays={todaySummary.total_days}
        progressPercent={todaySummary.progress_percent}
        {dateStr}
      />
    </div>

    <div class="px-3 pb-1">
      <div class="text-sm font-medium text-text-primary">
        Heute: {todaySummary.subject}
        {#if todaySummary.sub_topic}
          <span class="text-text-secondary">– {todaySummary.sub_topic}</span>
        {/if}
      </div>
    </div>

    <div class="flex items-center gap-3 px-3 pb-1">
      <label class="flex cursor-pointer items-center gap-1.5 text-xs text-text-secondary">
        <input type="checkbox" checked={todaySummary.reading_done} class="checkbox" />
        Kapitel lesen
      </label>
      <label class="flex cursor-pointer items-center gap-1.5 text-xs text-text-secondary">
        <input type="checkbox" checked={todaySummary.kreuzen_done} class="checkbox" />
        {todaySummary.kreuzen_target} Fragen kreuzen
      </label>
    </div>

    <div class="px-3 pb-2">
      <QuickStats ankiDue={todaySummary.anki_due} streak={todaySummary.streak} />
    </div>
  {/if}
</div>

<style>
  .widget-container {
    background: var(--color-bg-widget);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(12px);
    overflow: hidden;
    height: 100vh;
  }

  .widget-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }
  .widget-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-text-primary);
  }

  .checkbox {
    appearance: none;
    width: 14px;
    height: 14px;
    border: 1.5px solid var(--color-text-muted);
    border-radius: 3px;
    background: transparent;
    cursor: pointer;
    transition: all 0.15s;
  }
  .checkbox:checked {
    background: var(--color-accent);
    border-color: var(--color-accent);
  }
  .checkbox:checked::after {
    content: "✓";
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: white;
    line-height: 1;
  }
</style>
