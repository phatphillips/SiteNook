<script setup lang="ts">
const model = defineModel<string>({ default: '' })

const props = withDefaults(defineProps<{
  placeholder?: string
  ariaLabel?: string
}>(), {
  placeholder: 'Search…',
  ariaLabel: 'Search'
})

const rootRef = ref<HTMLElement | null>(null)
const expanded = ref(false)
/** Icon-first below lg (tablet + mobile); full field at desktop. */
const isCompact = useMediaQuery('(max-width: 1023px)', { ssrWidth: 1280 })

const showInput = computed(
  () => !isCompact.value || expanded.value || model.value.trim().length > 0
)

watch(showInput, async (show) => {
  if (!show || !isCompact.value) return
  await nextTick()
  rootRef.value?.querySelector('input')?.focus()
})

function openSearch() {
  expanded.value = true
}

function onBlur() {
  if (!model.value.trim()) {
    expanded.value = false
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (!model.value.trim()) {
    expanded.value = false
  }
  ;(event.target as HTMLElement | null)?.blur()
}
</script>

<template>
  <div
    ref="rootRef"
    class="table-search-input shrink-0"
    :class="showInput ? 'table-search-input--expanded' : 'table-search-input--collapsed'"
  >
    <UButton
      v-if="!showInput"
      icon="i-lucide-search"
      color="neutral"
      variant="outline"
      size="sm"
      square
      :aria-label="props.ariaLabel"
      class="aspect-square !px-2"
      :ui="{ base: 'h-8' }"
      @click="openSearch"
    />
    <UInput
      v-else
      v-model="model"
      icon="i-lucide-search"
      :placeholder="props.placeholder"
      :aria-label="props.ariaLabel"
      size="sm"
      class="w-full"
      :ui="{
        root: 'relative inline-flex items-center w-full h-8',
        base: 'h-8 min-h-8 py-0 text-sm text-[var(--input-surface-fg)] bg-[var(--input-surface-bg)] ring-0 border border-[var(--input-surface-border)] placeholder:text-muted hover:bg-[var(--input-surface-hover-bg)]',
        leading: 'ps-2.5',
        leadingIcon: 'size-4 text-muted'
      }"
      @blur="onBlur"
      @keydown="onKeydown"
    />
  </div>
</template>

<style scoped>
.table-search-input--collapsed {
  width: 2rem;
}

.table-search-input--expanded {
  width: 11rem;
  transition: width 160ms ease;
}

@media (min-width: 1024px) {
  .table-search-input--expanded {
    width: 14rem;
  }
}
</style>
