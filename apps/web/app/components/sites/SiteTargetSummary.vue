<script setup lang="ts">
import type { SiteSettings } from '~/utils/siteSettings'
import {
  accessibilityTargetRows,
  qaTargetRows
} from '~/utils/siteSettings'

const props = defineProps<{
  variant: 'accessibility' | 'qa'
  settings: SiteSettings
}>()

const title = computed(() =>
  props.variant === 'accessibility' ? 'Site accessibility target' : 'QA report scope'
)

const description = computed(() =>
  props.variant === 'accessibility'
    ? 'Scores and issue lists below reflect this target. The scanner still records every finding.'
    : 'Only enabled checks appear in this site’s QA reports. The scanner still runs all checks.'
)

const rows = computed(() =>
  props.variant === 'accessibility'
    ? accessibilityTargetRows(props.settings)
    : qaTargetRows(props.settings)
)
</script>

<template>
  <div class="space-y-4 h-full flex flex-col">
    <div>
      <h3 class="font-semibold text-default">
        {{ title }}
      </h3>
      <p class="text-sm text-muted mt-1">
        {{ description }}
      </p>
    </div>

    <dl class="space-y-3 flex-1">
      <div
        v-for="row in rows"
        :key="row.label"
        class="flex items-start justify-between gap-4 text-sm"
      >
        <dt class="text-muted shrink-0">
          {{ row.label }}
        </dt>
        <dd
          class="text-right font-medium"
          :class="row.enabled === false ? 'text-muted' : 'text-default'"
        >
          <span
            v-if="variant === 'accessibility' && row.label === 'Conformance'"
            class="inline-flex items-center gap-1.5"
          >
            <span
              class="site-target-badge"
              :class="{
                'site-target-badge--a': settings.wcagConformance === 'A',
                'site-target-badge--aa': settings.wcagConformance === 'AA',
                'site-target-badge--aaa': settings.wcagConformance === 'AAA'
              }"
            >{{ settings.wcagConformance }}</span>
            <span class="text-muted font-normal">includes lower levels</span>
          </span>
          <template v-else>
            {{ row.value }}
          </template>
        </dd>
      </div>
    </dl>

    <div class="pt-2 border-t border-default">
      <NuxtLink
        to="/sites"
        class="text-sm text-primary hover:underline inline-flex items-center gap-1"
      >
        Edit site settings
        <UIcon name="i-lucide-arrow-right" class="size-3.5" />
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.site-target-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 18px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  color: #fff;
}

.site-target-badge--a {
  background: #c2185b;
}

.site-target-badge--aa {
  background: #7b1fa2;
}

.site-target-badge--aaa {
  background: linear-gradient(135deg, #3949ab, #7b1fa2);
}
</style>
