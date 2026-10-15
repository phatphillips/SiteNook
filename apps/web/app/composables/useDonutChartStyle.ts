import { createSharedComposable, useStorage } from '@vueuse/core'
import {
  DEFAULT_DONUT_CHART_STYLE,
  DONUT_CHART_STYLE_STORAGE_KEY,
  isDonutChartStyle,
  type DonutChartStyle
} from '~/utils/donutChart'

function readStoredStyle(): DonutChartStyle | null {
  if (!import.meta.client) return null
  try {
    const saved = localStorage.getItem(DONUT_CHART_STYLE_STORAGE_KEY)
    return saved && isDonutChartStyle(saved) ? saved : null
  } catch {
    return null
  }
}

function _useDonutChartStyle() {
  const chartStyle = import.meta.client
    ? useStorage<DonutChartStyle>(
        DONUT_CHART_STYLE_STORAGE_KEY,
        readStoredStyle() ?? DEFAULT_DONUT_CHART_STYLE,
        localStorage,
        { listenToStorageChanges: true }
      )
    : ref<DonutChartStyle>(DEFAULT_DONUT_CHART_STYLE)

  function setChartStyle(style: DonutChartStyle) {
    if (!isDonutChartStyle(style)) return
    chartStyle.value = style
  }

  return {
    chartStyle,
    setChartStyle
  }
}

/**
 * Shared full/semi donut preference. Survives refresh via localStorage.
 */
export const useDonutChartStyle = createSharedComposable(_useDonutChartStyle)
