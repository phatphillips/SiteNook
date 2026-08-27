/**
 * Keeps a workspace fitted between its current top edge and the viewport bottom.
 * The workspace's own children can then provide independent scrolling without
 * making the whole dashboard page grow with their content.
 */
export function useViewportRemainderHeight(
  target: Readonly<Ref<HTMLElement | null>>,
  options: { bottomGap?: number, minimum?: number } = {}
) {
  const height = ref('36rem')
  const bottomGap = options.bottomGap ?? 24
  const minimum = options.minimum ?? 320
  let resizeObserver: ResizeObserver | null = null

  function update() {
    if (!import.meta.client || !target.value) return
    const top = target.value.getBoundingClientRect().top
    height.value = `${Math.max(minimum, Math.floor(window.innerHeight - top - bottomGap))}px`
  }

  onMounted(() => {
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, { passive: true })

    if (typeof ResizeObserver !== 'undefined' && target.value?.parentElement) {
      resizeObserver = new ResizeObserver(update)
      resizeObserver.observe(target.value.parentElement)
    }

    requestAnimationFrame(update)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', update)
    window.removeEventListener('scroll', update)
    resizeObserver?.disconnect()
  })

  return { height, update }
}
