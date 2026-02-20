<script lang="ts">
  let { ankiDue, streak } = $props<{
    ankiDue: number;
    streak: number;
  }>();
</script>

<div class="flex items-center justify-between text-xs text-text-secondary">
  <div class="flex items-center gap-1">
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 7v10M12 7v10M16 7v10"/></svg>
    <span>Anki: <span class="text-text-primary font-medium">{ankiDue}</span> fällig</span>
  </div>
  <div class="flex items-center gap-1">
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>
    <span>Streak: <span class="text-text-primary font-medium">{streak}</span> Tage</span>
  </div>
</div>
