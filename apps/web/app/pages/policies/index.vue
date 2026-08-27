<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Policy } from '~/types/sitenook'
import { POLICY_ALL_SITES, type PolicyInput } from '~/composables/usePolicies'
import {
  A11Y_EXCLUDE_PRESETS,
  isExcludePolicy,
  policyKindLabel
} from '~/utils/policyPresets'
import { invalidCssSelectors, looksLikeRegexPattern } from '~/utils/cssSelector'

definePageMeta({ middleware: ['auth', 'plan-feature'], planFeature: 'policies' })

const toast = useToast()
const { sites, fetchSites } = useSites()
const { resolvedSiteId } = useWorkspaceSiteFilter()

const siteFilter = computed(() => resolvedSiteId.value)
const {
  policies,
  loading,
  loadError,
  createPolicy,
  updatePolicy,
  togglePolicy,
  deletePolicy
} = usePolicies(siteFilter)

const showModal = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const formError = ref<string | null>(null)

const emptyForm = (): PolicyInput => ({
  site: resolvedSiteId.value || POLICY_ALL_SITES,
  name: '',
  description: '',
  kind: 'flag_content',
  rule_type: 'keyword',
  pattern: '',
  category: 'qa',
  severity: 'warning',
  enabled: true
})

const form = reactive<PolicyInput>(emptyForm())

const isExcludeForm = computed(() => form.kind === 'exclude_from_accessibility')

const siteOptions = computed(() => [
  { label: 'All sites', value: POLICY_ALL_SITES },
  ...sites.value.map(site => ({ label: site.name, value: site.id }))
])

const kindOptions = [
  { label: 'Flag content', value: 'flag_content' },
  { label: 'Exclude from accessibility', value: 'exclude_from_accessibility' }
]

const ruleTypeOptions = [
  { label: 'Keyword', value: 'keyword' },
  { label: 'Regex', value: 'regex' },
  { label: 'HTML attribute', value: 'html_attribute' }
]

const categoryOptions = [
  { label: 'QA', value: 'qa' },
  { label: 'Brand', value: 'brand' },
  { label: 'Accessibility', value: 'accessibility' },
  { label: 'Security', value: 'security' }
]

const severityOptions = [
  { label: 'Warning', value: 'warning' },
  { label: 'Error', value: 'error' }
]

const cssSelectorPlaceholder = 'iframe[src*="youtube.com"]\niframe[src*="vimeo.com"]'

watch(() => form.kind, (kind) => {
  if (kind === 'exclude_from_accessibility') {
    form.rule_type = 'css_selector'
    form.category = 'accessibility'
    if (!form.name.trim()) form.name = 'Exclude embeds'
    if (looksLikeRegexPattern(form.pattern) || invalidCssSelectors(form.pattern).length) {
      form.pattern = ''
    }
  } else if (form.rule_type === 'css_selector') {
    form.rule_type = 'keyword'
  }
})

function applyPreset(pattern: string, label: string) {
  form.pattern = pattern
  if (!form.name.trim() || form.name === 'Exclude embeds') {
    form.name = label
  }
}

function siteLabel(policy: Policy) {
  if (!policy.site) return 'All sites'
  return policy.expand?.site?.name || '—'
}

const columns = computed((): TableColumn<Policy>[] => [
  { accessorKey: 'name', header: 'Name' },
  {
    id: 'site',
    header: 'Site',
    cell: ({ row }) => siteLabel(row.original)
  },
  {
    id: 'kind',
    header: 'Kind',
    cell: ({ row }) => policyKindLabel(row.original.kind)
  },
  { accessorKey: 'pattern', header: 'Pattern' },
  { accessorKey: 'category', header: 'Category' },
  { accessorKey: 'severity', header: 'Severity' },
  { id: 'enabled', header: 'Enabled' },
  { id: 'actions', header: '' }
])

onMounted(() => {
  void fetchSites()
})

function openCreate() {
  editingId.value = null
  Object.assign(form, emptyForm())
  formError.value = null
  showModal.value = true
}

