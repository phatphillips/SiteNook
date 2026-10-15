<script setup lang="ts">
import {
  getSimulatorCheck,
  type SimulatorVisionId
} from '~/utils/simulatorChecks'

const props = defineProps<{
  visionId: SimulatorVisionId
}>()

const dismissed = ref(false)

watch(() => props.visionId, (id, prev) => {
  if (id !== prev) {
    dismissed.value = false
  }
})

const check = computed(() => getSimulatorCheck(props.visionId))
const visible = computed(() =>
  !dismissed.value && props.visionId !== 'none'
)

function dismiss() {
  dismissed.value = true
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="translate-y-2 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-2 opacity-0"
  >
    <aside
      v-if="visible"
      class="simulator-impairment-card fixed z-40 max-w-sm rounded-xl border border-default bg-elevated p-4 shadow-lg"
      role="status"
      aria-live="polite"
    >
      <div class="flex items-start gap-3">
        <div class="min-w-0 flex-1 space-y-1.5">
          <p class="text-sm font-semibold text-highlighted">
            {{ check.label }}
          </p>
          <p class="text-sm leading-relaxed text-muted">
            {{ check.description }}
          </p>
          <a
            v-if="check.learnMoreUrl"
            :href="check.learnMoreUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Learn more
            <UIcon
              name="i-lucide-external-link"
              class="size-3.5"
              aria-hidden="true"
            />
          </a>
        </div>
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-x"
          class="shrink-0"
          aria-label="Dismiss impairment description"
          @click="dismiss"
        />
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.simulator-impairment-card {
  right: 1.25rem;
  bottom: 1.25rem;
}
</style>
