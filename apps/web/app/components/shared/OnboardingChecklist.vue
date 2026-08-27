<script setup lang="ts">
import FeaturePageBanner from '~/components/shared/FeaturePageBanner.vue'

const {
  onboardingState,
  showChecklist,
  isTrialing,
  trialDaysRemaining,
  canManageOnboarding,
  dismissChecklist
} = useOnboarding()

const steps = computed(() => {
  const state = onboardingState.value
  return [
    {
      id: 'site',
      title: 'Add your site',
      description: 'We’ll check how inclusive this site is for your visitors.',
      done: Boolean(state.siteAdded),
      to: '/sites',
      cta: 'Add site'
    },
    {
      id: 'scan',
      title: 'Run your first scan',
      description: 'Crawl pages for accessibility, broken links, and spelling.',
      done: Boolean(state.firstScanStarted),
      to: '/sites',
      cta: 'Start scan'
    },
    {
      id: 'review',
      title: 'Review what matters most',
      description: 'See your score and the top issues that may block people.',
      done: Boolean(state.ahaSeen),
      to: '/accessibility/issues',
      cta: 'View issues'
    },
    {
      id: 'invite',
      title: 'Invite someone who can help fix',
      description: 'Bring a content owner or developer into the workspace.',
      done: Boolean(state.teammateInvited),
      to: '/settings/users',
      cta: 'Invite',
      optional: true
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

const completedCount = computed(() => steps.value.filter(step => step.done).length)
const nextStep = computed(() => steps.value.find(step => !step.done))

const stepLabel = computed(() => {
  const prefix = `Step ${Math.min(completedCount.value + 1, steps.value.length)} of ${steps.value.length}`
  return nextStep.value ? `${prefix} — ${nextStep.value.title}` : prefix
})

const trialHint = computed(() => {
  if (!isTrialing.value || trialDaysRemaining.value === null) return null
  const days = trialDaysRemaining.value
  return `${days} day${days === 1 ? '' : 's'} left on Team trial`
})
</script>

<template>
  <FeaturePageBanner
    v-if="showChecklist && canManageOnboarding"
    title="See how inclusive your site is"
  >
    <template #description>
      <p class="text-sm leading-relaxed text-muted">
        {{ stepLabel }}
        <span v-if="trialHint" class="text-muted"> · {{ trialHint }}</span>
      </p>

      <ol class="mt-4 space-y-2">
        <li
          v-for="step in steps"
          :key="step.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-default/70 bg-default/40 px-3 py-2.5"
        >
          <div class="flex min-w-0 items-start gap-3">
            <UIcon
              :name="step.done ? 'i-lucide-circle-check' : 'i-lucide-circle'"
              class="mt-0.5 size-5 shrink-0"
              :class="step.done ? 'text-success' : 'text-muted'"
            />
            <div class="min-w-0">
              <p class="text-sm font-medium text-highlighted">
                {{ step.title }}
                <span v-if="step.optional" class="font-normal text-muted">(optional)</span>
              </p>
              <p class="text-xs text-muted">
                {{ step.description }}
              </p>
            </div>
          </div>
          <UButton
            v-if="!step.done"
            :to="step.to"
            size="xs"
            :variant="nextStep?.id === step.id ? 'solid' : 'outline'"
            color="neutral"
          >
            {{ step.cta }}
          </UButton>
        </li>
      </ol>
    </template>

    <template #actions>
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        @click="dismissChecklist()"
      >
        Dismiss
      </UButton>
    </template>
  </FeaturePageBanner>
</template>
