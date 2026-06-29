<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'plan-feature'], planFeature: 'policies' })

const { pb } = usePocketBase()
const policies = ref<Record<string, unknown>[]>([])
const showModal = ref(false)
const form = reactive({
  name: '',
  description: '',
  rule_type: 'keyword',
  pattern: '',
  category: 'qa',
  severity: 'warning',
  enabled: true
})

onMounted(async () => {
  policies.value = await pb.collection('policies').getFullList({ sort: '-created' })
})

async function createPolicy() {
  await pb.collection('policies').create(form)
  policies.value = await pb.collection('policies').getFullList({ sort: '-created' })
  showModal.value = false
}

async function togglePolicy(id: string, enabled: boolean) {
  await pb.collection('policies').update(id, { enabled })
  policies.value = await pb.collection('policies').getFullList({ sort: '-created' })
}
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="Policies">
        <template #right>
          <UButton icon="i-lucide-plus" @click="showModal = true">New Policy</UButton>
        </template>
      </DashboardPageNavbar>
    </template>
    <template #body>
      <div class="grid md:grid-cols-2 gap-4">
        <UCard v-for="policy in policies" :key="policy.id as string">
          <template #header>
            <div class="flex justify-between items-center">
              <h3 class="font-medium">{{ policy.name }}</h3>
              <USwitch
                :model-value="policy.enabled as boolean"
                @update:model-value="togglePolicy(policy.id as string, $event)"
              />
            </div>
          </template>
          <p class="text-sm text-muted mb-2">{{ policy.description }}</p>
          <code class="text-xs">{{ policy.pattern }}</code>
          <div class="flex gap-2 mt-2">
            <UBadge variant="subtle">{{ policy.category }}</UBadge>
            <UBadge :color="policy.severity === 'error' ? 'error' : 'warning'" variant="subtle">{{ policy.severity }}</UBadge>
          </div>
        </UCard>
      </div>
    </template>
  </AppDashboardPanel>

  <UModal v-model:open="showModal" title="Create Policy">
    <template #body>
      <form class="space-y-4" @submit.prevent="createPolicy">
        <UFormField label="Name"><UInput v-model="form.name" required /></UFormField>
        <UFormField label="Description"><UTextarea v-model="form.description" /></UFormField>
        <UFormField label="Rule Type">
          <USelect v-model="form.rule_type" :items="['keyword', 'regex', 'html_attribute']" />
        </UFormField>
        <UFormField label="Pattern"><UInput v-model="form.pattern" required /></UFormField>
        <UFormField label="Category">
          <USelect v-model="form.category" :items="['qa', 'brand', 'accessibility', 'security']" />
        </UFormField>
        <UButton type="submit">Create</UButton>
      </form>
    </template>
  </UModal>
</template>
