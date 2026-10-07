<script setup lang="ts">
import MarketingFaqSection from '~/components/marketing/MarketingFaqSection.vue'
import MarketingFeatureShowcase from '~/components/marketing/MarketingFeatureShowcase.vue'
import MarketingProductFrame from '~/components/marketing/MarketingProductFrame.vue'
import MarketingAccessibilityShowcase from '~/components/marketing/showcases/MarketingAccessibilityShowcase.vue'
import MarketingReadabilityShowcase from '~/components/marketing/showcases/MarketingReadabilityShowcase.vue'
import MarketingScannerShowcase from '~/components/marketing/showcases/MarketingScannerShowcase.vue'
import { LANDING_FAQ_ITEMS } from '~/utils/marketingFaq'
import type { MarketingNavId } from '~/utils/marketingNav'
import { buildTeamTrialStartUrl, TEAM_TRIAL_CTA } from '~/utils/planPricing'
import { parseSelfServiceSignupFlag } from '~/utils/selfServiceSignup'

const config = useRuntimeConfig()
const selfServiceEnabled = computed(() => parseSelfServiceSignupFlag(config.public.selfServiceSignup))

const trialHref = computed(() =>
  selfServiceEnabled.value ? buildTeamTrialStartUrl() : '/signup'
)

const painPoints = [
  {
    icon: 'i-lucide-accessibility',
    title: 'Accessibility barriers',
    description: 'Find WCAG issues that may block people using assistive tech. Before they leave your site.'
  },
  {
    icon: 'i-lucide-link-2-off',
    title: 'Broken trust from QA',
    description: 'Catch broken links and spelling problems that undermine confidence for every visitor.'
  },
  {
    icon: 'i-lucide-trending-up',
    title: 'Progress over time',
    description: 'Track scores and schedules so inclusion work does not depend on memory or one-off audits.'
  }
]

const productFeatures = computed(() => [
  {
    key: 'accessibility' as const,
    layout: 'stack' as const,
    hideNav: false,
    hideTitleBar: false,
    activeNav: 'accessibility-overview' as MarketingNavId,
    eyebrow: 'Accessibility',
    headline: 'Scores, trends, and issues you can act on',
    description: 'See WCAG findings in plain language, track accessibility score over time, and prioritize the issues that unlock the most points.',
    ctaLabel: 'Start free trial',
    ctaTo: trialHref.value,
    title: 'Accessibility',
    badge: 'Latest scan',
    bandClass: 'bg-elevated/35'
  },
  {
    key: 'readability' as const,
    layout: 'split' as const,
    hideNav: true,
    hideTitleBar: true,
    activeNav: 'accessibility-readability' as MarketingNavId,
    eyebrow: 'Readability',
    headline: 'Know how hard your pages are to read',
    description: 'Gauge site-average reading level, explore the page breakdown, and spot content that needs simplifying.',
    ctaLabel: 'Start free trial',
    ctaTo: trialHref.value,
    title: 'Readability',
    badge: null,
    bandClass: 'bg-default'
  },
  {
    key: 'scanner' as const,
    layout: 'split-reverse' as const,
    hideNav: true,
    hideTitleBar: true,
    activeNav: 'scans' as MarketingNavId,
    eyebrow: 'Scanning',
    headline: 'Watch a crawl run in real time',
    description: 'Pages crawled, elapsed time, and live crawl activity. So you always know what the scanner is doing.',
    ctaLabel: 'Start free trial',
    ctaTo: trialHref.value,
    title: 'Scan monitor',
    badge: null,
    bandClass: 'bg-elevated/35'
  }
])
</script>

<template>
  <div>
    <section class="border-b border-default/60">
      <div class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div class="max-w-3xl">
          <p class="mb-4 text-sm font-medium text-muted">
            SiteNook
          </p>
          <h1 class="text-4xl font-semibold tracking-tight text-highlighted sm:text-5xl">
            Know whether your site includes everyone. Then keep improving it.
          </h1>
          <p class="mt-6 text-lg leading-relaxed text-muted">
            SiteNook crawls your websites, surfaces accessibility and QA issues in plain language, and helps teams who care about inclusive experiences. Without the enterprise price tag.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <UButton :to="trialHref" size="lg" class="min-h-11">
              Start 30-day Team trial
            </UButton>
            <UButton to="/pricing" size="lg" variant="soft" color="neutral" class="min-h-11">
              See plans
            </UButton>
          </div>
          <p class="mt-4 max-w-xl text-sm text-muted">
            {{ TEAM_TRIAL_CTA.subcopy }}
          </p>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h2 class="text-2xl font-semibold tracking-tight text-highlighted">
        Built for people who care about their users
      </h2>
      <p class="mt-3 max-w-2xl text-muted">
        You do not need to be an accessibility engineer. Start from the pains that bring teams here.
      </p>
      <div class="mt-10 grid gap-6 md:grid-cols-3">
        <div
          v-for="item in painPoints"
          :key="item.title"
          class="rounded-xl border border-default/80 bg-elevated/30 p-5"
        >
          <div class="flex size-11 items-center justify-center rounded-xl bg-elevated ring-1 ring-default">
            <UIcon :name="item.icon" class="size-5 text-default" />
          </div>
          <h3 class="mt-4 text-lg font-semibold text-highlighted">
            {{ item.title }}
          </h3>
          <p class="mt-2 text-sm leading-relaxed text-muted">
            {{ item.description }}
          </p>
        </div>
      </div>
    </section>

    <section class="border-t border-default/60">
      <div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 class="text-2xl font-semibold tracking-tight text-highlighted">
          See the product
        </h2>
        <p class="mt-3 max-w-2xl text-muted">
          Live overview components. Scores, charts, readability, and a running scan. The same building blocks you get after your first crawl.
        </p>
      </div>
    </section>

    <section
      v-for="feature in productFeatures"
      :key="feature.key"
      class="w-full border-t border-default/60"
      :class="feature.bandClass"
    >
      <div class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <MarketingFeatureShowcase
          :layout="feature.layout"
          :eyebrow="feature.eyebrow"
          :headline="feature.headline"
          :description="feature.description"
          :cta-label="feature.ctaLabel"
          :cta-to="feature.ctaTo"
        >
          <template #product>
            <MarketingProductFrame
              :active-nav="feature.activeNav"
              :title="feature.title"
              :badge="feature.badge"
              :hide-nav="feature.hideNav"
              :hide-title-bar="feature.hideTitleBar"
            >
              <MarketingAccessibilityShowcase v-if="feature.key === 'accessibility'" />
              <MarketingReadabilityShowcase v-else-if="feature.key === 'readability'" />
              <MarketingScannerShowcase v-else />
            </MarketingProductFrame>
          </template>
        </MarketingFeatureShowcase>
      </div>
    </section>

    <section class="border-t border-default/60">
      <div class="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
        <h2 class="text-2xl font-semibold tracking-tight text-highlighted">
          Ready to see how inclusive your site is?
        </h2>
        <p class="mx-auto mt-3 max-w-xl text-muted">
          Start a 30-day Team trial, or compare plans. Free stays available with 1 site and 20 pages per scan.
        </p>
        <div class="mt-6 flex flex-wrap justify-center gap-3">
          <UButton :to="trialHref" size="lg" class="min-h-11">
            Start free trial
          </UButton>
          <UButton to="/pricing" size="lg" variant="outline" color="neutral" class="min-h-11">
            See plans
          </UButton>
        </div>
      </div>
    </section>

    <MarketingFaqSection
      description="Straight answers for non-technical buyers and teams who care about inclusion."
      :items="LANDING_FAQ_ITEMS"
    />
  </div>
</template>
