/** Keeps loading UI visible for at least `minMs` to avoid skeleton flash on fast responses. */
export function useStableLoading(loading: Ref<boolean>, minMs = 280) {
  const stableLoading = ref(loading.value)
  let shownAt = 0
  let hideTimer: ReturnType<typeof setTimeout> | null = null

  watch(loading, (isLoading) => {
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = null
    }

    if (isLoading) {
      shownAt = Date.now()
      stableLoading.value = true
      return
    }

    const remaining = Math.max(0, minMs - (Date.now() - shownAt))
    if (remaining === 0) {
      stableLoading.value = false
      return
    }

    hideTimer = setTimeout(() => {
      stableLoading.value = false
      hideTimer = null
    }, remaining)
  }, { immediate: true })

  onUnmounted(() => {
    if (hideTimer) clearTimeout(hideTimer)
  })

  return stableLoading
}
