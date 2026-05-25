<script setup lang="ts">
import type { SpellingIssue } from '~/types/accessiq'

const props = defineProps<{ items: SpellingIssue[] }>()

const tab = ref<'errors' | 'review'>('errors')
const dictionary = ref<string[]>([])
const newWord = ref('')

const displayed = computed(() =>
  props.items.filter(i =>
    tab.value === 'errors' ? i.confidence === 'error' : i.confidence === 'review'
  )
)

function addWord() {
  if (newWord.value.trim()) {
    dictionary.value.push(newWord.value.trim())
    newWord.value = ''
  }
}
</script>

<template>
  <div class="grid lg:grid-cols-3 gap-6">
    <div class="lg:col-span-2 space-y-4">
      <div class="flex gap-2">
        <UButton :variant="tab === 'errors' ? 'solid' : 'outline'" @click="tab = 'errors'">Misspellings</UButton>
        <UButton :variant="tab === 'review' ? 'solid' : 'outline'" @click="tab = 'review'">Words to Review</UButton>
      </div>

      <UTable
        :data="displayed"
        :columns="[
          { accessorKey: 'word', header: 'Word' },
          { accessorKey: 'context', header: 'Context' },
          { id: 'page', header: 'Page URL', cell: ({ row }) => row.original.expand?.page?.url || '' }
        ]"
      />
    </div>

    <UCard>
      <template #header>
        <h3 class="font-medium">Custom Dictionary</h3>
      </template>
      <div class="flex gap-2 mb-3">
        <UInput v-model="newWord" placeholder="Add word..." class="flex-1" />
        <UButton @click="addWord">Add</UButton>
      </div>
      <ul class="space-y-1">
        <li v-for="word in dictionary" :key="word" class="text-sm">{{ word }}</li>
      </ul>
      <p v-if="!dictionary.length" class="text-sm text-muted">No custom words yet</p>
    </UCard>
  </div>
</template>
