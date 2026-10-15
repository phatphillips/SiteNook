<script setup lang="ts">
const props = defineProps<{
  uploading?: boolean
  maxFiles?: number
  maxFileSizeMb?: number
  /** When set, show a site picker for org-scoped upload. */
  siteOptions?: Array<{ label: string, value: string }>
  requireSite?: boolean
}>()

const emit = defineEmits<{
  upload: [files: File[]]
}>()

const siteId = defineModel<string>('siteId', { default: '' })

const fileInput = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)

const maxFiles = computed(() => props.maxFiles ?? 10)
const maxFileSizeMb = computed(() => props.maxFileSizeMb ?? 20)
const showSiteSelect = computed(() => (props.siteOptions?.length ?? 0) > 0)
const canUpload = computed(() => !props.requireSite || !!siteId.value)

function onBrowse() {
  if (!canUpload.value) return
  fileInput.value?.click()
}

function onInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files ? [...input.files] : []
  if (files.length) emit('upload', files)
  input.value = ''
}

function onDrop(event: DragEvent) {
  dragOver.value = false
  if (!canUpload.value) return
  const files = [...(event.dataTransfer?.files ?? [])]
  if (files.length) emit('upload', files)
}
</script>

<template>
  <div class="rounded-lg border border-default bg-elevated p-4 sm:p-5 space-y-3">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <h2 class="text-base font-semibold text-highlighted">
        Upload PDFs
      </h2>
      <div
        v-if="showSiteSelect"
        class="min-w-[14rem]"
      >
        <label class="mb-1 block text-xs font-medium text-muted">
          Upload to site
        </label>
        <USelectMenu
          v-model="siteId"
          value-key="value"
          :items="siteOptions"
          placeholder="Select a site…"
          :search-input="{ placeholder: 'Search sites…' }"
        />
      </div>
    </div>
    <div
      class="rounded-lg border-2 border-dashed bg-elevated p-6 text-center transition-colors sm:p-8"
      :class="dragOver && canUpload ? 'border-primary bg-primary/5' : 'border-default'"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <UIcon
        name="i-lucide-file-text"
        class="mx-auto mb-3 size-8 text-primary"
      />
      <p class="text-sm font-medium text-highlighted">
        Drag and drop to upload files
      </p>
      <p class="mt-1 text-sm text-muted">
        Upload up to {{ maxFiles }} files, maximum file size: {{ maxFileSizeMb }}MB
      </p>
      <p
        v-if="requireSite && !siteId"
        class="mt-2 text-sm text-warning"
      >
        Choose a site before uploading.
      </p>
      <UButton
        class="mt-4"
        color="neutral"
        variant="outline"
        :loading="uploading"
        :disabled="!canUpload"
        @click="onBrowse"
      >
        Browse files
      </UButton>
      <input
        ref="fileInput"
        type="file"
        accept="application/pdf,.pdf"
        multiple
        class="hidden"
        @change="onInputChange"
      >
    </div>
  </div>
</template>