function openEdit(policy: Policy) {
  editingId.value = policy.id
  Object.assign(form, {
    site: policy.site || POLICY_ALL_SITES,
    name: policy.name,
    description: policy.description || '',
    kind: policy.kind || 'flag_content',
    rule_type: policy.rule_type,
    pattern: policy.pattern,
    category: policy.category,
    severity: policy.severity,
    enabled: policy.enabled
  })
  formError.value = null
  showModal.value = true
}

async function savePolicy() {
  saving.value = true
  formError.value = null
  if (isExcludeForm.value) {
    const invalid = invalidCssSelectors(form.pattern)
    if (invalid.length) {
      formError.value = `Invalid CSS selector(s): ${invalid.join(', ')}. Use CSS (iframe), not regex (<iframe\\b). The All iframes preset inserts iframe.`
      saving.value = false
      return
    }
    if (!form.pattern.trim()) {
      formError.value = 'Enter at least one CSS selector, or choose a preset.'
      saving.value = false
      return
    }
  }
  try {
    if (editingId.value) {
      await updatePolicy(editingId.value, { ...form })
      toast.add({ title: 'Policy updated', color: 'success' })
    } else {
      await createPolicy({ ...form })
      toast.add({ title: 'Policy created', color: 'success' })
    }
    showModal.value = false
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Failed to save policy'
  } finally {
    saving.value = false
  }
}

async function onToggle(policy: Policy, enabled: boolean) {
  try {
    await togglePolicy(policy.id, enabled)
  } catch (err) {
    toast.add({
      title: 'Could not update policy',
      description: err instanceof Error ? err.message : undefined,
      color: 'error'
    })
  }
}

async function onDelete(policy: Policy) {
  try {
    await deletePolicy(policy.id)
    toast.add({ title: 'Policy deleted', color: 'success' })
  } catch (err) {
    toast.add({
      title: 'Could not delete policy',
      description: err instanceof Error ? err.message : undefined,
      color: 'error'
    })
  }
}

