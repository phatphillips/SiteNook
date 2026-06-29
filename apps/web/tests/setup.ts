import { computed, onUnmounted, ref, watch } from 'vue'
import { vi } from 'vitest'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('watch', watch)
vi.stubGlobal('onUnmounted', onUnmounted)
vi.stubGlobal('useState', <T>(key: string, init?: () => T) => ref(init ? init() : (null as T)))
