<script setup lang="ts">
import type { TeamMember } from '~/composables/useTeamMembers'
import type { TeamActivityLogEntry } from '~/utils/teamActivityLog'
import type { OrgUserRole } from '~/utils/orgAccess'
import {
  canRemoveMember,
  isOrgAdmin
} from '~/utils/orgAccess'
import { isCommercialEnabled } from '~/utils/commercial'
import { formatPbClientError } from '~/utils/pbClientError'

definePageMeta({ middleware: 'auth' })

const { sessionUser, awaitAuthReady, syncAuth } = usePocketBase()
const {
  members,
  loading,
  fetchMembers,
  createMember,
  updateMember,
  sendSetPasswordEmail,
  removeMember,
  removeMembers,
  fetchActivityLog
} = useTeamMembers()
const toast = useToast()

type TeamMembersTableExpose = {
  selectedCount: number
  getSelectedMembers: () => TeamMember[]
  clearSelection?: () => void
}

const teamTable = useTemplateRef<TeamMembersTableExpose | null>('teamTable')

const pageReady = ref(false)
const canManageTeam = computed(() => pageReady.value && isOrgAdmin(sessionUser.value))
const commercialEnabled = computed(() => isCommercialEnabled())
const tableSearch = ref('')
const showAddModal = ref(false)
const submitting = ref(false)
const formError = ref('')

const drawerMember = ref<TeamMember | null>(null)
const showMemberDrawer = ref(false)
const drawerSaving = ref(false)
const drawerEmailSending = ref(false)

const pendingRemoveMemberIds = ref<string[]>([])
const showRemoveModal = ref(false)
const confirmLoading = ref(false)
const bulkRemoveError = ref('')

const showActivityLog = ref(false)
const activityLoading = ref(false)
const activityEntries = ref<TeamActivityLogEntry[]>([])
const activityPage = ref(1)
const activityTotalPages = ref(1)
const activityTotalItems = ref(0)

const selectedCount = computed(() => teamTable.value?.selectedCount ?? 0)

const filteredMembers = computed(() => {
  const query = tableSearch.value.trim().toLowerCase()
  const currentUserId = sessionUser.value?.id
  let list = members.value
  if (query) {
    list = list.filter((member) => {
      const haystack = `${member.name} ${member.email} ${member.role}`.toLowerCase()
      return haystack.includes(query)
    })
  }
  return [...list].sort((a, b) => {
    if (currentUserId) {
      if (a.id === currentUserId) return -1
      if (b.id === currentUserId) return 1
    }
    return a.name.localeCompare(b.name)
  })
})

const pendingRemoveTargets = computed(() =>
  pendingRemoveMemberIds.value
    .map(id => members.value.find(member => member.id === id) ?? null)
    .filter((member): member is TeamMember => member !== null)
)

const removeModalDescription = computed(() => {
  const targets = pendingRemoveTargets.value
  if (targets.length === 1) {
    return `Remove ${targets[0]?.name || 'this user'} from your organization? Their account will be deleted and they will lose access immediately.`
  }
  return `Remove ${targets.length} team members from your organization? Their accounts will be deleted and they will lose access immediately.`
})

onMounted(async () => {
  await awaitAuthReady()
  pageReady.value = true
  fetchMembers().catch(() => {})
})

watch(showActivityLog, async (isOpen) => {
  if (!isOpen) return
  activityPage.value = 1
  await loadActivityLog()
})

watch(activityPage, async () => {
  if (!showActivityLog.value) return
  await loadActivityLog()
})

async function loadActivityLog() {
  activityLoading.value = true
  try {
    const result = await fetchActivityLog({ page: activityPage.value, perPage: 20 })
    activityEntries.value = result.items
    activityTotalPages.value = result.totalPages
    activityTotalItems.value = result.totalItems
  } catch (e: unknown) {
    toast.add({
      title: 'Failed to load activity log',
      description: formatPbClientError(e),
      color: 'error'
    })
  } finally {
    activityLoading.value = false
  }
}

function closeMemberDrawer() {
  showMemberDrawer.value = false
  drawerMember.value = null
}

function openMemberDrawer(member: TeamMember) {
  if (!canManageTeam.value) return
  drawerMember.value = member
  showMemberDrawer.value = true
}

