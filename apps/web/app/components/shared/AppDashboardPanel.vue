<script setup lang="ts">
import FeaturePageBanner from '~/components/shared/FeaturePageBanner.vue'
import FeaturePageBannerSkeleton from '~/components/shared/FeaturePageBannerSkeleton.vue'
import { resolveFeaturePageBanner } from '~/utils/featurePageBanner'

defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    /**
     * Kept for call-site compatibility. All non-fluid panels use the same 1400px content width.
     */
    fullWidth?: boolean
    /** Fill the dashboard panel with no max-width (split-pane workspaces). */
    fluid?: boolean
    /** Hide the route-based feature intro for this page. */
    hideFeatureBanner?: boolean
  }>(),
  { fullWidth: false, fluid: false, hideFeatureBanner: false }
)

const route = useRoute()
const config = useRuntimeConfig()
const featureBanner = computed(() => resolveFeaturePageBanner(route.path))
const featureBannerLoading = inject<Ref<boolean>>('featurePageBannerLoading', ref(false))
const commercialEnabled = computed(() => {
  const value = String(config.public.commercialEnabled ?? '').trim().toLowerCase()
  return value === 'true' || value === '1' || value === 'yes' || value === 'on'
})
</script>

<template>
  <UDashboardPanel v-bind="$attrs">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>

    <template #body>
      <div
        class="dashboard-panel-body mx-auto flex w-full min-w-0 flex-col gap-4 sm:gap-6"
        :class="fluid ? undefined : 'max-w-[1400px]'"
      >
        <div
          class="dashboard-page-intro hidden min-w-0 flex-col gap-1.5 has-[#dashboard-page-title-slot:not(:empty)]:flex has-[.feature-page-intro]:flex"
        >
          <div
            id="dashboard-page-title-slot"
            class="empty:hidden"
          />
          <FeaturePageBannerSkeleton
            v-if="!hideFeatureBanner && featureBanner && featureBannerLoading"
          />
          <FeaturePageBanner
            v-else-if="!hideFeatureBanner && featureBanner"
            :description="featureBanner.description"
          />
        </div>
        <template v-if="commercialEnabled">
          <RetentionBanner />
          <TrialBanner />
          <BillingUsageLimitBanner />
        </template>
        <OnboardingChecklist />
        <slot name="body" />
      </div>
    </template>
  </UDashboardPanel>
</template>
