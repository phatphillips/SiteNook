<script setup lang="ts">
import {
  HANDOFF_COMMON_TASKS,
  HANDOFF_DEFAULT_PROMPTS,
  HANDOFF_PROMPT_MAX_WORDS,
  HANDOFF_SECTION_LABELS,
  type HandoffSectionId,
  matchCommonTask,
  promptWordStatus
} from '~/utils/handoffSectionPrompts'

const props = defineProps<{
  section: HandoffSectionId
  activePrompt: string
  history: string[]
  usingDefault: boolean
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  save: [prompt: string]
  reset: []
}>()

type TaskPick = 'create' | string

const selectedTaskId = ref<TaskPick>('create')
const draft = ref('')
const saving = ref(false)
const historyOpen = ref(false)
const syncingDraft = ref(false)

const commonTasks = computed(() => HANDOFF_COMMON_TASKS[props.section])
const wordStatus = computed(() => promptWordStatus(draft.value))
const canSave = computed(() => draft.value.trim().length > 0 && !wordStatus.value.overMax)

function setDraft(value: string) {
  syncingDraft.value = true
  draft.value = value
  nextTick(() => {
    syncingDraft.value = false
  })
}

function initFromProps() {
  const matched = matchCommonTask(props.section, props.activePrompt)
  if (matched) {
    selectedTaskId.value = matched.id
    setDraft(matched.prompt)
  } else if (props.usingDefault) {
    const first = commonTasks.value[0]
    selectedTaskId.value = first?.id ?? 'create'
    setDraft(first?.prompt ?? HANDOFF_DEFAULT_PROMPTS[props.section])
  } else {
    selectedTaskId.value = 'create'
    setDraft(props.activePrompt)
  }
  historyOpen.value = false
}

watch(open, (isOpen) => {
  if (isOpen) initFromProps()
})

watch(() => props.section, () => {
  if (open.value) initFromProps()
})

watch(draft, () => {
  if (!syncingDraft.value) selectedTaskId.value = 'create'
})

function selectCreate() {
  selectedTaskId.value = 'create'
}

function selectTask(taskId: string) {
  const task = commonTasks.value.find(item => item.id === taskId)
  if (!task) return
  selectedTaskId.value = task.id
  setDraft(task.prompt)
}

function applyHistoryItem(item: string) {
  selectedTaskId.value = 'create'
  setDraft(item)
  historyOpen.value = false
}

async function onSave() {
  if (!canSave.value) return
  saving.value = true
  try {
    emit('save', draft.value.trim())
    open.value = false
  } finally {
    saving.value = false
  }
}

function onReset() {
  emit('reset')
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #header>
      <div class="flex items-start gap-3">
        <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-elevated">
          <UIcon
            name="i-lucide-sparkles"
            class="size-4 text-highlighted"
          />
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="text-highlighted font-semibold">
            Edit {{ HANDOFF_SECTION_LABELS[section] }} prompt
          </h2>
          <p class="text-sm text-muted">
            Pick a starting task or write your own. This is only added when Add prompt is on.
          </p>
        </div>
      </div>
    </template>

    <template #body>
      <div class="space-y-4">
        <div>
          <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Starting point
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-elevated/60"
              :class="selectedTaskId === 'create'
                ? 'border-primary bg-primary/5 text-highlighted'
                : 'border-default text-muted'"
              :aria-pressed="selectedTaskId === 'create'"
              @click="selectCreate"
            >
              <UIcon
                name="i-lucide-pen-line"
                class="size-4"
              />
              Custom
            </button>
            <button
              v-for="task in commonTasks"
              :key="task.id"
              type="button"
              class="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-elevated/60"
              :class="selectedTaskId === task.id
                ? 'border-primary bg-primary/5 text-highlighted'
                : 'border-default text-muted'"
              :aria-pressed="selectedTaskId === task.id"
              @click="selectTask(task.id)"
            >
              <UIcon
                :name="task.icon"
                class="size-4"
              />
              {{ task.title }}
            </button>
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <label
              class="text-sm font-medium"
              for="handoff-prompt-draft"
            >Prompt</label>
            <span
              class="text-xs"
              :class="wordStatus.overMax ? 'text-error' : 'text-muted'"
            >
              {{ wordStatus.words }} / {{ HANDOFF_PROMPT_MAX_WORDS }} words
            </span>
          </div>
          <UTextarea
            id="handoff-prompt-draft"
            v-model="draft"
            :rows="12"
            autoresize
            class="w-full"
            placeholder="Describe what you want done with this page…"
          />
        </div>

        <div
          v-if="history.length"
          class="overflow-hidden rounded-lg border border-default"
        >
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-elevated/60"
            :aria-expanded="historyOpen"
            @click="historyOpen = !historyOpen"
          >
            <UIcon
              name="i-lucide-history"
              class="size-4 text-muted"
            />
            <span class="font-medium">Previous prompts</span>
            <span class="text-xs text-muted">{{ history.length }}</span>
            <UIcon
              :name="historyOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              class="ms-auto size-4 text-muted"
            />
          </button>
          <ul
            v-if="historyOpen"
            class="max-h-48 space-y-1 overflow-y-auto border-t border-default p-2"
          >
            <li
              v-for="(item, index) in history"
              :key="`${index}-${item.slice(0, 24)}`"
            >
              <button
                type="button"
                class="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-elevated"
                @click="applyHistoryItem(item)"
              >
                <UIcon
                  name="i-lucide-rotate-ccw"
                  class="mt-0.5 size-3.5 shrink-0 text-muted"
                />
                <span class="line-clamp-2 text-muted">{{ item }}</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-rotate-ccw"
          label="Reset to default"
          :disabled="usingDefault"
          @click="onReset"
        />
        <div class="flex items-center gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            label="Cancel"
            @click="open = false"
          />
          <UButton
            icon="i-lucide-check"
            label="Save"
            :loading="saving"
            :disabled="!canSave"
            @click="onSave"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
