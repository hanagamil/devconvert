<script setup lang="ts">
defineProps<{
  activeTool: 'csv' | 'excel'
}>()
</script>

<template>
  <main class="page-shell">
    <header class="site-header">
      <a class="brand" href="/" aria-label="DevConvert home">
        <span class="brand-mark">{ }</span>
        <span>DevConvert</span>
      </a>
      <nav class="tool-nav" aria-label="Developer tools">
        <a href="/" :class="{ active: activeTool === 'csv' }" :aria-current="activeTool === 'csv' ? 'page' : undefined">JSON to CSV</a>
        <a href="/json-to-excel.html" :class="{ active: activeTool === 'excel' }" :aria-current="activeTool === 'excel' ? 'page' : undefined">JSON to Excel</a>
      </nav>
      <span class="privacy-pill"><span class="privacy-dot"></span> Runs in your browser</span>
    </header>

    <slot />

    <footer class="site-footer">
      <span>DevConvert</span>
      <span>Simple tools for everyday developer workflows.</span>
      <nav aria-label="Footer">
        <a :href="activeTool === 'csv' ? '#about' : '/#about'">About</a>
        <a :href="activeTool === 'csv' ? '#privacy' : '/#privacy'">Privacy Policy</a>
      </nav>
    </footer>
  </main>
</template>
