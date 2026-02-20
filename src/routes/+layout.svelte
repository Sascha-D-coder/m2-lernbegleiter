<script lang="ts">
  import "../app.css";
  let { children } = $props();

  // Default to light theme; components will override once settings load.
  // Widget route keeps transparent background for rounded corners.
  if (typeof document !== "undefined") {
    const isWidget = window.location.pathname === "/" || window.location.pathname === "";
    document.documentElement.setAttribute("data-theme", "light");
    if (isWidget) {
      document.documentElement.classList.add("widget-window");
    }
  }
</script>

{@render children()}
