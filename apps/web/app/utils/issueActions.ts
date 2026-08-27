export type DismissReason = 'wont_fix' | 'false_positive' | 'defer'

export interface IssueActionMenuItem {
  label: string
  icon?: string
  onSelect?: () => void
  children?: IssueActionMenuItem[]
}

export function dismissActionItems(onDismiss: (reason: DismissReason) => void): IssueActionMenuItem[] {
  return [
    {
      label: 'Won\'t fix',
      icon: 'i-lucide-ban',
      onSelect: () => onDismiss('wont_fix')
    },
    {
      label: 'False positive',
      icon: 'i-lucide-circle-x',
      onSelect: () => onDismiss('false_positive')
    },
    {
      label: 'Defer',
      icon: 'i-lucide-clock',
      onSelect: () => onDismiss('defer')
    }
  ]
}

/** Single Dismiss control with nested reason choices. */
export function dismissMenuItem(onDismiss: (reason: DismissReason) => void): IssueActionMenuItem {
  return {
    label: 'Dismiss',
    icon: 'i-lucide-x',
    children: dismissActionItems(onDismiss)
  }
}

export function issueRowActionGroups(options: {
  onViewDetails: () => void
  onRescan: () => void
  onMarkFixed: () => void
  onDismiss: (reason: DismissReason) => void
  rescanLabel?: string
}): IssueActionMenuItem[][] {
  return [
    [
      {
        label: 'View details',
        icon: 'i-lucide-eye',
        onSelect: options.onViewDetails
      },
      {
        label: options.rescanLabel ?? 'Rescan page',
        icon: 'i-lucide-refresh-cw',
        onSelect: options.onRescan
      }
    ],
    [
      {
        label: 'Mark as fixed',
        icon: 'i-lucide-check',
        onSelect: options.onMarkFixed
      },
      dismissMenuItem(options.onDismiss)
    ]
  ]
}
