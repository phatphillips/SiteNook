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

export interface BillingSubscriptionSummary {
  subscriptionId: string
  status: string
  cancelAtPeriodEnd: boolean
  currentPeriodStart: string
  currentPeriodEnd: string
  billingInterval: 'monthly' | 'annual' | 'unknown'
  amountCents: number | null
  currency: string | null
}
