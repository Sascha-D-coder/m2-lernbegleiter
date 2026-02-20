<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  let { children } = $props();

  // Default to light theme; components will override once settings load
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", "light");
  }
</script>

{@render children()}
