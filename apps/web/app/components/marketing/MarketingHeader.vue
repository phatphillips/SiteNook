<script setup lang="ts">
import { MARKETING_NAV_GROUPS } from '~/utils/marketingHeaderNav'
import { buildTeamTrialStartUrl } from '~/utils/planPricing'
import { parseSelfServiceSignupFlag } from '~/utils/selfServiceSignup'

const config = useRuntimeConfig()
const route = useRoute()

const selfServiceEnabled = computed(() => parseSelfServiceSignupFlag(config.public.selfServiceSignup))
const trialHref = computed(() =>
  selfServiceEnabled.value ? buildTeamTrialStartUrl() : '/signup'
)

const supportEmail = computed(() => {
  const email = config.public.supportEmail
  return typeof email === 'string' && email.trim() ? email.trim() : ''
})

const contactHref = computed(() =>
  supportEmail.value ? `mailto:${supportEmail.value}` : '/help'
)

const mobileOpen = ref(false)
const openDesktopGroup = ref<string | null>(null)
const openMobileGroup = ref<string | null>(null)

let closeTimer: ReturnType<typeof setTimeout> | null = null

watch(() => route.fullPath, () => {
  mobileOpen.value = false
  openDesktopGroup.value = null
  openMobileGroup.value = null
})

watch(mobileOpen, (open) => {
  if (!import.meta.client) return
  document.body.style.overflow = open ? 'hidden' : ''
})

onUnmounted(() => {
  if (closeTimer) clearTimeout(closeTimer)
  if (import.meta.client) document.body.style.overflow = ''
})

function scheduleCloseDesktop() {
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = setTimeout(() => {
    openDesktopGroup.value = null
  }, 120)
}

function openDesktop(label: string) {
  if (closeTimer) clearTimeout(closeTimer)
  openDesktopGroup.value = label
}

function toggleMobileGroup(label: string) {
  openMobileGroup.value = openMobileGroup.value === label ? null : label
}

