<script setup lang="ts">
import FeaturePageBanner from '~/components/shared/FeaturePageBanner.vue'
import FeaturePageBannerSkeleton from '~/components/shared/FeaturePageBannerSkeleton.vue'
import { resolveFeaturePageBanner } from '~/utils/featurePageBanner'

defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    /** Overview pages use the full panel width instead of the default content cap. */
    fullWidth?: boolean
    /** Fill the dashboard panel with no max-width (split-pane workspaces). */
    fluid?: boolean
    /** Hide the route-based feature intro banner for this page. */
    hideFeatureBanner?: boolean
  }>(),
  { fullWidth: false, fluid: false, hideFeatureBanner: false }
)

const route = useRoute()
const featureBanner = computed(() => resolveFeaturePageBanner(route.path))
const featureBannerLoading = inject<Ref<boolean>>('featurePageBannerLoading', ref(false))
</script>

<template>
  <UDashboardPanel v-bind="$attrs">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>

    <template #body>
      <div
        class="dashboard-panel-body mx-auto flex w-full min-w-0 flex-col gap-4 sm:gap-6"
        :class="fluid ? undefined : fullWidth ? 'max-w-[1200px]' : 'lg:max-w-[70rem]'"
      >
        <RetentionBanner />
        <TrialBanner />
        <BillingUsageLimitBanner />
        <OnboardingChecklist />
        <FeaturePageBannerSkeleton
          v-if="!hideFeatureBanner && featureBanner && featureBannerLoading"
        />
        <FeaturePageBanner
          v-else-if="!hideFeatureBanner && featureBanner"
          :title="featureBanner.title"
          :description="featureBanner.description"
        />
        <slot name="body" />
      </div>
    </template>
  </UDashboardPanel>
</template>
