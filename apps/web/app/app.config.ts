export default defineAppConfig({
  ui: {
    colors: {
      primary: 'neutral',
      neutral: 'zinc'
    },
    button: {
      defaultVariants: {
        color: 'neutral',
        variant: 'solid'
      },
      slots: {
        base: 'font-medium'
      }
    },
    card: {
      slots: {
        root: 'rounded-lg overflow-visible'
      }
    },
    dashboardPanel: {
      slots: {
        // Stay within the fixed dashboard group height so the body slot scrolls.
        root: 'relative flex flex-col min-w-0 min-h-0 h-full lg:not-last:border-e lg:not-last:border-default shrink-0',
        body: 'overflow-y-auto flex flex-col flex-1 min-h-0 scroll-region p-4 sm:p-6'
      }
    },
    table: {
      slots: {
        root: 'relative w-full',
        thead: '[&>tr]:after:hidden',
        th: 'px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted',
        td: 'px-4 py-3.5 text-sm text-default',
        tr: 'border-b border-default/50 last:border-b-0 data-[expanded=true]:bg-elevated/30 hover:bg-elevated/20 transition-colors'
      }
    }
  }
})
