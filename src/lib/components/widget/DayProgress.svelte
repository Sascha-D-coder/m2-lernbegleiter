<script lang="ts">
  let { dayNumber, totalDays, progressPercent, dateStr } = $props<{
    dayNumber: number;
    totalDays: number;
    progressPercent: number;
    dateStr: string;
  }>();

  let progressColor = $derived(
    progressPercent < 30 ? "bg-danger" :
    progressPercent < 60 ? "bg-warning" :
    "bg-success"
  );
</script>

<div class="flex items-center justify-between">
  <span class="text-sm font-semibold text-text-primary">
    Tag {dayNumber}<span class="text-text-muted font-normal">/{totalDays}</span>
  </span>
  <span class="text-xs text-text-secondary">{dateStr}</span>
</div>
<div class="mt-1 flex items-center gap-2">
  <div class="h-2 flex-1 overflow-hidden rounded-full bg-border">
    <div
      class="h-full rounded-full transition-all duration-700 ease-out {progressColor}"
      style="width: {progressPercent}%"
    ></div>
  </div>
  <span class="text-xs font-medium text-text-secondary tabular-nums">{progressPercent}%</span>
</div>
