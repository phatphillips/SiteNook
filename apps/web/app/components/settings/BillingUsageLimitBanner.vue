<script setup lang="ts">
import { isOrgAdmin } from '~/utils/orgAccess'

const route = useRoute()
const { sessionUser, awaitAuthReady, pb } = usePocketBase()
const { organization } = useTenantOrg()

const status = ref<'ok' | 'warning' | 'exceeded'>('ok')
const messages = ref<string[]>([])

const isAdmin = computed(() => isOrgAdmin(sessionUser.value))

const showBanner = computed(() =>
  isAdmin.value
  && route.path !== '/settings/billing'
  && (status.value === 'warning' || status.value === 'exceeded')
  && messages.value.length > 0
  && organization.value?.status !== 'closing'
)

async function loadUsageStatus() {
  if (!pb?.authStore.token || !isAdmin.value) return
  try {
    const result = await $fetch<{
      status: 'ok' | 'warning' | 'exceeded'
      messages: string[]
    }>('/api/billing/usage-status', {
      headers: { Authorization: `Bearer ${pb.authStore.token}` }
    })
    status.value = result.status
    messages.value = result.messages
  } catch {
    status.value = 'ok'
    messages.value = []
  }
}

onMounted(async () => {
  await awaitAuthReady()
  await loadUsageStatus()
})

watch(() => organization.value?.plan, () => {
  void loadUsageStatus()
})
</script>

<template>
  <BillingUsageLimitAlert
    v-if="showBanner"
    :status="status === 'exceeded' ? 'exceeded' : 'warning'"
    :messages="messages"
    billing-path="/settings/billing"
  />
</template>
