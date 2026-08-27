<script setup lang="ts">
const props = defineProps<{
  /** Public path under /marketing/screenshots/, e.g. accessibility.png */
  src?: string
  title: string
  caption: string
  alt: string
}>()

const imageSrc = computed(() => {
  const file = props.src?.trim()
  if (!file) return null
  return file.startsWith('/') ? file : `/marketing/screenshots/${file}`
})

const imageFailed = ref(false)

watch(imageSrc, () => {
  imageFailed.value = false
})

const showPlaceholder = computed(() => !imageSrc.value || imageFailed.value)
</script>

<template>
  <figure class="overflow-hidden rounded-xl border border-dashed border-default bg-elevated/40">
    <div class="relative aspect-[16/10] w-full">
      <img
        v-if="!showPlaceholder && imageSrc"
        :src="imageSrc"
        :alt="alt"
        class="size-full object-cover object-top"
        @error="imageFailed = true"
      >
      <div
        v-else
        class="flex size-full flex-col items-center justify-center gap-2 bg-elevated/60 px-6 text-center"
        role="img"
        :aria-label="`Screenshot placeholder: ${title}`"
      >
        <UIcon name="i-lucide-image" class="size-10 text-muted" />
        <p class="text-sm font-medium text-highlighted">
          Screenshot: {{ title }}
        </p>
        <p class="max-w-sm text-xs text-muted">
          Drop an image at
          <code class="rounded bg-elevated px-1 py-0.5">public/marketing/screenshots/{{ src || 'your-file.png' }}</code>
        </p>
      </div>
    </div>
    <figcaption class="border-t border-default/60 px-4 py-3 text-sm text-muted">
      {{ caption }}
    </figcaption>
  </figure>
</template>
