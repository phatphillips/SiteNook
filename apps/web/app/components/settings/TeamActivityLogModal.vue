<script setup lang="ts">
import type { TeamActivityLogEntry } from '~/utils/teamActivityLog'
import {
  formatTeamActivityDetail,
  formatTeamActivitySentence,
  formatTeamActivityTimestamp,
  getTeamActivityActionMeta
} from '~/utils/teamActivityLog'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  loading?: boolean
  entries: TeamActivityLogEntry[]
  page: number
  totalPages: number
  totalItems: number
}>()

const emit = defineEmits<{
  'update:page': [number]
}>()
</script>

<template>
  <UModal
    v-model:open="open"
    :ui="{
      content: 'max-w-2xl',
      header: 'border-b border-default/60',
      footer: 'border-t border-default/60'
    }"
  >
    <template #header>
      <div class="flex items-start gap-3">
        <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
          <UIcon name="i-lucide-history" class="size-5 text-primary" />
        </div>
        <div>
          <h2 class="text-lg font-semibold text-highlighted">
            Team activity
          </h2>
          <p class="mt-0.5 text-sm text-muted">
            Recent changes to members, roles, and billing contacts.
          </p>
        </div>
      </div>
    </template>

    <template #body>
      <div class="space-y-3">
        <p v-if="loading" class="text-sm text-muted">
          Loading activity…
        </p>

        <p v-else-if="!entries.length" class="text-sm text-muted">
          No team activity recorded yet.
        </p>

        <ul v-else class="divide-y divide-default/60">
          <li
            v-for="entry in entries"
            :key="entry.id"
            class="flex gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div
              class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-elevated/60 ring-1 ring-default/60"
            >
              <UIcon
                :name="getTeamActivityActionMeta(entry.action).icon"
                class="size-4 text-muted"
              />
            </div>
            <div class="min-w-0 flex-1 space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <UBadge
                  :color="getTeamActivityActionMeta(entry.action).color"
                  variant="subtle"
                  size="sm"
                >
                  {{ getTeamActivityActionMeta(entry.action).label }}
                </UBadge>
                <span class="text-xs text-muted">
                  {{ formatTeamActivityTimestamp(entry) }}
                </span>
              </div>
              <p class="text-sm leading-relaxed text-highlighted">
                {{ formatTeamActivitySentence(entry) }}
              </p>
              <p
                v-if="formatTeamActivityDetail(entry)"
                class="text-xs leading-relaxed text-muted"
              >
                {{ formatTeamActivityDetail(entry) }}
              </p>
            </div>
          </li>
        </ul>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-3">
        <p class="text-xs text-muted">
          {{ totalItems }} {{ totalItems === 1 ? 'event' : 'events' }}
        </p>
        <div class="flex items-center gap-2">
          <UButton
            color="neutral"
            variant="subtle"
            icon="i-lucide-chevron-left"
            :disabled="loading || page <= 1"
            @click="emit('update:page', page - 1)"
          >
            Previous
          </UButton>
          <span class="text-sm text-muted">
            Page {{ page }} of {{ Math.max(totalPages, 1) }}
          </span>
          <UButton
            color="neutral"
            variant="subtle"
            trailing-icon="i-lucide-chevron-right"
            :disabled="loading || page >= totalPages"
            @click="emit('update:page', page + 1)"
          >
            Next
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