function openDrawerForSelection() {
  const selected = teamTable.value?.getSelectedMembers() ?? []
  if (selected.length !== 1) return
  openMemberDrawer(selected[0]!)
}

function getBulkRemoveBlockers(selected: TeamMember[]): TeamMember[] {
  const actor = sessionUser.value
  return selected.filter((member) => {
    const decision = canRemoveMember(member, members.value, actor ?? undefined)
    return !decision.allowed
  })
}

function requestBulkRemove() {
  const selected = teamTable.value?.getSelectedMembers() ?? []
  if (!selected.length) return

  bulkRemoveError.value = ''
  const blockers = getBulkRemoveBlockers(selected)
  if (blockers.length) {
    const names = blockers.map(member => member.name).join(', ')
    bulkRemoveError.value = `Cannot remove: ${names}. ${blockers.length === 1 ? 'This member is' : 'These members are'} required as the last admin.`
    toast.add({
      title: 'Bulk remove blocked',
      description: bulkRemoveError.value,
      color: 'error'
    })
    return
  }

  pendingRemoveMemberIds.value = selected.map(member => member.id)
  showRemoveModal.value = true
}

async function submitCreate(payload: {
  name: string
  email: string
  role: OrgUserRole
}) {
  formError.value = ''
  submitting.value = true
  try {
    await createMember(payload)
    showAddModal.value = false
    formError.value = ''
    toast.add({
      title: 'Invite sent',
      description: `${payload.email} will receive an email to set their password.`
    })
  } catch (e: unknown) {
    const status = e && typeof e === 'object' && 'status' in e ? Number((e as { status: number }).status) : 0
    const msg = formatPbClientError(e)
    if (status === 403) {
      formError.value = 'You do not have permission to add team members.'
    } else if (/email.*unique|already exists|already registered/i.test(msg)) {
      formError.value = 'An account with this email already exists. Use a different address.'
    } else if (msg.includes('Only organization admins') || msg.includes('different organization')) {
      formError.value = msg
    } else if (msg.includes('set-password email')) {
      formError.value = msg
    } else if (msg.includes('Session expired')) {
      formError.value = msg
    } else {
      formError.value = msg || 'Could not add team member. Try again.'
    }
  } finally {
    submitting.value = false
  }
}

async function saveDrawerMember(payload: {
  name: string
  email: string
  role: OrgUserRole
  is_billing_contact?: boolean
}) {
  if (!drawerMember.value) return
  drawerSaving.value = true
  try {
    const updated = await updateMember(drawerMember.value.id, payload)
    drawerMember.value = updated
    toast.add({
      title: 'Member updated',
      description: 'Team member settings have been saved.'
    })
    closeMemberDrawer()
  } catch (e: unknown) {
    toast.add({
      title: 'Failed to save member',
      description: formatPbClientError(e),
      color: 'error'
    })
  } finally {
    drawerSaving.value = false
  }
}

async function confirmDrawerRemove() {
  if (!drawerMember.value) return
  drawerSaving.value = true
  try {
    await removeMember(drawerMember.value.id)
    closeMemberDrawer()
    teamTable.value?.clearSelection?.()
    toast.add({
      title: 'Team member removed',
      description: 'Their account has been deleted from the organization.'
    })
  } catch (e: unknown) {
    toast.add({
      title: 'Failed to remove team member',
      description: formatPbClientError(e),
      color: 'error'
    })
    await fetchMembers()
  } finally {
    drawerSaving.value = false
  }
}

async function sendDrawerPasswordEmail() {
  if (!drawerMember.value) return
  drawerEmailSending.value = true
  try {
    await sendSetPasswordEmail(drawerMember.value.id)
    const label = drawerMember.value.verified ? 'Password reset email sent' : 'Invite resent'
    toast.add({
      title: label,
      description: `${drawerMember.value.email} will receive an email shortly.`
    })
  } catch (e: unknown) {
    toast.add({
      title: 'Failed to send email',
      description: formatPbClientError(e),
      color: 'error'
    })
  } finally {
    drawerEmailSending.value = false
  }
}

