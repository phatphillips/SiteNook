export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue',
      neutral: 'zinc'
    },
    link: {
      base: 'underline underline-offset-2 focus-visible:outline-primary',
      compoundVariants: [
        {
          active: false,
          disabled: false,
          class: 'hover:text-default transition-colors'
        }
      ]
    },
    button: {
      defaultVariants: {
        color: 'neutral',
        variant: 'solid',
        size: 'sm'
      },
      slots: {
        base: 'font-medium text-sm cursor-pointer disabled:cursor-not-allowed'
      },
      compoundVariants: [
        {
          color: 'neutral',
          variant: 'outline',
          class: 'ring-0 border border-[var(--input-surface-border)] bg-[var(--input-surface-bg)] text-[var(--input-surface-fg)] hover:bg-[var(--input-surface-hover-bg)] active:bg-[var(--input-surface-hover-bg)] disabled:bg-[var(--input-surface-bg)] aria-disabled:bg-[var(--input-surface-bg)] focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1'
        },
        {
          color: 'neutral',
          variant: 'soft',
          class: 'bg-[var(--control-surface-bg)] text-[var(--control-surface-fg)] hover:bg-[var(--control-surface-hover-bg)] active:bg-[var(--control-surface-hover-bg)]'
        },
        {
          color: 'neutral',
          variant: 'subtle',
          class: 'ring-0 bg-[var(--control-surface-bg)] text-[var(--control-surface-fg)] hover:bg-[var(--control-surface-hover-bg)] active:bg-[var(--control-surface-hover-bg)]'
        }
      ]
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
    navigationMenu: {
      slots: {
        link: 'rounded-md px-3 py-2 font-medium text-[var(--sidebar-nav-fg)] before:rounded-md data-[active=true]:text-highlighted data-[active=true]:before:bg-[var(--sidebar-nav-active-bg)] data-[active=true]:before:opacity-100',
        childLink: 'rounded-md px-3 py-2 font-medium text-[var(--sidebar-nav-fg)] before:rounded-md data-[active=true]:text-highlighted data-[active=true]:before:bg-[var(--sidebar-nav-active-bg)] data-[active=true]:before:opacity-100',
        linkLeadingIcon: 'text-[var(--sidebar-nav-icon)] group-data-[active=true]:text-highlighted',
        childLinkIcon: 'text-[var(--sidebar-nav-icon)] group-data-[active=true]:text-highlighted'
      }
    },
    input: {
      defaultVariants: {
        size: 'sm'
      },
      slots: {
        base: 'text-sm bg-[var(--input-surface-bg)] text-[var(--input-surface-fg)] ring-0 border border-[var(--input-surface-border)] focus-visible:ring-0 hover:bg-[var(--input-surface-hover-bg)]'
      }
    },
    textarea: {
      defaultVariants: {
        size: 'sm'
      },
      slots: {
        base: 'text-sm bg-[var(--input-surface-bg)] text-[var(--input-surface-fg)] ring-0 border border-[var(--input-surface-border)] focus-visible:ring-0 hover:bg-[var(--input-surface-hover-bg)]'
      }
    },
    selectMenu: {
      defaultVariants: {
        size: 'sm'
      },
      slots: {
        base: 'text-sm bg-[var(--input-surface-bg)] text-[var(--input-surface-fg)] ring-0 border border-[var(--input-surface-border)] focus-visible:ring-0 hover:bg-[var(--input-surface-hover-bg)]',
        // Page canvas is --ui-bg (gray); menus must stay solid elevated white.
        content: 'bg-elevated ring ring-default'
      }
    },
    dropdownMenu: {
      slots: {
        content: 'bg-elevated ring ring-default'
      }
    },
    popover: {
      slots: {
        content: 'bg-elevated ring ring-default'
      }
    },
    modal: {
      slots: {
        // Soft blur behind dialogs so attention stays on the modal.
        overlay: 'backdrop-blur-[3px]',
        // Page canvas is --ui-bg (gray); dialog chrome must stay elevated white.
        content: 'bg-elevated divide-y divide-default ring ring-default',
        header: 'bg-elevated',
        body: 'bg-elevated',
        footer: 'bg-elevated'
      }
    },
    slideover: {
      slots: {
        overlay: 'backdrop-blur-[3px]',
        content: 'bg-elevated divide-y divide-default',
        header: 'bg-elevated',
        body: 'bg-elevated',
        footer: 'bg-elevated'
      }
    },
    select: {
      defaultVariants: {
        size: 'sm'
      },
      slots: {
        base: 'text-sm bg-[var(--input-surface-bg)] text-[var(--input-surface-fg)] ring-0 border border-[var(--input-surface-border)] focus-visible:ring-0 hover:bg-[var(--input-surface-hover-bg)]'
      }
    },
    inputMenu: {
      defaultVariants: {
        size: 'sm'
      },
      slots: {
        base: 'text-sm bg-[var(--input-surface-bg)] text-[var(--input-surface-fg)] ring-0 border border-[var(--input-surface-border)] focus-visible:ring-0 hover:bg-[var(--input-surface-hover-bg)]'
      }
    },
    dashboardSidebar: {
      slots: {
        handle: ''
      }
    },
    dashboardResizeHandle: {
      // Hit-area + divider are drawn in main.css (.sidebar-resize-handle).
      // Do not use Tailwind before: utilities — they steal ::before from the header-band fill.
      base: 'sidebar-resize-handle hidden lg:block touch-none select-none cursor-ew-resize relative'
    },
    table: {
      slots: {
        root: 'relative w-full bg-elevated',
        thead: '[&>tr]:after:hidden bg-elevated',
        // Match Content Explorer / DATA_TABLE_UI header height + text-sm.
        th: 'px-4 py-3 text-sm font-medium text-muted normal-case bg-elevated',
        td: 'px-4 py-3 text-sm text-default bg-elevated',
        tr: 'border-b border-default/50 last:border-b-0 bg-elevated data-[expanded=true]:bg-elevated hover:bg-muted/60 transition-colors'
      }
    },
    /** Kumo-inspired: accent border + colored title/icon, stacked via UApp toaster.expand=false. */
    toast: {
      slots: {
        root: 'relative group overflow-hidden bg-default shadow-lg rounded-lg border p-4 flex gap-2.5 ring-0',
        title: 'text-sm font-medium',
        description: 'text-sm text-muted',
        icon: 'shrink-0 size-5',
        close: 'p-0'
      },
      variants: {
        color: {
          primary: {
            root: 'border-primary',
            title: 'text-primary',
            icon: 'text-primary',
            close: 'text-primary'
          },
          secondary: {
            root: 'border-secondary',
            title: 'text-secondary',
            icon: 'text-secondary',
            close: 'text-secondary'
          },
          success: {
            root: 'border-success',
            title: 'text-success',
            icon: 'text-success',
            close: 'text-success'
          },
          info: {
            root: 'border-info',
            title: 'text-info',
            icon: 'text-info',
            close: 'text-info'
          },
          warning: {
            root: 'border-warning',
            title: 'text-warning',
            icon: 'text-warning',
            close: 'text-warning'
          },
          error: {
            root: 'border-error',
            title: 'text-error',
            icon: 'text-error',
            close: 'text-error'
          },
          neutral: {
            root: 'border-default',
            title: 'text-highlighted',
            icon: 'text-highlighted',
            close: 'text-muted'
          }
        }
      },
      defaultVariants: {
        color: 'neutral'
      }
    }
  }
})
