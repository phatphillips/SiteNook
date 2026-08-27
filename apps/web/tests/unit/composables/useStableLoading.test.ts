import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useStableLoading } from '~/composables/useStableLoading'

describe('useStableLoading', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps loading true for minMs after source becomes false', async () => {
    const loading = ref(true)
    const stable = useStableLoading(loading, 300)

    loading.value = false
    await nextTick()
    expect(stable.value).toBe(true)

    vi.advanceTimersByTime(299)
    expect(stable.value).toBe(true)

    vi.advanceTimersByTime(1)
    expect(stable.value).toBe(false)
  })

  it('extends display when loading toggles quickly', async () => {
    const loading = ref(false)
    const stable = useStableLoading(loading, 280)

    loading.value = true
    await nextTick()
    expect(stable.value).toBe(true)

    loading.value = false
    await nextTick()
    vi.advanceTimersByTime(280)
    expect(stable.value).toBe(false)
  })
})
