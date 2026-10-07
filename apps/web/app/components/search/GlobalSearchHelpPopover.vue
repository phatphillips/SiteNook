<script setup lang="ts">
const open = ref(false)
</script>

<template>
  <UPopover v-model:open="open">
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-info"
      aria-label="Search help"
    />
    <template #content>
      <div class="max-w-sm space-y-3 p-4">
        <p class="text-sm font-medium text-default">
          How search works
        </p>
        <ul class="list-disc pl-5 space-y-1.5 text-sm text-muted">
          <li>Searches the latest crawl per URL. Results update after each scan.</li>
          <li>Indexed content includes page text, URLs, PDF body, and outbound links.</li>
          <li>Use link text or a URL fragment. Not a full HTML tag from DevTools.</li>
          <li>
            <strong class="font-medium text-default">Exact</strong>. Phrase as indexed;
            <strong class="font-medium text-default">Contains</strong>. Partial match;
            <strong class="font-medium text-default">Regex</strong>. Short patterns only.
          </li>
          <li>
            To find pages linking to a URL on one site, use
            <strong class="font-medium text-default">QA → Broken links</strong>.
          </li>
        </ul>
      </div>
    </template>
  </UPopover>
</template>
