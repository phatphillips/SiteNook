<script setup lang="ts">
import {
  buildPricingComparisonRows,
  PRICING_COMPARISON_COLUMNS
} from '~/utils/pricingComparison'

const rows = buildPricingComparisonRows()
const columns = PRICING_COMPARISON_COLUMNS
</script>

<template>
  <section
    class="border-t border-default/60"
    aria-labelledby="pricing-compare-heading"
  >
    <div class="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div class="mx-auto max-w-2xl text-center">
        <h2
          id="pricing-compare-heading"
          class="text-2xl font-semibold tracking-tight text-highlighted"
        >
          Compare plans
        </h2>
        <p class="mt-3 text-muted">
          Limits and modules by plan. Enterprise is arranged with sales for custom caps and deployment.
        </p>
      </div>

      <div
        class="mt-10 overflow-x-auto rounded-xl border border-default/80 bg-elevated/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        tabindex="0"
        role="region"
        aria-label="Plan feature comparison. Scroll horizontally on smaller screens."
      >
        <table class="min-w-[40rem] w-full border-collapse text-left text-sm">
          <caption class="sr-only">
            Feature comparison across Starter, Team, Business, and Enterprise plans
          </caption>
          <thead>
            <tr class="border-b border-default/60 bg-elevated/40">
              <th
                scope="col"
                class="sticky left-0 z-10 bg-elevated/95 px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-muted backdrop-blur-sm"
              >
                Feature
              </th>
              <th
                v-for="col in columns"
                :key="col.key"
                scope="col"
                class="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-muted"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.feature"
              class="border-b border-default/40 last:border-b-0"
            >
              <th
                scope="row"
                class="sticky left-0 z-10 bg-default/95 px-4 py-3.5 font-medium text-highlighted backdrop-blur-sm"
              >
                {{ row.feature }}
              </th>
              <td
                v-for="col in columns"
                :key="`${row.feature}-${col.key}`"
                class="px-4 py-3.5 text-center text-muted"
              >
                {{ row[col.key] }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="mt-3 text-center text-xs text-muted sm:hidden">
        Swipe sideways to see all plan columns.
      </p>
    </div>
  </section>
</template>
