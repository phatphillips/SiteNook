<script setup lang="ts">
import type { SeoAffectedPageRow } from '~/utils/seoIssues'
import { parsePageUrl } from '~/utils/issueExplanation'

defineProps<{
  pages: SeoAffectedPageRow[]
}>()

const emit = defineEmits<{
  select: [issueId: string]
}>()
</script>

<template>
  <div class="space-y-2">
    <h3 class="text-xs font-semibold text-muted uppercase tracking-wide">
      Affected pages
    </h3>
    <div class="rounded-md border border-default overflow-hidden bg-elevated/30">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-default text-left text-muted text-xs">
            <th class="py-2 px-3 font-medium">Page</th>
            <th class="py-2 px-3 font-medium max-w-[12rem]">Current value</th>
            <th class="py-2 px-3 font-medium w-10" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="page in pages"
            :key="page.issueId"
            class="border-b border-default/60 last:border-0 hover:bg-elevated/40 cursor-pointer"
            @click="emit('select', page.issueId)"
          >
            <td class="py-2.5 px-3 max-w-[min(28rem,50vw)]">
              <a
                :href="page.url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary hover:underline block truncate"
                :title="page.url"
                @click.stop
              >
                <span class="font-medium">{{ parsePageUrl(page.url).domain }}</span><span class="text-muted">{{ parsePageUrl(page.url).path }}</span>
              </a>
              <p
                v-if="page.title"
                class="text-xs text-muted truncate mt-0.5"
                :title="page.title"
              >
                {{ page.title }}
              </p>
            </td>
            <td
              class="py-2.5 px-3 text-muted text-xs max-w-[12rem] truncate"
              :title="page.currentValue"
            >
              {{ page.currentValue || '—' }}
            </td>
            <td class="py-2.5 px-3 text-right">
              <UIcon name="i-lucide-chevron-right" class="text-muted size-4" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
