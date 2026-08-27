declare module 'sortablejs' {
  interface SortableEvent {
    newIndex?: number | null
    oldIndex?: number | null
  }

  interface SortableOptions {
    handle?: string
    animation?: number
    onEnd?: (event: SortableEvent) => void
  }

  export default class Sortable {
    constructor(element: Element, options?: SortableOptions)
    destroy(): void
  }
}
