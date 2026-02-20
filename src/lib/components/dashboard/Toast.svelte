<script lang="ts">
  import { getToasts, removeToast, type ToastType } from "$lib/stores/toastStore.svelte";

  let toasts = $derived(getToasts());

  function iconForType(type: ToastType): string {
    switch (type) {
      case "info": return "ℹ️";
      case "success": return "✅";
      case "warning": return "⚠️";
      case "error": return "❌";
    }
  }

  function bgForType(type: ToastType): string {
    switch (type) {
      case "info": return "bg-accent/15 border-accent/30 text-accent";
      case "success": return "bg-success/15 border-success/30 text-success";
      case "warning": return "bg-warning/15 border-warning/30 text-warning";
      case "error": return "bg-danger/15 border-danger/30 text-danger";
    }
  }
</script>

{#if toasts.length > 0}
  <div class="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
    {#each toasts as toast (toast.id)}
      <div
        class="flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 shadow-lg backdrop-blur-sm {bgForType(toast.type)} animate-slide-in"
      >
        <span class="text-sm shrink-0 mt-0.5">{iconForType(toast.type)}</span>
        <p class="text-xs font-medium leading-relaxed flex-1">{toast.message}</p>
        <button
          onclick={() => removeToast(toast.id)}
          class="text-current opacity-50 hover:opacity-100 text-sm leading-none shrink-0 mt-0.5"
        >
          &times;
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .animate-slide-in {
    animation: slideIn 0.25s ease-out;
  }
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
