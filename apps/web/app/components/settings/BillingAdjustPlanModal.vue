<script setup lang="ts">
import type { Organization } from '~/types/sitenook'
import type { PlanChangeAssessment, OrganizationPlanUsage } from '~/utils/planEligibility'
import type { PaidCheckoutPlan } from '~/utils/planLimits'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  organization: Organization | null
  usage: OrganizationPlanUsage | null
  currentPlan: PaidCheckoutPlan | 'free' | 'enterprise'
  planChanges: PlanChangeAssessment[]
  stripeCheckoutConfigured: boolean
  annualCheckoutConfigured?: boolean
  reinstateMode?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  organizationUpdated: [organization: Organization]
}>()
</script>

<template>
  <UModal
    v-model:open="open"
    :title="props.reinstateMode ? 'Resubscribe' : 'Adjust your plan'"
    :ui="{ content: 'sm:max-w-5xl' }"
  >
    <template #body>
      <BillingPlanChangePanel
        :organization="organization"
        :usage="usage"
        :current-plan="currentPlan"
        :plan-changes="planChanges"
        :stripe-checkout-configured="stripeCheckoutConfigured"
        :annual-checkout-configured="annualCheckoutConfigured"
        :reinstate-mode="reinstateMode"
        :disabled="disabled"
        embedded
        @organization-updated="(org) => { emit('organizationUpdated', org); open = false }"
      />
    </template>
  </UModal>
</template>