function matchesPath(policy: Policy) {
  if (policy.site) return `/sites/${policy.site}/qa/policies`
  return '/qa/policies'
}
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="Policies">
        <template #right>
          <UButton
            to="/qa/policies"
            icon="i-lucide-list"
            label="View matches"
            color="neutral"
            variant="outline"
          />
          <UButton
            icon="i-lucide-plus"
            label="New Policy"
            @click="openCreate"
          />
        </template>
      </DashboardPageNavbar>
    </template>
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">
          Flag content to find HTML matches under QA, or exclude elements (like YouTube iframes) from accessibility checks on the next scan.
        </p>

        <p
          v-if="loadError"
          class="text-sm text-error"
        >
          {{ loadError }}
        </p>

        <div
          v-if="loading && !policies.length"
          class="flex justify-center py-10"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="size-7 animate-spin text-muted"
          />
        </div>

        <div
          v-else-if="!policies.length"
          class="rounded-lg border border-dashed border-default p-8 text-center"
        >
          <p class="font-medium">
            No policies yet
          </p>
          <p class="mt-1 text-sm text-muted">
            Create a content rule or an accessibility exclusion for one site or all sites.
          </p>
          <UButton
            class="mt-4"
            icon="i-lucide-plus"
            label="New Policy"
            @click="openCreate"
          />
        </div>

        <div
          v-else
          class="overflow-x-auto rounded-lg border border-default"
        >
          <UTable
            :data="policies"
            :columns="columns"
            :loading="loading"
          >
            <template #kind-cell="{ row }">
              <UBadge
                :color="isExcludePolicy(row.original) ? 'info' : 'neutral'"
                variant="subtle"
              >
                {{ policyKindLabel(row.original.kind) }}
              </UBadge>
            </template>
            <template #pattern-cell="{ row }">
              <code class="whitespace-pre-wrap text-xs">{{ row.original.pattern }}</code>
            </template>
            <template #category-cell="{ row }">
              <UBadge
                v-if="!isExcludePolicy(row.original)"
                variant="subtle"
              >
                {{ row.original.category }}
              </UBadge>
              <span
                v-else
                class="text-muted"
              >—</span>
            </template>
            <template #severity-cell="{ row }">
              <UBadge
                v-if="!isExcludePolicy(row.original)"
                :color="row.original.severity === 'error' ? 'error' : 'warning'"
                variant="subtle"
              >
                {{ row.original.severity }}
              </UBadge>
              <span
                v-else
                class="text-muted"
              >—</span>
            </template>
            <template #enabled-cell="{ row }">
              <USwitch
                :model-value="row.original.enabled"
                @update:model-value="onToggle(row.original, $event)"
              />
            </template>
            <template #actions-cell="{ row }">
              <div class="flex justify-end gap-1">
                <UButton
                  v-if="!isExcludePolicy(row.original)"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-list"
                  :to="matchesPath(row.original)"
                />
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-pencil"
                  @click="openEdit(row.original)"
                />
                <UButton
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  @click="onDelete(row.original)"
                />
              </div>
            </template>
          </UTable>
        </div>
      </div>
    </template>
  </AppDashboardPanel>

  <UModal
    v-model:open="showModal"
    :title="editingId ? 'Edit Policy' : 'Create Policy'"
  >
    <template #body>
      <form
        class="space-y-4"
        @submit.prevent="savePolicy"
      >
        <UFormField
          label="Kind"
          required
          :hint="isExcludeForm
            ? 'Elements matching these selectors are skipped by axe on the next scan.'
            : 'Matching HTML creates findings under QA → Policies.'"
        >
          <USelect
            v-model="form.kind"
            :items="kindOptions"
            value-key="value"
          />
        </UFormField>
        <UFormField
          label="Applies to"
          required
        >
          <USelect
            v-model="form.site"
            :items="siteOptions"
            value-key="value"
            placeholder="Select scope"
            required
          />
        </UFormField>
        <UFormField
          label="Name"
          required
        >
          <UInput
            v-model="form.name"
            required
          />
        </UFormField>
        <UFormField label="Description">
          <UTextarea v-model="form.description" />
        </UFormField>

        <template v-if="isExcludeForm">
          <UFormField label="Presets">
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="preset in A11Y_EXCLUDE_PRESETS"
                :key="preset.label"
                type="button"
                size="xs"
                color="neutral"
                variant="outline"
                :label="preset.label"
                @click="applyPreset(preset.pattern, preset.label)"
              />
            </div>
          </UFormField>
          <UFormField
            label="CSS selectors"
            required
            hint="One CSS selector per line (or comma-separated). Use iframe, not regex like &lt;iframe\\b. Example: iframe[src*=&quot;youtube.com&quot;]"
          >
            <UTextarea
              v-model="form.pattern"
              :rows="5"
              required
              :placeholder="cssSelectorPlaceholder"
            />
          </UFormField>
        </template>

        <template v-else>
          <UFormField label="Rule Type">
            <USelect
              v-model="form.rule_type"
              :items="ruleTypeOptions"
              value-key="value"
            />
          </UFormField>
          <UFormField
            label="Pattern"
            required
          >
            <UInput
              v-model="form.pattern"
              required
            />
          </UFormField>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Category">
              <USelect
                v-model="form.category"
                :items="categoryOptions"
                value-key="value"
              />
            </UFormField>
            <UFormField label="Severity">
              <USelect
                v-model="form.severity"
                :items="severityOptions"
                value-key="value"
              />
            </UFormField>
          </div>
        </template>

        <UFormField label="Enabled">
          <USwitch v-model="form.enabled" />
        </UFormField>
        <p
          v-if="formError"
          class="text-sm text-error"
        >
          {{ formError }}
        </p>
        <div class="flex justify-end gap-2">
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            label="Cancel"
            @click="showModal = false"
          />
          <UButton
            type="submit"
            :loading="saving"
            :label="editingId ? 'Save' : 'Create'"
          />
        </div>
      </form>
    </template>
  </UModal>
</template>
