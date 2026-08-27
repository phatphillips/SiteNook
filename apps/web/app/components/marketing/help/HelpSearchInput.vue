<script setup lang="ts">
const model = defineModel<string>({ default: '' })

const props = withDefaults(defineProps<{
  placeholder?: string
  loading?: boolean
}>(), {
  placeholder: 'Search help articles…',
  loading: false
})

const inputId = useId()
</script>

<template>
  <div class="relative w-full">
    <label
      :for="inputId"
      class="sr-only"
    >Search help</label>
    <UInput
      :id="inputId"
      v-model="model"
      size="xl"
      :placeholder="props.placeholder"
      icon="i-lucide-search"
      :loading="props.loading"
      autocomplete="off"
      class="w-full"
      :ui="{
        base: 'text-base sm:text-lg py-3'
      }"
    />
  </div>
</template>
