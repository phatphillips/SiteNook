<script setup lang="ts">
import { getIssueWhyItMatters } from '~/utils/issueExplanation'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  score?: number | null
  issueCount?: number
  topIssues?: Array<{ id: string, rule_id?: string, description?: string, severity?: string }>
  brokenLinkCount?: number
  spellingCount?: number
}>()

const emit = defineEmits<{
  continue: []
  invite: []
}>()

const { markAhaSeen } = useOnboarding()

const plainIssues = computed(() =>
  (props.topIssues || []).slice(0, 3).map((issue) => {
    const partial = {
      rule_id: issue.rule_id || '',
      description: issue.description || '',
      impact: (issue.severity as 'critical' | 'serious' | 'moderate' | 'minor') || 'moderate',
      fix_suggestion: ''
    }
    return {
      id: issue.id,
      title: issue.description || issue.rule_id || 'Accessibility issue',
      why: getIssueWhyItMatters(partial as never)
    }
  })
)

async function onContinue() {
  await markAhaSeen()
  open.value = false
  emit('continue')
}

async function onInvite() {
  await markAhaSeen()
  open.value = false
  emit('invite')
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Here’s what matters most"
    description="A plain-language snapshot of inclusion and trust issues on your site."
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <template #body>
      <div class="space-y-5">
        <div class="rounded-xl border border-default bg-elevated/40 px-4 py-5 text-center">
          <p class="text-sm text-muted">
            Accessibility score
          </p>
          <p class="mt-1 text-4xl font-semibold tracking-tight text-highlighted">
            {{ score == null ? '—' : Math.round(score) }}
          </p>
          <p class="mt-2 text-sm text-muted">
            {{ issueCount ?? 0 }} issue{{ (issueCount ?? 0) === 1 ? '' : 's' }} that may block people using assistive tech
          </p>
        </div>

        <ul v-if="plainIssues.length" class="space-y-3">
          <li
            v-for="issue in plainIssues"
            :key="issue.id"
            class="rounded-lg border border-default/80 px-3 py-2.5"
          >
            <p class="text-sm font-medium text-highlighted">
              {{ issue.title }}
            </p>
            <p class="mt-1 text-xs leading-relaxed text-muted">
              {{ issue.why }}
            </p>
          </li>
        </ul>

        <p
          v-if="(brokenLinkCount ?? 0) > 0 || (spellingCount ?? 0) > 0"
          class="text-sm text-muted"
        >
          QA highlight:
          <template v-if="(brokenLinkCount ?? 0) > 0">
            {{ brokenLinkCount }} broken link{{ brokenLinkCount === 1 ? '' : 's' }}
          </template>
          <template v-if="(brokenLinkCount ?? 0) > 0 && (spellingCount ?? 0) > 0">
            ·
          </template>
          <template v-if="(spellingCount ?? 0) > 0">
            {{ spellingCount }} spelling finding{{ spellingCount === 1 ? '' : 's' }}
          </template>
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="onInvite">
          Invite a teammate
        </UButton>
        <UButton to="/accessibility/issues" @click="onContinue">
          Fix these first
        </UButton>
      </div>
    </template>
  </UModal>
</template>
