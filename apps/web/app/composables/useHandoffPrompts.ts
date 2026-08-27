import type { AiHandoffPack, Site } from '~/types/sitenook'
import {
  type HandoffPromptsRecord,
  type HandoffSectionId,
  isUsingDefaultPrompt,
  parseHandoffPrompts,
  resetSectionPrompt,
  resolveActivePrompt,
  saveSectionPrompt,
  sectionHistory
} from '~/utils/handoffSectionPrompts'

const PACK_LIMIT = 10

export function useHandoffPrompts(siteId: MaybeRefOrGetter<string>) {
  const { pb, requireUser } = usePocketBase()
  const { refreshSite } = useSites()

  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const stored = ref<HandoffPromptsRecord>({})
  const recentPacks = ref<AiHandoffPack[]>([])
  const packsLoading = ref(false)

  const resolvedSiteId = computed(() => String(toValue(siteId) || '').trim())

  function activePrompt(section: HandoffSectionId): string {
    return resolveActivePrompt(stored.value, section)
  }

  function historyFor(section: HandoffSectionId): string[] {
    return sectionHistory(stored.value, section)
  }

  function usingDefault(section: HandoffSectionId): boolean {
    return isUsingDefaultPrompt(stored.value, section)
  }

  async function load() {
    const id = resolvedSiteId.value
    if (!id || !pb) return
    requireUser()
    loading.value = true
    error.value = null
    try {
      const site = await pb.collection('sites').getOne(id, {
        fields: 'id,handoff_prompts'
      }) as unknown as Site
      stored.value = parseHandoffPrompts(site.handoff_prompts)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load handoff prompts'
    } finally {
      loading.value = false
    }
  }

  async function persist(next: HandoffPromptsRecord) {
    const id = resolvedSiteId.value
    if (!id) throw new Error('siteId is required')
    if (!pb) throw new Error('PocketBase is not ready')
    requireUser()
    saving.value = true
    error.value = null
    try {
      const record = await pb.collection('sites').update(id, {
        handoff_prompts: next
      }) as unknown as Site
      stored.value = parseHandoffPrompts(record.handoff_prompts)
      await refreshSite(id).catch(() => {})
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save handoff prompts'
      throw err
    } finally {
      saving.value = false
    }
  }

  async function save(section: HandoffSectionId, prompt: string) {
    await persist(saveSectionPrompt(stored.value, section, prompt))
  }

  async function reset(section: HandoffSectionId) {
    await persist(resetSectionPrompt(stored.value, section))
  }

  async function fetchRecentPacks() {
    const id = resolvedSiteId.value
    if (!id || !pb) return
    requireUser()
    packsLoading.value = true
    try {
      const result = await pb.collection('ai_handoff_packs').getList(1, PACK_LIMIT, {
        filter: `site = "${id}"`,
        sort: '-created'
      })
      recentPacks.value = result.items as unknown as AiHandoffPack[]
    } catch {
      recentPacks.value = []
    } finally {
      packsLoading.value = false
    }
  }

  watch(resolvedSiteId, (id) => {
    if (!id) return
    void load()
  }, { immediate: true })

  return {
    loading,
    saving,
    error,
    stored,
    recentPacks,
    packsLoading,
    activePrompt,
    historyFor,
    usingDefault,
    load,
    save,
    reset,
    fetchRecentPacks
  }
}
