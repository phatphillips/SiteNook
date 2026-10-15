<script setup lang="ts">
import type { PdfLibraryKpis } from '~/utils/pdfKpis'

defineProps<{
  kpis: PdfLibraryKpis
}>()
</script>

<template>
  <div class="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
    <div class="min-w-0 rounded-xl border border-default bg-elevated p-3">
      <p class="text-xs text-muted">
        Discovered
      </p>
      <p class="text-lg font-semibold tabular-nums sm:text-xl">
        {{ kpis.discovered }}
      </p>
    </div>
    <div class="min-w-0 rounded-xl border border-default bg-elevated p-3">
      <p class="text-xs text-muted">
        Scanned
      </p>
      <p class="text-lg font-semibold tabular-nums sm:text-xl">
        {{ kpis.validated }}
      </p>
    </div>
    <div class="min-w-0 rounded-xl border border-default bg-elevated p-3">
      <p class="text-xs text-muted">
        Structured
      </p>
      <p class="text-lg font-semibold tabular-nums sm:text-xl">
        {{ kpis.structured }}
      </p>
    </div>
    <div class="min-w-0 rounded-xl border border-default bg-elevated p-3">
      <p class="text-xs text-muted">
        Remediated
      </p>
      <p class="text-lg font-semibold tabular-nums sm:text-xl">
        {{ kpis.remediated }}
      </p>
    </div>
    <div class="min-w-0 rounded-xl border border-default bg-elevated p-3">
      <p class="text-xs text-muted">
        Needs human finish
      </p>
      <p class="text-lg font-semibold tabular-nums sm:text-xl">
        {{ kpis.needsHumanFinish }}
      </p>
    </div>
    <div class="min-w-0 rounded-xl border border-default bg-elevated p-3">
      <p class="text-xs text-muted">
        Median issue Δ
      </p>
      <p class="text-lg font-semibold tabular-nums sm:text-xl">
        {{ kpis.medianIssueDelta ?? '—' }}
      </p>
    </div>
    <div class="min-w-0 rounded-xl border border-default bg-elevated p-3">
      <p class="text-xs text-muted">
        Avg lift %
      </p>
      <p class="text-lg font-semibold tabular-nums sm:text-xl">
        {{ kpis.averageLiftPercent != null ? `${kpis.averageLiftPercent}%` : '—' }}
      </p>
    </div>
  </div>
</template>
