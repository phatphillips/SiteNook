import { format } from 'date-fns'
import { formatOrgUserRole } from '~/utils/orgAccess'

export type TeamActivityAction =
  | 'member_added'
  | 'member_removed'
  | 'role_changed'
  | 'billing_contact_added'
  | 'billing_contact_removed'
  | 'invite_resent'
  | 'org_closed'
  | 'subscription_updated'
  | 'analytics_connected'
  | 'analytics_disconnected'
  | 'analytics_reconnected'
  | 'analytics_sync_needs_reconnect'

const PROVIDER_LABELS: Record<string, string> = {
  ga4: 'Google Analytics 4',
  cloudflare: 'Cloudflare Web Analytics',
  plausible: 'Plausible Analytics',
  umami: 'Umami',
  fathom: 'Fathom Analytics',
  matomo: 'Matomo'
}

function providerLabel(details?: Record<string, unknown> | null): string {
  const key = String(details?.provider ?? '').trim()
  return PROVIDER_LABELS[key] || key || 'analytics provider'
}

function siteLabel(details?: Record<string, unknown> | null): string {
  return String(details?.siteName ?? '').trim() || 'a site'
}

export interface TeamActivityLogEntry {
  id: string
  action: TeamActivityAction | string
  created: string
  details?: Record<string, unknown> | null
  actor?: { id: string, name: string, email?: string } | null
  target?: { id: string, name: string, email?: string } | null
}

export interface TeamActivityActionMeta {
  label: string
  icon: string
  color: 'primary' | 'info' | 'warning' | 'error' | 'neutral'
}

function displayName(
  user: { name?: string } | null | undefined,
  fallback = 'Someone',
  details?: Record<string, unknown> | null
): string {
  const name = String(user?.name ?? '').trim()
  if (name && name !== '—') return name
  const fromDetails = String(details?.targetName ?? '').trim()
  if (fromDetails && fromDetails !== '—') return fromDetails
  return fallback
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return format(date, 'd MMM yyyy, h:mmaaa').replace('AM', 'am').replace('PM', 'pm')
}

export function getTeamActivityActionMeta(action: string): TeamActivityActionMeta {
  switch (action) {
    case 'member_added':
      return { label: 'Member added', icon: 'i-lucide-user-plus', color: 'primary' }
    case 'member_removed':
      return { label: 'Member removed', icon: 'i-lucide-user-minus', color: 'error' }
    case 'role_changed':
      return { label: 'Role changed', icon: 'i-lucide-shield', color: 'warning' }
    case 'billing_contact_added':
      return { label: 'Billing contact added', icon: 'i-lucide-receipt', color: 'info' }
    case 'billing_contact_removed':
      return { label: 'Billing contact removed', icon: 'i-lucide-receipt', color: 'neutral' }
    case 'invite_resent':
      return { label: 'Invite resent', icon: 'i-lucide-mail', color: 'primary' }
    case 'org_closed':
      return { label: 'Organization closed', icon: 'i-lucide-building-2', color: 'error' }
    case 'subscription_updated':
      return { label: 'Subscription updated', icon: 'i-lucide-receipt', color: 'info' }
    case 'analytics_connected':
      return { label: 'Analytics connected', icon: 'i-lucide-link', color: 'primary' }
    case 'analytics_disconnected':
      return { label: 'Analytics disconnected', icon: 'i-lucide-unlink', color: 'neutral' }
    case 'analytics_reconnected':
      return { label: 'Analytics reconnected', icon: 'i-lucide-refresh-cw', color: 'info' }
    case 'analytics_sync_needs_reconnect':
      return { label: 'Analytics needs reconnect', icon: 'i-lucide-alert-triangle', color: 'warning' }
    default:
      return { label: 'Team update', icon: 'i-lucide-history', color: 'neutral' }
  }
}

export function formatTeamActivityTimestamp(entry: TeamActivityLogEntry): string {
  return formatTimestamp(entry.created)
}

export function formatTeamActivitySentence(entry: TeamActivityLogEntry): string {
  const actor = displayName(entry.actor)
  const target = displayName(entry.target, 'a team member', entry.details)

  switch (entry.action) {
    case 'member_added':
      return `${actor} added ${target}`
    case 'member_removed':
      return `${actor} removed ${target}`
    case 'role_changed': {
      const from = formatOrgUserRole(String(entry.details?.from ?? ''))
      const to = formatOrgUserRole(String(entry.details?.to ?? ''))
      return `${actor} changed ${target}'s role from ${from} to ${to}`
    }
    case 'billing_contact_added':
      return `${actor} marked ${target} as a billing contact`
    case 'billing_contact_removed':
      return `${actor} removed ${target} as a billing contact`
    case 'invite_resent':
      return `${actor} resent the invite to ${target}`
    case 'org_closed':
      return `${actor} closed the organization`
    case 'subscription_updated':
      return `Subscription updated for the organization`
    case 'analytics_connected':
      return `${actor} connected ${providerLabel(entry.details)} to ${siteLabel(entry.details)}`
    case 'analytics_disconnected':
      return `${actor} disconnected ${providerLabel(entry.details)} from ${siteLabel(entry.details)}`
    case 'analytics_reconnected':
      return `${actor} reconnected ${providerLabel(entry.details)} on ${siteLabel(entry.details)}`
    case 'analytics_sync_needs_reconnect':
      return `${providerLabel(entry.details)} on ${siteLabel(entry.details)} needs to be reconnected`
    default:
      return `${actor} updated ${target}`
  }
}

export function formatTeamActivityDetail(entry: TeamActivityLogEntry): string | null {
  const targetEmail = String(entry.target?.email ?? entry.details?.targetEmail ?? '').trim()

  switch (entry.action) {
    case 'member_added': {
      const role = formatOrgUserRole(String(entry.details?.role ?? ''))
      const parts = [
        role ? `Role: ${role}` : null,
        targetEmail ? `Email: ${targetEmail}` : null
      ].filter(Boolean)
      return parts.length ? parts.join(' · ') : null
    }
    case 'member_removed': {
      const role = formatOrgUserRole(String(entry.details?.role ?? ''))
      const parts = [
        role ? `Former role: ${role}` : null,
        targetEmail ? `Email: ${targetEmail}` : null
      ].filter(Boolean)
      return parts.length ? parts.join(' · ') : null
    }
    case 'role_changed':
      return targetEmail ? `Email: ${targetEmail}` : null
    case 'billing_contact_added':
    case 'billing_contact_removed':
      return targetEmail ? `Admin · ${targetEmail}` : 'Organization billing contact'
    case 'invite_resent':
      return targetEmail
        ? `Set-password email sent again to ${targetEmail}`
        : 'Set-password email sent again'
    case 'org_closed': {
      const purgeAt = String(entry.details?.purgeScheduledAt ?? '').trim()
      return purgeAt ? `Data scheduled for deletion after ${formatTimestamp(purgeAt)}` : null
    }
    case 'subscription_updated': {
      const status = String(entry.details?.status ?? '').trim()
      return status ? `Status: ${status}` : null
    }
    case 'analytics_connected':
    case 'analytics_disconnected':
    case 'analytics_reconnected':
    case 'analytics_sync_needs_reconnect': {
      const provider = providerLabel(entry.details)
      const site = siteLabel(entry.details)
      return `${provider} · ${site}`
    }
    default:
      return targetEmail ? `Email: ${targetEmail}` : null
  }
}