function isActivePath(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-default/60 bg-elevated/70 backdrop-blur-md">
    <div class="relative mx-auto flex h-14 w-full max-w-6xl items-center px-4 sm:h-16 sm:px-6">
      <!-- Left: brand -->
      <NuxtLink
        to="/"
        class="relative z-10 inline-flex min-h-11 shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="SiteNook home"
      >
        <SiteNookLogo size="md" wordmark />
      </NuxtLink>

      <!-- Center: Product / Resources (desktop). Cursor absolute-center pattern -->
      <nav
        class="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 lg:flex"
        aria-label="Primary"
      >
        <div
          v-for="group in MARKETING_NAV_GROUPS"
          :key="group.label"
          class="relative"
          @mouseenter="openDesktop(group.label)"
          @mouseleave="scheduleCloseDesktop"
        >
          <button
            type="button"
            class="inline-flex min-h-11 items-center gap-1 rounded-md px-3 text-sm text-muted transition-colors hover:text-highlighted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            :class="openDesktopGroup === group.label ? 'text-highlighted' : ''"
            :aria-expanded="openDesktopGroup === group.label"
            :aria-haspopup="true"
            @focus="openDesktop(group.label)"
            @click="openDesktopGroup = openDesktopGroup === group.label ? null : group.label"
          >
            {{ group.label }}
            <UIcon
              name="i-lucide-chevron-down"
              class="size-3.5 opacity-70 transition-transform"
              :class="openDesktopGroup === group.label ? 'rotate-180' : ''"
              aria-hidden="true"
            />
          </button>

          <div
            v-show="openDesktopGroup === group.label"
            class="absolute left-1/2 top-full z-50 w-72 -translate-x-1/2 pt-2"
            @mouseenter="openDesktop(group.label)"
            @mouseleave="scheduleCloseDesktop"
          >
            <div
              class="overflow-hidden rounded-xl border border-default/80 bg-default p-1.5 shadow-xl shadow-black/10 ring-1 ring-default/40"
              role="menu"
            >
              <NuxtLink
                v-for="item in group.items"
                :key="item.to"
                :to="item.to"
                role="menuitem"
                class="block rounded-lg px-3 py-2.5 transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                :class="isActivePath(item.to) ? 'bg-elevated' : ''"
                @click="openDesktopGroup = null"
              >
                <span class="block text-sm font-medium text-highlighted">
                  {{ item.label }}
                </span>
                <span
                  v-if="item.description"
                  class="mt-0.5 block text-xs leading-snug text-muted"
                >
                  {{ item.description }}
                </span>
              </NuxtLink>
            </div>
          </div>
        </div>
      </nav>

      <!-- Right: Sign in / Contact (+ CTA) -->
      <div class="relative z-10 ml-auto flex items-center gap-1 sm:gap-2">
        <NuxtLink
          to="/sign-in"
          class="hidden min-h-11 items-center px-3 text-sm text-muted transition-colors hover:text-highlighted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:inline-flex"
        >
          Sign in
        </NuxtLink>
        <a
          :href="contactHref"
          class="hidden min-h-11 items-center px-3 text-sm text-muted transition-colors hover:text-highlighted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:inline-flex"
        >
          Contact
        </a>
        <UButton
          :to="trialHref"
          size="md"
          class="hidden min-h-10 sm:inline-flex"
        >
          Get started
        </UButton>

        <button
          type="button"
          class="inline-flex size-11 items-center justify-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-highlighted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
          :aria-expanded="mobileOpen"
          aria-controls="marketing-mobile-nav"
          :aria-label="mobileOpen ? 'Close menu' : 'Open menu'"
          @click="mobileOpen = !mobileOpen"
        >
          <UIcon
            :name="mobileOpen ? 'i-lucide-x' : 'i-lucide-menu'"
            class="size-5"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>

    <!-- Mobile panel -->
    <div
      v-show="mobileOpen"
      id="marketing-mobile-nav"
      class="border-t border-default/60 bg-default lg:hidden"
    >
      <nav class="mx-auto max-w-6xl space-y-1 px-4 py-3 sm:px-6" aria-label="Mobile">
        <div
          v-for="group in MARKETING_NAV_GROUPS"
          :key="group.label"
          class="rounded-lg"
        >
          <button
            type="button"
            class="flex w-full min-h-11 items-center justify-between rounded-lg px-3 text-left text-sm font-medium text-highlighted hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            :aria-expanded="openMobileGroup === group.label"
            @click="toggleMobileGroup(group.label)"
          >
            {{ group.label }}
            <UIcon
              name="i-lucide-chevron-down"
              class="size-4 text-muted transition-transform"
              :class="openMobileGroup === group.label ? 'rotate-180' : ''"
              aria-hidden="true"
            />
          </button>
          <ul
            v-show="openMobileGroup === group.label"
            class="space-y-0.5 pb-2 ps-2"
          >
            <li
              v-for="item in group.items"
              :key="item.to"
            >
              <NuxtLink
                :to="item.to"
                class="block rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-elevated hover:text-highlighted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                :class="isActivePath(item.to) ? 'bg-elevated text-highlighted' : ''"
              >
                <span class="font-medium">{{ item.label }}</span>
                <span
                  v-if="item.description"
                  class="mt-0.5 block text-xs text-muted"
                >
                  {{ item.description }}
                </span>
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div class="mt-3 space-y-1 border-t border-default/60 pt-3">
          <NuxtLink
            to="/sign-in"
            class="flex min-h-11 items-center rounded-lg px-3 text-sm text-muted hover:bg-elevated hover:text-highlighted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Sign in
          </NuxtLink>
          <a
            :href="contactHref"
            class="flex min-h-11 items-center rounded-lg px-3 text-sm text-muted hover:bg-elevated hover:text-highlighted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Contact
          </a>
          <UButton
            :to="trialHref"
            block
            size="md"
            class="mt-2 min-h-11"
          >
            Get started
          </UButton>
        </div>
      </nav>
    </div>
  </header>
</template>
