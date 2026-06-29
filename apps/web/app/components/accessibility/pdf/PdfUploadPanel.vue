<script setup lang="ts">
const props = defineProps<{
  uploading?: boolean
  maxFiles?: number
  maxFileSizeMb?: number
}>()

const emit = defineEmits<{
  upload: [files: File[]]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)

function onBrowse() {
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
  const files = [...(event.dataTransfer?.files ?? [])]
  if (files.length) emit('upload', files)
}

const maxFiles = computed(() => props.maxFiles ?? 10)
const maxFileSizeMb = computed(() => props.maxFileSizeMb ?? 20)
</script>

<template>
  <div class="rounded-xl border border-default bg-elevated p-5 space-y-2">
    <h2 class="text-base font-semibold text-highlighted">
      Upload PDFs
    </h2>
    <div
      class="rounded-lg border-2 border-dashed p-10 text-center transition-colors"
      :class="dragOver ? 'border-primary bg-primary/5' : 'border-primary/40'"
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
      <UButton
        class="mt-4"
        color="neutral"
        variant="outline"
        :loading="uploading"
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
