import type { ContentExplorerEntry, Scan } from '~/types/sitenook'
import { pickBaselineCompleteScan } from '~/utils/inventoryPages'
import { pbRelation } from '~/utils/pbFilter'

function pageToEntry(page: Record<string, unknown>): ContentExplorerEntry {
  const blobId = typeof page.content_blob === 'string' ? page.content_blob : undefined
  const hasMarkdown = Boolean(blobId)
  const title = String(page.title || page.url || 'Untitled').trim()
  return {
    id: String(page.id),
    pageId: String(page.id),
    url: String(page.url ?? ''),
    title,
    blobId,
    unchanged: page.content_unchanged === true,
    hasContent: hasMarkdown,
    failed: !hasMarkdown
  }
}

export function useContentExplorer(siteId: Ref<string | undefined>) {
  const { pb } = usePocketBase()
  const entries = ref<ContentExplorerEntry[]>([])
  const latestScan = ref<Scan | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchExplorerData() {
    const id = siteId.value?.trim()
    if (!pb || !id) {
      entries.value = []
      latestScan.value = null
      return
    }

    loading.value = true
    error.value = null
    try {
      const scans = await pb.collection('scans').getFullList({
        filter: pbRelation('site', id),
        sort: '-completed_at,-started_at',
        fields: 'id,status,completed_at,started_at'
      }) as unknown as Scan[]

      const baseline = pickBaselineCompleteScan(scans)
      latestScan.value = baseline
      if (!baseline) {
        entries.value = []
        return
      }

      const pages = await pb.collection('pages').getFullList({
        filter: pbRelation('scan', baseline.id),
        sort: 'url',
        fields: 'id,url,title,content_blob,content_hash,content_unchanged,preview_image'
      })

      entries.value = pages.map(p => pageToEntry(p as Record<string, unknown>))
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load content explorer'
      entries.value = []
    } finally {
      loading.value = false
    }
  }

  watch(siteId, () => {
    void fetchExplorerData()
  }, { immediate: true })

  return {
    entries,
    latestScan,
    loading,
    error,
    fetchExplorerData
  }
}
