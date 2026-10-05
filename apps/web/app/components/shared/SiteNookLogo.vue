<script setup lang="ts">
/**
 * SiteNook wordmark — SVG text with a crisp purple outline.
 * Fills use the chart indigo; strokes stay mid-tone (not near-white) so
 * dark UI does not look washed out while keeping readable contrast.
 */
const props = withDefaults(defineProps<{
  /** sm: sidebar · md: chrome · lg: auth / hero */
  size?: 'sm' | 'md' | 'lg'
  /** Two-letter mark for collapsed nav */
  compact?: boolean
}>(), {
  size: 'md',
  compact: false
})

const siteText = computed(() => (props.compact ? 'S' : 'Site'))
const nookText = computed(() => (props.compact ? 'N' : 'Nook'))
const viewBox = computed(() => (props.compact ? '0 0 40 28' : '0 0 168 34'))
const textY = computed(() => (props.compact ? 20 : 24))
/** Keep strokes thin — thick + pale reads as a glow / blown-out edge */
const strokeWidth = computed(() => {
  if (props.size === 'lg') return 1.55
  if (props.compact) return 1.2
  return 1.35
})

/** Intrinsic CSS size — keeps the mark visible inside flex + min-w-0 parents */
const boxStyle = computed(() => {
  if (props.compact) {
    return { width: '2.25rem', height: '2.25rem' }
  }
  if (props.size === 'lg') {
    return { width: '13.5rem', height: '2.75rem' }
  }
  if (props.size === 'md') {
    return { width: '8rem', height: '1.85rem' }
  }
  // sm full wordmark (sidebar)
  return { width: '8.25rem', height: '1.85rem' }
})
</script>

<template>
  <span
    class="sitenook-logo"
    :class="[
      `sitenook-logo--${size}`,
      compact ? 'sitenook-logo--compact' : 'sitenook-logo--full'
    ]"
    :style="boxStyle"
    aria-hidden="true"
  >
    <svg
      class="sitenook-logo__svg"
      :viewBox="viewBox"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      role="presentation"
      focusable="false"
    >
      <text class="sitenook-logo__type" :x="4" :y="textY">
        <tspan
          fill="var(--sn-site)"
          stroke="var(--sn-site-stroke)"
          :stroke-width="strokeWidth"
          paint-order="stroke fill"
          stroke-linejoin="round"
        >{{ siteText }}</tspan>
        <tspan
          fill="var(--sn-nook)"
          stroke="var(--sn-nook-stroke)"
          :stroke-width="strokeWidth"
          paint-order="stroke fill"
          stroke-linejoin="round"
        >{{ nookText }}</tspan>
      </text>
    </svg>
  </span>
</template>

<style scoped>
.sitenook-logo {
  /*
   * Light UI — chart purple family on pale chrome.
   * #4f46e5 on #fff ≈ 5.9:1; #18181b on #fff ≈ 16:1 (WCAG AA+).
   */
  --sn-site: #18181b;
  --sn-site-stroke: #6366f1;
  --sn-nook: #4f46e5;
  --sn-nook-stroke: #312e81;

  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  line-height: 0;
  user-select: none;
  overflow: visible;
}

.sitenook-logo__svg {
  display: block;
  overflow: visible;
}

.sitenook-logo--compact {
  border-radius: 0.375rem;
  background: var(--sidebar-nav-active-bg, rgba(0, 0, 0, 0.06));
}

.sitenook-logo__type {
  font-family: var(--font-sans), 'Public Sans', ui-sans-serif, system-ui, sans-serif;
  font-weight: 800;
  font-size: 24px;
  letter-spacing: -1px;
}

.sitenook-logo--compact .sitenook-logo__type {
  font-size: 20px;
}
</style>

<style>
/*
 * Dark UI — restore saturated indigo fills (not pale lavender).
 * #818cf8 on ~#121214 ≈ 5.5:1 (large/bold logo text, WCAG AA).
 * Outline uses mid indigo so edges stay crisp against both fill and sidebar.
 */
html.dark .sitenook-logo {
  --sn-site: #f4f4f5;
  --sn-site-stroke: #6366f1;
  --sn-nook: #818cf8;
  --sn-nook-stroke: #4f46e5;
}

html.solarized-light .sitenook-logo {
  --sn-site: #073642;
  --sn-site-stroke: #6c71c4;
  --sn-nook: #5c63b8;
  --sn-nook-stroke: #073642;
}
</style>
