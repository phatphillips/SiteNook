import type { InjectionKey, Ref } from 'vue'

/**
 * Parent issues table horizontal scroller.
 * Expanded affected-pages Title/pagination stick against this element;
 * metrics share the same scroll naturally.
 */
export const issuesTableScrollKey: InjectionKey<Ref<HTMLElement | null | undefined>>
  = Symbol('issuesTableScroll')
