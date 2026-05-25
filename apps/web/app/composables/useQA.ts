import type { BrokenLink, PageRecord, Scan, SpellingIssue } from '~/types/accessiq'

export function useQA(siteId: Ref<string> | string) {
  const { pb } = usePocketBase()
  const id = computed(() => (typeof siteId === 'object' ? siteId.value : siteId))

  const latestScan = ref<Scan | null>(null)
  const brokenLinks = ref<BrokenLink[]>([])
  const spelling = ref<SpellingIssue[]>([])
  const pages = ref<PageRecord[]>([])
  const inventory = ref<Record<string, unknown>[]>([])
  const loading = ref(false)

  async function fetchQAData() {
    if (!id.value) return
    loading.value = true
    try {
      const scanResult = await pb.collection('scans').getList(1, 1, {
        filter: `site = "${id.value}" && status = 'complete'`,
        sort: '-completed_at'
      })
      latestScan.value = scanResult.items[0] as unknown as Scan
      if (!latestScan.value) return

      const scanId = latestScan.value.id
      const [links, spell, pageList, inv] = await Promise.all([
        pb.collection('qa_broken_links').getFullList({ filter: `scan = "${scanId}"`, expand: 'page' }),
        pb.collection('qa_spelling').getFullList({ filter: `scan = "${scanId}"`, expand: 'page' }),
        pb.collection('pages').getFullList({ filter: `scan = "${scanId}"` }),
        pb.collection('qa_inventory').getFullList({ filter: `scan = "${scanId}"` })
      ])

      brokenLinks.value = links as unknown as BrokenLink[]
      spelling.value = spell as unknown as SpellingIssue[]
      pages.value = pageList as unknown as PageRecord[]
      inventory.value = inv
    } finally {
      loading.value = false
    }
  }

  const brokenLinkCount = computed(() => brokenLinks.value.filter(l => l.status === 'broken').length)
  const misspellingCount = computed(() => spelling.value.filter(s => s.confidence === 'error').length)
  const avgReadability = computed(() => {
    if (!pages.value.length) return 0
    const sum = pages.value.reduce((n, p) => n + (p.readability_score || 0), 0)
    return Math.round(sum / pages.value.length)
  })

  watch(id, fetchQAData, { immediate: true })

  return {
    latestScan,
    brokenLinks,
    spelling,
    pages,
    inventory,
    loading,
    brokenLinkCount,
    misspellingCount,
    avgReadability,
    fetchQAData
  }
}
