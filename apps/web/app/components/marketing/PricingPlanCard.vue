<script setup lang="ts">
import type { BillingInterval, PlanCtaAction } from '~/utils/planPricing'
import type { PlanOffering } from '~/utils/planPricing'
import { formatPlanPrice } from '~/utils/planPricing'

import type { PaidCheckoutPlan } from '~/utils/planLimits'

const props = defineProps<{
  plan: PlanOffering
  interval: BillingInterval
  cta: PlanCtaAction
  checkoutLoadingPlan?: PaidCheckoutPlan | null
}>()

const emit = defineEmits<{
  checkout: [plan: 'starter' | 'team' | 'business', interval: BillingInterval]
}>()

const price = computed(() => formatPlanPrice(props.plan, props.interval))

const featureHeading = computed(() => {
  if (!props.plan.inheritsFrom) return null
  return `Everything in ${props.plan.inheritsFrom}, plus:`
})
</script>

<template>
  <UCard
    :ui="{
      root: plan.highlighted
        ? 'ring-2 ring-default border border-default bg-elevated/40'
        : 'ring ring-default border border-default bg-elevated/30'
    }"
  >
    <div class="flex h-full flex-col">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-xl font-semibold text-highlighted">
            {{ plan.name }}
          </h2>
          <p class="mt-1 text-sm text-muted">
            {{ plan.description }}
          </p>
        </div>
        <UBadge v-if="plan.highlighted" color="neutral" variant="subtle">
          Popular
        </UBadge>
      </div>

      <div class="mt-6 flex items-baseline gap-2">
        <span class="text-4xl font-semibold tracking-tight text-highlighted">
          {{ price.priceLabel }}
        </span>
        <span class="text-sm text-muted">
          {{ price.priceDetail }}
        </span>
      </div>

      <div
        class="mt-4 flex items-center gap-2 rounded-lg border border-default/80 bg-elevated/60 px-3 py-2 text-sm text-muted"
      >
        <UIcon
          :name="plan.contactSales ? 'i-lucide-sliders-horizontal' : 'i-lucide-gauge'"
          class="size-4 shrink-0 text-muted"
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
          <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-default" />
          <span>{{ feature }}</span>
        </li>
      </ul>

      <div class="mt-8 space-y-2">
        <UButton
          v-if="cta.kind === 'checkout'"
          block
          size="lg"
          :color="plan.highlighted || plan.contactSales ? 'neutral' : 'neutral'"
          :variant="plan.contactSales ? 'solid' : 'solid'"
          :loading="checkoutLoadingPlan === cta.plan"
          :disabled="!!checkoutLoadingPlan"
          @click="emit('checkout', cta.plan, cta.interval)"
        >
          {{ cta.label }}
        </UButton>
        <UButton
          v-else-if="cta.kind === 'link'"
          :to="cta.href"
          block
          size="lg"
          :color="plan.highlighted ? 'neutral' : 'neutral'"
          :variant="plan.highlighted ? 'solid' : 'outline'"
        >
          {{ cta.label }}
        </UButton>
        <UButton
          v-else-if="cta.kind === 'mailto'"
          :href="cta.href"
          block
          size="lg"
          variant="solid"
        >
          {{ cta.label }}
        </UButton>
        <div v-else class="space-y-2">
          <UButton block size="lg" variant="soft" color="neutral" disabled>
            {{ cta.label }}
          </UButton>
          <p class="text-center text-xs leading-relaxed text-muted">
            {{ cta.hint }}
          </p>
        </div>

        <p class="flex items-center justify-center gap-1.5 pt-1 text-center text-xs text-muted">
          <UIcon name="i-lucide-server" class="size-3.5" />
          {{ plan.deploymentLabel }}<template v-if="plan.id !== 'enterprise'"> · managed by AccessIQ</template>
        </p>
      </div>
    </div>
  </UCard>
</template>
