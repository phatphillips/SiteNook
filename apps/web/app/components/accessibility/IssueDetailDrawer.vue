<script setup lang="ts">
import type { AccessibilityIssue } from '~/types/accessiq'

const props = defineProps<{
  issue: AccessibilityIssue | null
  open: boolean
}>()

const emit = defineEmits<{ 'update:open': [boolean], fixed: [], dismiss: [string] }>()

const tab = ref('overview')

const pageUrl = computed(() => props.issue?.expand?.page?.url || '')

function copy(text: string) {
  navigator.clipboard.writeText(text)
  useToast().add({ title: 'Copied to clipboard' })
}
</script>

<template>
  <USlideover :open="open" @update:open="emit('update:open', $event)">
    <template v-if="issue" #content>
      <div class="p-6 space-y-4 h-full overflow-y-auto">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold">{{ issue.description }}</h2>
            <div class="flex gap-2 mt-2">
              <UBadge>{{ issue.wcag_level }}</UBadge>
              <UBadge :color="issue.impact === 'critical' ? 'error' : 'warning'">{{ issue.impact }}</UBadge>
            </div>
          </div>
          <UButton icon="i-lucide-x" variant="ghost" @click="emit('update:open', false)" />
        </div>

        <NuxtLink v-if="pageUrl" :to="pageUrl" target="_blank" class="text-sm text-primary flex items-center gap-1">
          Open affected page <UIcon name="i-lucide-external-link" class="size-3" />
        </NuxtLink>

        <UTabs v-model="tab" :items="[
          { label: 'Overview', value: 'overview' },
          { label: 'Code', value: 'code' },
          { label: 'How to Fix', value: 'fix' },
          { label: 'Resources', value: 'resources' }
        ]" />

        <div v-if="tab === 'overview'" class="space-y-4">
          <div>
            <h3 class="font-medium mb-1">Why this matters</h3>
            <p class="text-sm text-muted">{{ issue.description }}</p>
          </div>
          <div v-if="issue.html_snippet" class="border rounded-lg p-3 bg-elevated">
            <iframe
              :srcdoc="issue.html_snippet"
              sandbox=""
              class="w-full h-24 border-0"
              title="Element preview"
            />
          </div>
        </div>

        <div v-else-if="tab === 'code'" class="space-y-3">
          <pre class="text-xs bg-elevated rounded p-3 overflow-x-auto"><code>{{ issue.html_snippet }}</code></pre>
          <div class="flex items-center gap-2">
            <code class="text-sm flex-1">{{ issue.css_selector }}</code>
            <UButton size="xs" variant="outline" @click="copy(issue.css_selector || '')">Copy</UButton>
          </div>
        </div>

        <div v-else-if="tab === 'fix'" class="space-y-3">
          <h3 class="font-medium">Suggested fix</h3>
          <p class="text-sm">{{ issue.fix_suggestion }}</p>
          <div>
            <p class="text-xs font-medium mb-1">Before</p>
            <pre class="text-xs bg-red-500/10 rounded p-3"><code>{{ issue.html_snippet }}</code></pre>
          </div>
          <UButton size="sm" @click="copy(issue.fix_suggestion || '')">Copy fix guidance</UButton>
        </div>

        <div v-else class="space-y-2">
          <UButton v-if="issue.help_url" :to="issue.help_url" target="_blank" variant="link" block>
            axe-core rule documentation
          </UButton>
          <UButton v-if="issue.wcag_sc" :to="`https://www.w3.org/WAI/WCAG22/Understanding/`" target="_blank" variant="link" block>
            WCAG Success Criterion {{ issue.wcag_sc }}
          </UButton>
        </div>

        <div class="flex gap-2 pt-4 border-t border-default">
          <UButton @click="emit('fixed')">Mark as Fixed</UButton>
          <UDropdownMenu :items="[[
            { label: 'Won\'t fix', onSelect: () => emit('dismiss', 'wont_fix') },
            { label: 'False positive', onSelect: () => emit('dismiss', 'false_positive') },
            { label: 'Defer', onSelect: () => emit('dismiss', 'defer') }
          ]]">
            <UButton color="neutral" variant="outline">Dismiss</UButton>
          </UDropdownMenu>
        </div>
      </div>
    </template>
  </USlideover>
</template>
