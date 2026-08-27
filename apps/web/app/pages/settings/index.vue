<script setup lang="ts">
import type { Organization } from '~/types/sitenook'
import { isOrgAdmin, requireUserOrganizationId } from '~/utils/orgAccess'
import { formatPbClientError } from '~/utils/pbClientError'

definePageMeta({ middleware: 'auth' })

const { sessionUser, awaitAuthReady, syncAuth, pb } = usePocketBase()
const toast = useToast()

const pageReady = ref(false)
const org = ref<Organization | null>(null)
const showCloseModal = ref(false)
const confirmName = ref('')
const closeLoading = ref(false)
const closeError = ref('')

const canCloseOrg = computed(() => pageReady.value && isOrgAdmin(sessionUser.value))

async function loadOrganization() {
  if (!pb || !sessionUser.value) return
  try {
    const orgId = requireUserOrganizationId(sessionUser.value)
    org.value = await pb.collection('organizations').getOne<Organization>(orgId)
  } catch {
    org.value = null
  }
}

async function confirmCloseOrganization() {
  if (!pb?.authStore.token) return
  closeLoading.value = true
  closeError.value = ''
  try {
    await $fetch('/api/close-organization', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pb.authStore.token}` },
      body: { confirmName: confirmName.value.trim() }
    })
    toast.add({
      title: 'Organization closure scheduled',
      description: '30-day retention has started. Team members can still access the account until deletion.',
      color: 'warning'
    })
    await loadOrganization()
    showCloseModal.value = false
  } catch (error) {
    closeError.value = formatPbClientError(error)
  } finally {
    closeLoading.value = false
  }
}

function openCloseModal() {
  confirmName.value = ''
  closeError.value = ''
  showCloseModal.value = true
}

onMounted(async () => {
  await awaitAuthReady()
  syncAuth()
  pageReady.value = true
  await loadOrganization()
})
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="Settings" />
    </template>
    <template #body>
      <div class="max-w-2xl space-y-6">
        <UCard>
          <p class="text-muted text-sm">
            General application settings for your organization.
          </p>
        </UCard>

        <UCard v-if="canCloseOrg && org?.status !== 'closing'">
          <template #header>
            <div class="space-y-1">
              <h2 class="text-base font-semibold text-error">
                Danger zone
              </h2>
              <p class="text-sm text-muted">
                Permanently close this organization and cancel billing.
              </p>
            </div>
          </template>

          <p class="text-sm text-muted leading-relaxed mb-4">
            Closing starts a 30-day retention period. Active subscriptions are canceled, scans stop,
            and data is scheduled for permanent deletion after 30 days.
          </p>

          <UButton color="error" variant="outline" icon="i-lucide-building-2" @click="openCloseModal">
            Close organization
          </UButton>
        </UCard>

        <UCard v-else-if="org?.status === 'closing'">
          <p class="text-sm text-warning">
            This organization is in retention and still accessible. Data will be permanently deleted after the retention period.
          </p>
        </UCard>
      </div>

      <UModal
        v-model:open="showCloseModal"
        :ui="{ content: 'max-w-md' }"
        title="Close organization?"
      >
        <template #body>
          <div class="space-y-4">
            <p class="text-sm text-muted leading-relaxed">
              This cannot be undone from the dashboard. Type
              <strong class="text-default">{{ org?.name }}</strong>
              to confirm.
            </p>
            <UFormField label="Organization name">
              <UInput v-model="confirmName" class="w-full" autocomplete="off" />
            </UFormField>
            <UAlert v-if="closeError" color="error" variant="subtle" :title="closeError" />
          </div>
        </template>
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton color="neutral" variant="subtle" @click="showCloseModal = false">
              Cancel
            </UButton>
            <UButton
              color="error"
              :loading="closeLoading"
              :disabled="!confirmName.trim()"
              @click="confirmCloseOrganization"
            >
              Close organization
            </UButton>
          </div>
        </template>
      </UModal>
    </template>
  </AppDashboardPanel>
</template>
