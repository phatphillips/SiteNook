<script setup lang="ts">
import type { BillingInterval, PlanCtaAction, PlanOffering } from '~/utils/planPricing'
import { formatPlanPrice, getPlanAnnualSavingsPercent } from '~/utils/planPricing'
import type { PaidCheckoutPlan } from '~/utils/planLimits'

const props = defineProps<{
  plan: PlanOffering
  interval: BillingInterval
  cta: PlanCtaAction
  secondaryCta?: PlanCtaAction | null
  checkoutLoadingPlan?: PaidCheckoutPlan | null
}>()

const emit = defineEmits<{
  checkout: [plan: 'starter' | 'team' | 'business', interval: BillingInterval]
  ctaClick: [planId: string, label: string]
}>()

const price = computed(() => formatPlanPrice(props.plan, props.interval))

const annualSavings = computed(() => getPlanAnnualSavingsPercent(props.plan))

const featureHeading = computed(() => {
  if (!props.plan.inheritsFrom) return null
  return `Everything in ${props.plan.inheritsFrom}, plus:`
})

const highlightedBadge = computed(() => {
  if (props.plan.id === 'team' || props.plan.highlighted) return 'Best value'
  return null
})

const honestyLine = computed(() => {
  if (props.plan.id === 'team') return 'No credit card for the trial. Cancel anytime.'
  return 'Cancel anytime from Billing settings.'
})

function onCtaClick(action: PlanCtaAction) {
  emit('ctaClick', props.plan.id, action.label)
  if (action.kind === 'checkout') {
    emit('checkout', action.plan, action.interval)
  }
}
</script>

<template>
  <UCard
    :ui="{
      root: plan.highlighted
        ? 'h-full ring-2 ring-[var(--color-action-solid)] border border-default bg-elevated/50 shadow-sm'
        : 'h-full ring ring-default border border-default bg-elevated/30'
    }"
  >
    <div class="flex h-full flex-col">
      <div class="flex min-h-11 items-start justify-between gap-3">
        <div>
          <h2 class="text-xl font-semibold text-highlighted">
            {{ plan.name }}
          </h2>
          <p class="mt-1 text-sm text-muted">
            {{ plan.description }}
          </p>
        </div>
        <UBadge
          v-if="highlightedBadge"
          color="primary"
          variant="solid"
          class="shrink-0"
        >
          {{ highlightedBadge }}
        </UBadge>
      </div>

      <div class="mt-6">
        <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span class="text-4xl font-semibold tracking-tight text-highlighted">
            {{ price.priceLabel }}
          </span>
          <span class="text-sm text-muted">
            {{ price.priceDetail }}
          </span>
        </div>
        <p
          v-if="interval === 'annual' && annualSavings != null"
          class="mt-2 text-sm font-medium text-highlighted"
        >
          Save {{ annualSavings }}% vs monthly
        </p>
      </div>

      <div
        class="mt-4 flex min-h-11 items-center gap-2 rounded-lg border border-default/80 bg-elevated/60 px-3 py-2.5 text-sm text-muted"
      >
        <UIcon
          name="i-lucide-gauge"
          class="size-4 shrink-0 text-muted"
          aria-hidden="true"
        />
        <span>{{ plan.primaryMetric }}</span>
      </div>

      <ul class="mt-6 flex-1 space-y-3 text-sm text-muted">
        <li v-if="featureHeading" class="font-medium text-default">
          {{ featureHeading }}
        </li>
        <li
          v-for="feature in plan.features"
          :key="feature"
          class="flex items-start gap-2"
        >
          <UIcon
            name="i-lucide-check"
            class="mt-0.5 size-4 shrink-0 text-default"
            aria-hidden="true"
          />
          <span>{{ feature }}</span>
        </li>
      </ul>

      <div class="mt-8 space-y-2">
        <UButton
          v-if="cta.kind === 'checkout'"
          block
          size="lg"
          variant="solid"
          class="min-h-11"
          :loading="checkoutLoadingPlan === cta.plan"
          :disabled="!!checkoutLoadingPlan"
          @click="onCtaClick(cta)"
        >
          {{ cta.label }}
        </UButton>
        <UButton
          v-else-if="cta.kind === 'link'"
          :to="cta.href"
          block
          size="lg"
          class="min-h-11"
          :variant="plan.highlighted ? 'solid' : 'outline'"
          @click="emit('ctaClick', plan.id, cta.label)"
        >
          {{ cta.label }}
        </UButton>
        <UButton
          v-else-if="cta.kind === 'mailto'"
          :href="cta.href"
          block
          size="lg"
          variant="solid"
          class="min-h-11"
          @click="emit('ctaClick', plan.id, cta.label)"
        >
          {{ cta.label }}
        </UButton>
        <div v-else class="space-y-2">
          <UButton
            block
            size="lg"
            variant="soft"
            color="neutral"
            class="min-h-11"
            disabled
          >
            {{ cta.label }}
          </UButton>
          <p class="text-center text-xs leading-relaxed text-muted">
            {{ cta.hint }}
          </p>
        </div>

        <template v-if="secondaryCta && secondaryCta.kind !== cta.kind">
          <UButton
            v-if="secondaryCta.kind === 'checkout'"
            block
            size="md"
            variant="ghost"
            color="neutral"
            class="min-h-11"
            :loading="checkoutLoadingPlan === secondaryCta.plan"
            :disabled="!!checkoutLoadingPlan"
            @click="onCtaClick(secondaryCta)"
          >
            Or {{ secondaryCta.label.toLowerCase() }} now
          </UButton>
          <UButton
            v-else-if="secondaryCta.kind === 'link'"
            :to="secondaryCta.href"
            block
            size="md"
            variant="ghost"
            color="neutral"
            class="min-h-11"
            @click="emit('ctaClick', plan.id, secondaryCta.label)"
          >
            Or {{ secondaryCta.label.toLowerCase() }} now
          </UButton>
        </template>

        <p class="pt-1 text-center text-xs text-muted">
          {{ honestyLine }}
        </p>
        <p class="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
          <UIcon name="i-lucide-server" class="size-3.5" aria-hidden="true" />
          {{ plan.deploymentLabel }} · managed by SiteNook
        </p>
      </div>
    </div>
  </UCard>
</template>
