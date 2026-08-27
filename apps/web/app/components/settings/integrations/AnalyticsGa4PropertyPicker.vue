<script setup lang="ts">
const props = defineProps<{
  open: boolean
  properties: Array<{ id: string, label: string }>
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [property: { id: string, label: string }]
}>()

const selected = ref('')

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) selected.value = props.properties[0]?.id || ''
  }
)

function onConfirm() {
  const property = props.properties.find((p) => p.id === selected.value)
  if (!property) return
  emit('select', property)
}
</script>

<template>
  <UModal
    :open="open"
    :ui="{ content: 'sm:max-w-md' }"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div class="p-4 sm:p-6 space-y-4">
        <div>
          <h2 class="font-semibold text-lg">
            Choose a GA4 property
          </h2>
          <p class="text-sm text-muted mt-1">
            Select which Google Analytics 4 property to sync for this SiteNook site.
          </p>
        </div>

        <div
          v-if="loading"
          class="flex items-center gap-2 text-sm text-muted"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="size-4 animate-spin motion-reduce:animate-none"
          />
          Loading properties…
        </div>

        <UFormField
          v-else
          label="Property"
          required
        >
          <USelectMenu
            v-model="selected"
            value-key="value"
            :items="properties.map((p) => ({ label: p.label, value: p.id }))"
            class="w-full"
            placeholder="Select a property"
          />
        </UFormField>

        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            @click="emit('update:open', false)"
          >
            Cancel
          </UButton>
          <UButton
            color="neutral"
            :disabled="!selected || loading"
            @click="onConfirm"
          >
            Save property
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
