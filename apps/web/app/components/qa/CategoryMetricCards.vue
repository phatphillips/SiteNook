<script setup lang="ts">
import type { BrokenLink, PolicyMatch, SpellingIssue } from '~/types/sitenook'
import { trafficLightFromCount } from '~/utils/trafficLightStatus'

const props = defineProps<{
  siteId: string
  brokenLinkCount: number
  misspellingCount: number
  policyMatchCount: number
  wordsToReviewCount: number
  inventoryCount: number
  avgReadability: number
  internalBrokenLinkCount: number
  externalBrokenLinkCount: number
  pagesCrawled?: number | null
  previewBrokenLinks: BrokenLink[]
  previewSpelling: SpellingIssue[]
  previewPolicyMatches: PolicyMatch[]
}>()

const cardClass =
  'rounded-lg border border-default bg-elevated/40 p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'

function brokenLinksSubtitle(): string {
  const parts: string[] = []
  if (props.internalBrokenLinkCount) {
    parts.push(`${props.internalBrokenLinkCount} internal`)
  }
  if (props.externalBrokenLinkCount) {
    parts.push(`${props.externalBrokenLinkCount} external`)
  }
  return parts.join(' · ') || 'No broken links found'
}

function spellingSubtitle(): string {
  if (!props.wordsToReviewCount) return 'No words flagged for review'
  return `${props.wordsToReviewCount} word${props.wordsToReviewCount === 1 ? '' : 's'} to review`
}

function policiesSubtitle(): string {
  const top = props.previewPolicyMatches[0]?.expand?.policy?.name
  if (top) return `Top: ${top}`
  if (!props.policyMatchCount) return 'No open policy matches'
  return 'Open policy matches'
}

function inventorySubtitle(): string {
  const parts: string[] = []
  if (props.pagesCrawled) {
    parts.push(`${props.pagesCrawled.toLocaleString()} pages crawled`)
  }
  if (props.inventoryCount) {
    parts.push(`${props.inventoryCount.toLocaleString()} assets tracked`)
  }
  return parts.join(' · ') || 'Track pages, files, and media'
}

function readabilitySubtitle(): string {
  if (!props.avgReadability) return 'View readability analysis'
  return 'Average Flesch reading ease'
}

function topBrokenLinkHint(): string | null {
  const link = props.previewBrokenLinks[0]
  if (!link?.href) return null
  return link.href.length > 48 ? `${link.href.slice(0, 45)}…` : link.href
}

function topSpellingHint(): string | null {
  const word = props.previewSpelling[0]?.word
  return word ? `Top: "${word}"` : null
}
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
    <NuxtLink
      :to="`/sites/${siteId}/qa/links`"
      :class="cardClass"
    >
      <div class="flex items-center gap-2 mb-1">
        <TrafficLightDot :status="trafficLightFromCount(brokenLinkCount)" />
        <p class="text-sm text-muted">Broken links</p>
      </div>
      <p class="text-3xl font-bold tabular-nums">{{ brokenLinkCount }}</p>
      <p class="text-xs text-muted mt-2">{{ brokenLinksSubtitle() }}</p>
      <p v-if="topBrokenLinkHint()" class="text-xs text-muted mt-1 truncate" :title="previewBrokenLinks[0]?.href">
        {{ topBrokenLinkHint() }}
      </p>
    </NuxtLink>

    <NuxtLink
      :to="`/sites/${siteId}/qa/spelling`"
      :class="cardClass"
    >
      <div class="flex items-center gap-2 mb-1">
        <TrafficLightDot :status="trafficLightFromCount(misspellingCount)" />
        <p class="text-sm text-muted">Misspellings</p>
      </div>
      <p class="text-3xl font-bold tabular-nums">{{ misspellingCount }}</p>
      <p class="text-xs text-muted mt-2">{{ spellingSubtitle() }}</p>
      <p v-if="topSpellingHint()" class="text-xs text-muted mt-1 truncate">
        {{ topSpellingHint() }}
      </p>
    </NuxtLink>

    <NuxtLink
      :to="`/sites/${siteId}/qa/policies`"
      :class="cardClass"
    >
      <div class="flex items-center gap-2 mb-1">
        <TrafficLightDot :status="trafficLightFromCount(policyMatchCount)" />
        <p class="text-sm text-muted">Policies</p>
      </div>
      <p class="text-3xl font-bold tabular-nums">{{ policyMatchCount }}</p>
      <p class="text-xs text-muted mt-2 truncate">{{ policiesSubtitle() }}</p>
    </NuxtLink>

    <NuxtLink
      :to="`/sites/${siteId}/accessibility/readability`"
      :class="cardClass"
    >
      <div class="flex items-center gap-2 mb-1">
        <TrafficLightDot status="green" />
        <p class="text-sm text-muted">Readability</p>
      </div>
      <p class="text-3xl font-bold tabular-nums">
        {{ avgReadability || '—' }}
      </p>
      <p class="text-xs text-muted mt-2">{{ readabilitySubtitle() }}</p>
    </NuxtLink>

    <NuxtLink
      :to="`/sites/${siteId}/qa/inventory`"
      :class="cardClass"
    >
      <div class="flex items-center gap-2 mb-1">
        <TrafficLightDot :status="trafficLightFromCount(inventoryCount)" />
        <p class="text-sm text-muted">Inventory</p>
      </div>
      <p class="text-3xl font-bold tabular-nums">{{ inventoryCount }}</p>
      <p class="text-xs text-muted mt-2">{{ inventorySubtitle() }}</p>
    </NuxtLink>
  </div>
</template>
