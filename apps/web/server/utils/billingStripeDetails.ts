import type Stripe from 'stripe'
import type { Organization } from '~/types/sitenook'
import { resolveStripeSubscriptionForOrg } from './resolveStripeSubscription'

export interface BillingSubscriptionDetails {
  subscriptionId: string
  status: string
  cancelAtPeriodEnd: boolean
  currentPeriodStart: string
  currentPeriodEnd: string
  billingInterval: 'monthly' | 'annual' | 'unknown'
  amountCents: number | null
  currency: string | null
}

export interface BillingInvoiceSummary {
  id: string
  number: string | null
  created: string
  description: string | null
  status: string
  amountPaid: number
  currency: string
  hostedInvoiceUrl: string | null
  invoicePdf: string | null
}

function resolveBillingInterval(price: Stripe.Price | undefined): BillingSubscriptionDetails['billingInterval'] {
  if (!price?.recurring) return 'unknown'
  if (price.recurring.interval === 'year') return 'annual'
  if (price.recurring.interval === 'month') return 'monthly'
  return 'unknown'
}

export async function loadBillingSubscriptionDetails(
  stripe: Stripe,
  org: Organization
): Promise<BillingSubscriptionDetails | null> {
  const subscription = await resolveStripeSubscriptionForOrg(stripe, org)
  if (!subscription) return null

  const price = subscription.items.data[0]?.price
  const periodStart = subscription.current_period_start
  const periodEnd = subscription.current_period_end

  return {
    subscriptionId: subscription.id,
    status: subscription.status,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    currentPeriodStart: new Date(periodStart * 1000).toISOString(),
    currentPeriodEnd: new Date(periodEnd * 1000).toISOString(),
    billingInterval: resolveBillingInterval(price),
    amountCents: price?.unit_amount ?? null,
    currency: price?.currency ?? null
  }
}

export async function loadBillingInvoices(
  stripe: Stripe,
  customerId: string,
  limit = 12
): Promise<BillingInvoiceSummary[]> {
  const list = await stripe.invoices.list({
    customer: customerId,
    limit
  })

  return list.data.map(invoice => ({
    id: invoice.id,
    number: invoice.number,
    created: new Date(invoice.created * 1000).toISOString(),
    description: invoice.description
      ?? (typeof invoice.lines.data[0]?.description === 'string' ? invoice.lines.data[0].description : null),
    status: invoice.status ?? 'unknown',
    amountPaid: invoice.amount_paid ?? 0,
    currency: invoice.currency ?? 'usd',
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    invoicePdf: invoice.invoice_pdf ?? null
  }))
}

export function formatStripeMoney(amountCents: number, currency: string): string {
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
