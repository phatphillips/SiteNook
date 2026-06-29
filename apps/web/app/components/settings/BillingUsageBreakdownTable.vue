<script setup lang="ts">
import type { UsageBreakdownRow } from '~/utils/planUsageBreakdown'
import { formatUsagePercent } from '~/utils/planUsageBreakdown'

defineProps<{
  rows: UsageBreakdownRow[]
  periodLabel?: string | null
}>()

function usedLabel(row: UsageBreakdownRow): string {
  if (row.limit == null && row.status === 'unlimited') {
    return String(row.used)
  }
  if (row.limit === 0 && row.status === 'exceeded') {
    return `${row.used} in use`
  }
  if (row.limit != null) {
    return `${row.used} (${formatUsagePercent(row.usagePercent)})`
  }
  return String(row.used)
}

function usageBadgeClass(status: UsageBreakdownRow['status']): string {
  if (status === 'exceeded') {
    return 'bg-error/10 text-error'
  }
  if (status === 'warning') {
    return 'bg-warning/10 text-warning'
  }
  if (status === 'unlimited') {
    return 'bg-elevated text-muted'
  }
  return 'bg-elevated text-muted'
}

function usageBadgeLabel(row: UsageBreakdownRow): string {
  if (row.status === 'exceeded') return 'At limit'
  if (row.status === 'warning') return 'Nearing limit'
  if (row.status === 'unlimited') return 'Unlimited'
  if (row.limit === 0) return 'Not included'
  return formatUsagePercent(row.usagePercent)
}
</script>

<template>
  <div class="table-surface">
    <div
      v-if="periodLabel"
      class="border-b border-default/70 px-4 py-3 text-xs text-muted"
    >
      {{ periodLabel }}
    </div>
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-default/70 text-left text-xs uppercase tracking-wide text-muted">
          <th class="px-4 py-3 font-medium">
            Item
          </th>
          <th class="px-4 py-3 font-medium text-right">
            Used
          </th>
          <th class="px-4 py-3 font-medium text-right">
            Limit
          </th>
          <th class="px-4 py-3 font-medium text-right">
            Usage
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.id"
          class="border-b border-default/50 last:border-b-0"
        >
          <td class="px-4 py-3.5">
            <div class="font-medium text-default">
              {{ row.label }}
            </div>
            <p
              v-if="row.description"
              class="mt-0.5 text-xs text-muted"
            >
              {{ row.description }}
            </p>
          </td>
          <td class="px-4 py-3.5 text-right tabular-nums text-default">
            {{ usedLabel(row) }}
          </td>
          <td class="px-4 py-3.5 text-right tabular-nums text-muted">
            {{ row.limitLabel }}
          </td>
          <td class="px-4 py-3.5 text-right">
            <span
              class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium tabular-nums"
              :class="usageBadgeClass(row.status)"
            >
              {{ usageBadgeLabel(row) }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
