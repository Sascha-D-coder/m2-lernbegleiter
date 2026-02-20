<script lang="ts">
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { invoke } from "@tauri-apps/api/core";
  import { getTodayCalendarDay, getTodayAmbossDay, getProgressPercent, getCurrentDayNumber, getTotalStudyDays, isPlanGenerated, loadAmbossDays, setCalendarDays } from "$lib/stores/planStore.svelte";
  import { loadSettings, getSettings } from "$lib/stores/settingsStore.svelte";
  import { getCardsDueCount_, startPolling } from "$lib/stores/ankiStore.svelte";
  import { initNotifications, stopNotifications } from "$lib/services/notificationService";
  import { buildStudyPlan } from "$lib/utils/planEngine";
  import type { AmbossDay } from "$lib/utils/planEngine";
  import { getDb } from "$lib/api/db";
  import DayProgress from "./DayProgress.svelte";
  import QuickStats from "./QuickStats.svelte";

  // Derived reactive values from stores
  let todayAmboss = $derived(getTodayAmbossDay());
  let todayCalDay = $derived(getTodayCalendarDay());
  let dayNumber = $derived(getCurrentDayNumber());
  let totalDays = $derived(getTotalStudyDays());
  let progressPercent = $derived(getProgressPercent());
  let ankiDue = $derived(getCardsDueCount_());
  let planReady = $derived(isPlanGenerated());

  // Local state
  let isMinimal = $state(false);
  let streak = $state(0);
  let readingDone = $state(false);
  let kreuzenDone = $state(false);

  // Format today's date in German
  const today = new Date();
  const dateStr = today.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  // Initialize app on mount
  $effect(() => {
    initializeApp();
  });

  async function initializeApp() {
    await loadSettings();
    await loadAmbossDays();

    // If amboss days loaded but plan not generated, build it
    const settings = getSettings();
    if (!isPlanGenerated()) {
      try {
        const resp = await fetch('/amboss-plan.json');
        const days: AmbossDay[] = await resp.json();
        const calendar = buildStudyPlan(days, {
          examDate: settings.examDate,
          semesterEndDate: settings.semesterEndDate,
          juneVacation: { start: settings.juneVacationStart, end: settings.juneVacationEnd },
          septVacation: { start: settings.septVacationStart, end: settings.septVacationEnd },
          weekendsOff: settings.weekendsOff,
          semesterHoursPerDay: settings.semesterHoursPerDay,
          fulltimeHoursPerDay: settings.fulltimeHoursPerDay,
          pharmaPrioritized: settings.pharmaPrioritized,
        });
        setCalendarDays(calendar);
      } catch (err) {
        console.error("Failed to build plan:", err);
      }
    }

    startPolling();
    initNotifications();
    await loadStreak();
    await loadTodayProgress();
  }

  // Cleanup notification polling when component is destroyed
  $effect(() => {
    return () => {
      stopNotifications();
    };
  });

  async function loadStreak() {
    try {
      const db = await getDb();
      const rows = await db.select<Record<string,unknown>[]>(
        "SELECT current_streak FROM streaks WHERE id = 1"
      );
      if (rows.length > 0) {
        streak = (rows[0].current_streak as number) ?? 0;
      }
    } catch {
      // DB not ready yet
    }
  }

  async function loadTodayProgress() {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const db = await getDb();
      const rows = await db.select<Record<string,unknown>[]>(
        "SELECT * FROM daily_progress WHERE date = ?", [todayStr]
      );
      if (rows.length > 0) {
        readingDone = Boolean(rows[0].reading_completed);
        kreuzenDone = Boolean(rows[0].kreuzen_completed);
      }
    } catch {
      // DB not ready yet
    }
  }

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
        {#if planReady}
          <span class="text-xs text-text-secondary">Tag {dayNumber}/{totalDays}</span>
          <div class="h-2 w-24 overflow-hidden rounded-full bg-border">
            <div
              class="h-full rounded-full bg-accent transition-all duration-500"
              style="width: {progressPercent}%"
            ></div>
          </div>
          <span class="text-xs text-text-muted">{progressPercent}%</span>
        {:else}
          <span class="text-xs text-text-secondary">Kein Plan</span>
        {/if}
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

    {#if planReady}
      <div class="px-3 pb-1">
        <DayProgress
          {dayNumber}
          {totalDays}
          {progressPercent}
          {dateStr}
        />
      </div>

      <div class="px-3 pb-1">
        <div class="text-sm font-medium text-text-primary">
          {#if todayAmboss}
            Heute: {todayAmboss.subject}
            {#if todayAmboss.sub_topic}
              <span class="text-text-secondary">– {todayAmboss.sub_topic}</span>
            {/if}
          {:else}
            <span class="text-text-secondary">Kein Thema heute</span>
          {/if}
        </div>
      </div>

      <div class="flex items-center gap-3 px-3 pb-1">
        <label class="flex cursor-pointer items-center gap-1.5 text-xs text-text-secondary">
          <input type="checkbox" checked={readingDone} class="checkbox" disabled />
          Kapitel lesen
        </label>
        <label class="flex cursor-pointer items-center gap-1.5 text-xs text-text-secondary">
          <input type="checkbox" checked={kreuzenDone} class="checkbox" disabled />
          {todayAmboss?.question_count ?? 80} Fragen kreuzen
        </label>
      </div>

      <div class="px-3 pb-2">
        <QuickStats ankiDue={ankiDue} {streak} />
      </div>
    {:else}
      <div class="px-3 pb-2 text-center py-3">
        <div class="text-xs text-text-muted">Kein Plan generiert</div>
        <button onclick={openDashboard} class="mt-1 text-xs text-accent hover:underline">
          Dashboard öffnen
        </button>
      </div>
    {/if}
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
    content: "\2713";
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: white;
    line-height: 1;
  }
</style>