async function confirmRemoveMembers() {
  if (!pendingRemoveMemberIds.value.length) return
  confirmLoading.value = true
  try {
    const removed = await removeMembers(pendingRemoveMemberIds.value)
    showRemoveModal.value = false
    pendingRemoveMemberIds.value = []
    closeMemberDrawer()
    teamTable.value?.clearSelection?.()
    toast.add({
      title: removed === 1 ? 'Team member removed' : 'Team members removed',
      description: removed === 1
        ? 'Their account has been deleted from the organization.'
        : `Removed ${removed} accounts from the organization.`
    })
  } catch (e: unknown) {
    toast.add({
      title: 'Failed to remove team member',
      description: formatPbClientError(e),
      color: 'error'
    })
    await fetchMembers()
  } finally {
    confirmLoading.value = false
  }
}
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="Team Members" />
    </template>

    <template #body>
      <p v-if="!pageReady" class="text-sm text-muted">
        Loading team members…
      </p>

      <div v-else class="space-y-4 pb-24">
        <UCard
          v-if="canManageTeam"
          :ui="{ body: 'p-4 sm:p-5' }"
          class="border border-default/80 bg-elevated/20"
        >
          <div class="flex gap-3">
            <UIcon name="i-lucide-shield-check" class="mt-0.5 size-5 shrink-0 text-primary" />
            <div class="space-y-1 text-sm">
              <p class="font-medium text-highlighted">
                Organization admins can manage this team
              </p>
              <p class="text-muted leading-relaxed">
                Click a member to edit their profile, resend invites, or remove them. Select multiple members to remove in bulk.
              </p>
            </div>
          </div>
        </UCard>

        <p v-else class="text-sm text-muted">
          You can view colleagues in your organization. Contact an admin to add or change team members.
        </p>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <TableSearchInput
            v-model="tableSearch"
            placeholder="Search members…"
            aria-label="Search team members"
          />
          <div class="flex items-center gap-2">
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-history"
              @click="showActivityLog = true"
            >
              Activity log
            </UButton>
            <UButton
              v-if="canManageTeam"
              icon="i-lucide-user-plus"
              @click="showAddModal = true"
            >
              Add member
            </UButton>
            <p v-if="loading" class="text-sm text-muted">
              Loading…
            </p>
          </div>
        </div>

        <TeamMembersTable
          ref="teamTable"
          :members="filteredMembers"
          :loading="loading"
          :can-manage="canManageTeam"
          :current-user-id="sessionUser?.id"
          :show-billing-contact="commercialEnabled"
          @open-member="openMemberDrawer"
        />
      </div>
    </template>
  </AppDashboardPanel>

  <TableSelectionBar
    v-if="canManageTeam"
    :count="selectedCount"
    @edit="openDrawerForSelection"
    @remove="requestBulkRemove"
  />

  <TeamMemberAddModal
    v-if="pageReady"
    v-model:open="showAddModal"
    :loading="submitting"
    :error="formError"
    @submit="submitCreate"
  />

  <TeamMemberDrawer
    v-if="pageReady"
    v-model:open="showMemberDrawer"
    :member="drawerMember"
    :members="members"
    :current-user-id="sessionUser?.id"
    :saving="drawerSaving"
    :email-sending="drawerEmailSending"
    @save="saveDrawerMember"
    @confirm-remove="confirmDrawerRemove"
    @send-password-email="sendDrawerPasswordEmail"
  />

  <TeamActivityLogModal
    v-if="pageReady"
    v-model:open="showActivityLog"
    :loading="activityLoading"
    :entries="activityEntries"
    :page="activityPage"
    :total-pages="activityTotalPages"
    :total-items="activityTotalItems"
    @update:page="activityPage = $event"
  />

  <UModal
    v-model:open="showRemoveModal"
    :ui="{ content: 'max-w-md' }"
    title="Remove team member?"
  >
    <template #body>
      <p class="text-sm text-muted leading-relaxed">
        {{ removeModalDescription }}
      </p>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="subtle" @click="showRemoveModal = false">
          Cancel
        </UButton>
        <UButton color="error" :loading="confirmLoading" @click="confirmRemoveMembers">
          Remove member{{ pendingRemoveMemberIds.length === 1 ? '' : 's' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
