export type DismissReason = 'wont_fix' | 'false_positive' | 'defer'

export interface IssueActionMenuItem {
  label: string
  icon?: string
  onSelect?: () => void
}

export function dismissActionItems(onDismiss: (reason: DismissReason) => void): IssueActionMenuItem[] {
  return [
    {
      label: 'Dismiss — won\'t fix',
      icon: 'i-lucide-x',
      onSelect: () => onDismiss('wont_fix')
    },
    {
      label: 'Dismiss — false positive',
      icon: 'i-lucide-x',
      onSelect: () => onDismiss('false_positive')
    },
    {
      label: 'Dismiss — defer',
      icon: 'i-lucide-x',
      onSelect: () => onDismiss('defer')
    }
  ]
}

export function issueRowActionGroups(options: {
  onViewDetails: () => void
  onRescan: () => void
  onMarkFixed: () => void
  onDismiss: (reason: DismissReason) => void
  rescanLabel?: string
}): IssueActionMenuItem[][] {
  return [[
    {
      label: 'View details',
      icon: 'i-lucide-eye',
      onSelect: options.onViewDetails
    },
    {
      label: options.rescanLabel ?? 'Rescan page',
      icon: 'i-lucide-refresh-cw',
      onSelect: options.onRescan
    },
    {
      label: 'Mark as fixed',
      icon: 'i-lucide-check',
      onSelect: options.onMarkFixed
    }
  ], dismissActionItems(options.onDismiss)]
}
