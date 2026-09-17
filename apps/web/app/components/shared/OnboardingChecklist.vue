<script setup lang="ts">
const {
  onboardingState,
  showChecklist,
  isTrialing,
  trialDaysRemaining,
  canManageOnboarding,
  dismissChecklist
} = useOnboarding()

const { openWizard } = useAddSiteWizard()
const titleId = useId()

const steps = computed(() => {
  const state = onboardingState.value
  return [
    {
      id: 'site',
      title: 'Add your site',
      description: 'Enter a URL and run your first scan for accessibility, broken links, and spelling.',
      done: Boolean(state.siteAdded && state.firstScanStarted),
      to: '/sites',
      cta: 'Add site',
      openAddSite: true
    },
    {
      id: 'invite',
      title: 'Invite a teammate',
      description: 'Bring a content owner or developer into the workspace so fixes don’t sit with you alone.',
      done: Boolean(state.teammateInvited),
      to: '/settings/users',
      cta: 'Invite'
    },
    {
      id: 'review',
      title: 'Review what matters most',
      description: 'Open your score and the top issues that may block people from using your site.',
      done: Boolean(state.ahaSeen),
      to: '/accessibility/issues',
      cta: 'View issues'
    },
    {
      id: 'schedule',
      title: 'Turn on a schedule',
      description: 'Don’t rely on memory — check weekly or daily.',
      done: Boolean(state.scheduleEnabled),
      to: '/sites',
      cta: 'Open sites',
      optional: true,
      trialOnly: true
    }
  ].filter(step => !step.trialOnly || isTrialing.value)
})

const requiredSteps = computed(() => steps.value.filter(step => !step.optional))
const nextStep = computed(() => steps.value.find(step => !step.done))

const progressLabel = computed(() => {
  const requiredDone = requiredSteps.value.filter(step => step.done).length
  return `${requiredDone} of ${requiredSteps.value.length} complete`
})

const trialHint = computed(() => {
  if (!isTrialing.value || trialDaysRemaining.value === null) return null
  const days = trialDaysRemaining.value
  return `${days} day${days === 1 ? '' : 's'} left on Team trial`
})

function stepStatus(step: { id: string, done: boolean }) {
  if (step.done) return 'done' as const
  if (nextStep.value?.id === step.id) return 'current' as const
  return 'upcoming' as const
}

function runStepCta(step: { openAddSite?: boolean, to?: string }) {
  if (step.openAddSite) {
    openWizard()
    return
  }
  if (step.to) {
    void navigateTo(step.to)
  }
}

</script>

<template>
  <section
    v-if="showChecklist && canManageOnboarding"
    class="rounded-xl border border-primary/25 bg-primary/5 px-5 py-4 sm:px-6 sm:py-5"
    :aria-labelledby="titleId"
  >
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div class="min-w-0 flex-1">
        <p class="text-xs font-medium uppercase tracking-wide text-primary">
          Getting set up
        </p>
        <div class="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h2
            :id="titleId"
            class="text-base font-semibold text-highlighted sm:text-lg"
          >
            Here’s what to do next
          </h2>
          <p class="text-sm text-muted">
            {{ progressLabel }}
            <span v-if="trialHint"> · {{ trialHint }}</span>
          </p>
        </div>
        <p class="mt-1 text-sm leading-relaxed text-muted">
          Follow these steps to finish setup. Start with
          <span class="font-medium text-highlighted">{{ nextStep?.title || 'your checklist' }}</span>
          — you can dismiss this anytime.
        </p>
      </div>

      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <UButton
          v-if="nextStep"
          size="sm"
          color="primary"
          @click="runStepCta(nextStep)"
        >
          {{ nextStep.cta }}
        </UButton>
        <UButton
          size="sm"
          variant="ghost"
          color="neutral"
          @click="dismissChecklist()"
        >
          Dismiss
        </UButton>
      </div>
    </div>

    <ol class="mt-5 space-y-0">
      <li
        v-for="(step, index) in steps"
        :key="step.id"
        class="relative flex gap-3 pb-5 last:pb-0"
      >
        <div class="flex w-7 shrink-0 flex-col items-center">
          <span
            class="relative z-10 flex size-7 items-center justify-center rounded-full border text-xs font-semibold"
            :class="{
              'border-success bg-success/15 text-success': stepStatus(step) === 'done',
              'border-primary bg-primary text-inverted': stepStatus(step) === 'current',
              'border-default bg-default text-muted': stepStatus(step) === 'upcoming'
            }"
            :aria-hidden="true"
          >
            <UIcon
              v-if="step.done"
              name="i-lucide-check"
              class="size-3.5"
            />
            <span v-else>{{ index + 1 }}</span>
          </span>
          <span
            v-if="index < steps.length - 1"
            class="mt-1 w-px flex-1 min-h-4"
            :class="step.done ? 'bg-success/40' : 'bg-default'"
            aria-hidden="true"
          />
        </div>

        <div class="min-w-0 flex-1 pt-0.5">
          <p
            class="text-sm font-medium"
            :class="stepStatus(step) === 'upcoming' ? 'text-muted' : 'text-highlighted'"
          >
            {{ step.title }}
            <span v-if="step.optional" class="font-normal text-muted">(optional)</span>
          </p>
          <p class="mt-0.5 text-xs leading-relaxed text-muted">
            {{ step.description }}
          </p>
          <UButton
            v-if="!step.done && nextStep?.id === step.id"
            size="xs"
            variant="link"
            color="primary"
            class="mt-1 px-0"
            @click="runStepCta(step)"
          >
            {{ step.cta }} →
          </UButton>
          <UButton
            v-else-if="!step.done"
            size="xs"
            variant="link"
            color="neutral"
            class="mt-1 px-0"
            @click="runStepCta(step)"
          >
            {{ step.cta }}
          </UButton>
        </div>
      </li>
    </ol>
  </section>
</template>
