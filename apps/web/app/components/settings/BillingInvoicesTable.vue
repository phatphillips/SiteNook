<script setup lang="ts">
import type { BillingInvoiceSummary } from '~/utils/billingTypes'

const props = defineProps<{
  invoices: BillingInvoiceSummary[]
  loading?: boolean
}>()

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

function formatMoney(amountCents: number, currency: string): string {
  const amount = amountCents / 100
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`
  }
}

function statusLabel(status: string): string {
  if (status === 'paid') return 'Paid'
  if (status === 'open') return 'Open'
  if (status === 'void') return 'Void'
  if (status === 'uncollectible') return 'Uncollectible'
  if (status === 'draft') return 'Draft'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function statusClass(status: string): string {
  if (status === 'paid') return 'text-success'
  if (status === 'open') return 'text-warning'
  return 'text-muted'
}

function invoiceLink(invoice: BillingInvoiceSummary): string | null {
  return invoice.hostedInvoiceUrl ?? invoice.invoicePdf
}
</script>

<template>
  <div class="table-surface">
    <div
      v-if="loading"
      class="flex justify-center py-10"
    >
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
    </div>
    <div
      v-else-if="!invoices.length"
      class="px-4 py-8 text-center text-sm text-muted"
    >
      No invoices yet. Invoices appear here after your first payment.
    </div>
    <table
      v-else
      class="w-full text-sm"
    >
      <thead>
        <tr class="border-b border-default/70 text-left text-xs uppercase tracking-wide text-muted">
          <th class="px-4 py-3 font-medium">
            Date
          </th>
          <th class="px-4 py-3 font-medium">
            Description
          </th>
          <th class="px-4 py-3 font-medium">
            Status
          </th>
          <th class="px-4 py-3 font-medium text-right">
            Amount
          </th>
          <th class="px-4 py-3 font-medium text-right">
            Invoice
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="invoice in invoices"
          :key="invoice.id"
          class="border-b border-default/50 last:border-b-0"
        >
          <td class="px-4 py-3.5 text-default whitespace-nowrap">
            {{ formatDate(invoice.created) }}
          </td>
          <td class="px-4 py-3.5 text-muted max-w-[14rem] truncate">
            {{ invoice.description || invoice.number || '—' }}
          </td>
          <td class="px-4 py-3.5">
            <span
              class="text-xs font-medium capitalize"
              :class="statusClass(invoice.status)"
            >
              {{ statusLabel(invoice.status) }}
            </span>
          </td>
          <td class="px-4 py-3.5 text-right tabular-nums font-medium text-default whitespace-nowrap">
            {{ formatMoney(invoice.amountPaid, invoice.currency) }}
          </td>
          <td class="px-4 py-3.5 text-right">
            <a
              v-if="invoiceLink(invoice)"
              :href="invoiceLink(invoice)!"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-sm font-medium text-default hover:underline"
            >
              View
              <UIcon name="i-lucide-arrow-up-right" class="size-3.5 opacity-70" />
            </a>
            <span
              v-else
              class="text-muted"
            >—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
