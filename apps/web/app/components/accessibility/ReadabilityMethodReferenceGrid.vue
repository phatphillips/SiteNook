<script setup lang="ts">
import type { ReadabilityMethodId } from '~/utils/readabilityMethods'
import { READABILITY_METHODS } from '~/utils/readabilityMethods'

defineProps<{
  enabledMethods?: ReadabilityMethodId[]
  compact?: boolean
}>()
</script>

<template>
  <div class="grid gap-3" :class="compact ? 'grid-cols-1' : 'lg:grid-cols-2'">
    <article
      v-for="method in READABILITY_METHODS"
      :key="method.id"
      class="rounded-lg border px-4 py-3"
      :class="enabledMethods?.includes(method.id)
        ? 'border-primary/40 bg-primary/5'
        : 'border-default bg-default/50'"
    >
      <div class="flex items-start justify-between gap-2 mb-2">
        <h4 class="text-sm font-semibold text-default">
          {{ method.label }}
        </h4>
        <span class="readability-badge shrink-0" :class="method.badgeClass">{{ method.badge }}</span>
      </div>
      <p class="text-sm text-muted mb-2">
        {{ method.summary }}
      </p>
      <dl class="space-y-1.5 text-xs">
        <div>
          <dt class="text-muted inline">Scale: </dt>
          <dd class="text-default inline">{{ method.scale }}</dd>
        </div>
        <div>
          <dt class="text-muted inline">Formula: </dt>
          <dd class="text-default inline">{{ method.formula }}</dd>
        </div>
        <div>
          <dt class="text-muted inline">Best practice: </dt>
          <dd class="text-default inline">{{ method.bestPractice }}</dd>
        </div>
        <div>
          <dt class="text-muted inline">Minimum content: </dt>
          <dd class="text-default inline">{{ method.minContent }}</dd>
        </div>
      </dl>
    </article>
  </div>
</template>
