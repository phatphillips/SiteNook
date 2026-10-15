import { createSharedComposable, useStorage } from '@vueuse/core'
import {
  DEFAULT_PRIMARY_COLOR,
  PRIMARY_COLOR_OPTIONS,
  PRIMARY_COLOR_STORAGE_KEY,
  isPrimaryColor,
  primaryColorLabel,
  syncChartPrimaryCssVars,
  type PrimaryColor
} from '~/utils/primaryColor'

function readLocalPrimary(): PrimaryColor | null {
  if (!import.meta.client) return null
  try {
    const saved = localStorage.getItem(PRIMARY_COLOR_STORAGE_KEY)
    return saved && isPrimaryColor(saved) ? saved : null
  } catch {
    return null
  }
}

function _usePrimaryColor() {
  const appConfig = useAppConfig()
  const nuxtApp = useNuxtApp()

  const primaryCookie = useCookie<PrimaryColor>(PRIMARY_COLOR_STORAGE_KEY, {
    default: () => DEFAULT_PRIMARY_COLOR,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    watch: true
  })

  const stored = import.meta.client
    ? useStorage<PrimaryColor>(
        PRIMARY_COLOR_STORAGE_KEY,
        readLocalPrimary() ?? primaryCookie.value ?? DEFAULT_PRIMARY_COLOR,
        localStorage,
        { listenToStorageChanges: true }
      )
    : ref(primaryCookie.value ?? DEFAULT_PRIMARY_COLOR)

  function resolvePersistedPrimary(): PrimaryColor {
    const fromLocal = readLocalPrimary()
    if (fromLocal) return fromLocal
    if (isPrimaryColor(primaryCookie.value)) return primaryCookie.value
    return DEFAULT_PRIMARY_COLOR
  }

  function syncPrimaryPaint(value: PrimaryColor) {
    if (!import.meta.client) return
    // Resolve from Tailwind `--color-{name}-500` immediately (do not wait for Nuxt UI).
    syncChartPrimaryCssVars(value)
    void nextTick(() => {
      syncChartPrimaryCssVars(value)
      requestAnimationFrame(() => syncChartPrimaryCssVars(value))
    })
  }

  function applyPrimary(value: PrimaryColor) {
    if (appConfig.ui.colors.primary !== value) {
      appConfig.ui.colors.primary = value
    }
    if (primaryCookie.value !== value) {
      primaryCookie.value = value
    }
    if (import.meta.client && stored.value !== value) {
      stored.value = value
    }
    syncPrimaryPaint(value)
  }

  function ensurePrimaryApplied() {
    const expected = resolvePersistedPrimary()
    const current = String(appConfig.ui.colors.primary || '')
    if (current !== expected) {
      applyPrimary(expected)
      return
    }
    syncPrimaryPaint(expected)
  }

  applyPrimary(resolvePersistedPrimary())

  watch(stored, (value) => {
    if (isPrimaryColor(value)) {
      applyPrimary(value)
    }
  })

  if (import.meta.client) {
    onMounted(() => ensurePrimaryApplied())

    nuxtApp.hook('app:mounted', () => ensurePrimaryApplied())
    nuxtApp.hook('page:finish', () => ensurePrimaryApplied())
  }

  const primary = computed<PrimaryColor>(() => {
    const fromConfig = String(appConfig.ui.colors.primary || '')
    if (isPrimaryColor(fromConfig)) return fromConfig
    const fromStore = stored.value
    if (isPrimaryColor(fromStore)) return fromStore
    return DEFAULT_PRIMARY_COLOR
  })

  const primaryLabel = computed(() => primaryColorLabel(primary.value))

  function setPrimaryColor(value: PrimaryColor) {
    applyPrimary(value)
  }

  function restorePrimaryColor() {
    ensurePrimaryApplied()
  }

  return {
    primary,
    primaryLabel,
    options: PRIMARY_COLOR_OPTIONS,
    setPrimaryColor,
    restorePrimaryColor
  }
}

/**
 * Persist and apply Nuxt UI primary colour (`appConfig.ui.colors.primary`).
 * Survives refresh via localStorage + cookie (cookie helps SSR / rehydration).
 */
export const usePrimaryColor = createSharedComposable(_usePrimaryColor)
