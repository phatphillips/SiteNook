<script setup lang="ts">
import type { TeamMember } from '~/composables/useTeamMembers'
import {
  canChangeRole,
  canRemoveMember,
  canToggleBillingContact,
  type OrgUserRole
} from '~/utils/orgAccess'
import { isCommercialEnabled } from '~/utils/commercial'

const props = defineProps<{
  member: TeamMember | null
  members: TeamMember[]
  open: boolean
  currentUserId?: string
  saving?: boolean
  emailSending?: boolean
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  save: [payload: { name: string, email: string, role: OrgUserRole, is_billing_contact?: boolean }]
  'confirm-remove': []
  'send-password-email': []
}>()

const openModel = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
})

const roleOptions = [
  { label: 'Admin', value: 'admin' as const },
  { label: 'Viewer', value: 'viewer' as const }
]

const commercialEnabled = computed(() => isCommercialEnabled())

const form = reactive({
  name: '',
  email: '',
  role: 'viewer' as OrgUserRole,
  is_billing_contact: false
})

const actor = computed(() => ({
  id: props.currentUserId ?? '',
  role: 'admin'
}))

const isSelf = computed(() => props.member?.id === props.currentUserId)

const roleChangeDecision = computed(() => {
  if (!props.member) return { allowed: true }
  if (isSelf.value) {
    return { allowed: false, reason: 'You cannot change your own role.' }
  }
  return canChangeRole(props.member, props.members, form.role, actor.value)
})

const roleFieldDisabled = computed(() => !roleChangeDecision.value.allowed)

const roleFieldHint = computed(() => roleChangeDecision.value.reason)

const billingToggleDecision = computed(() => {
  if (!props.member) return { allowed: true }
  const turningOff = props.member.is_billing_contact && !form.is_billing_contact
  return canToggleBillingContact(props.member, props.members, turningOff, form.role)
})

const billingToggleDisabled = computed(() =>
  form.role !== 'admin' || !billingToggleDecision.value.allowed
)

const billingToggleHint = computed(() =>
  form.role === 'admin' ? billingToggleDecision.value.reason : undefined
)

const removeDecision = computed(() => {
  if (!props.member) return { allowed: false }
  return canRemoveMember(props.member, props.members, actor.value)
})

const canRemove = computed(() => removeDecision.value.allowed)

const removeBlockedReason = computed(() =>
  !canRemove.value && !isSelf.value ? removeDecision.value.reason : undefined
)

const passwordEmailLabel = computed(() =>
  props.member?.verified ? 'Send password reset email' : 'Resend account setup email'
)

const passwordEmailDescription = computed(() =>
  props.member?.verified
    ? 'Sends a link so they can choose a new password.'
    : 'Sends the account setup email again for members who have not signed in yet.'
)

const pendingRemove = ref(false)

const removeMessage = computed(() => {
  if (!props.member) return ''
  const name = form.name.trim() || props.member.name
  return `Remove ${name} from your organization? Their account will be deleted and they will lose access immediately.`
})

const inConfirmMode = computed(() => pendingRemove.value)

watch(
  () => [props.open, props.member?.id] as const,
  ([isOpen, memberId]) => {
    if (!isOpen || !memberId || !props.member) return
    pendingRemove.value = false
    form.name = props.member.name === '—' ? '' : props.member.name
    form.email = props.member.email
    form.role = (props.member.role === 'admin' ? 'admin' : 'viewer') as OrgUserRole
    form.is_billing_contact = props.member.is_billing_contact
  },
  { immediate: true }
)

watch(
  () => form.role,
  (role) => {
    if (role !== 'admin') {
      form.is_billing_contact = false
    }
  }
)

function cancelRemoveConfirm() {
  pendingRemove.value = false
}

function requestRemove() {
  pendingRemove.value = true
}

function handleSave() {
  if (!props.member || pendingRemove.value) return

  const payload: {
    name: string
    email: string
    role: OrgUserRole
    is_billing_contact?: boolean
  } = {
    name: form.name,
    email: form.email,
    role: form.role
  }
  if (commercialEnabled.value) {
    payload.is_billing_contact = form.role === 'admin' ? form.is_billing_contact : false
  }
  emit('save', payload)
}

function handleRemoveConfirm() {
  if (!pendingRemove.value) return
  emit('confirm-remove')
}
</script>

<template>
  <UModal
    v-model:open="openModel"
    class="team-member-drawer"
    :close="false"
    :dismissible="!saving && !inConfirmMode"
    :ui="{
      content: 'team-member-drawer fixed inset-y-0 right-0 left-auto h-screen w-full max-w-md translate-x-0 translate-y-0 rounded-none sm:max-w-md m-0',
      overlay: 'bg-black/25',
      header: 'team-member-drawer__header shrink-0 border-b border-default/60 px-4 py-3 sm:px-6',
      body: 'flex-1 min-h-0 overflow-y-auto px-4 sm:px-6',
      footer: 'shrink-0 border-t border-default/60 px-4 py-4 sm:px-6'
    }"
  >
    <template v-if="member" #header="{ close }">
      <div class="flex w-full items-center gap-2.5">
        <button
          type="button"
          class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-elevated hover:text-highlighted disabled:opacity-50"
          aria-label="Close"
          :disabled="saving || emailSending"
          @click="close"
        >
          <UIcon name="i-lucide-arrow-left" class="size-4" />
        </button>
        <h2 class="text-base font-semibold leading-tight text-highlighted">
          {{ member.name }}
        </h2>
      </div>
    </template>

    <template v-if="member" #body>
      <div class="space-y-5">
        <div v-if="!member.verified" class="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm">
          <UIcon name="i-lucide-mail" class="mt-0.5 size-4 shrink-0 text-warning" />
          <p class="text-muted leading-relaxed">
            This member has not completed sign-in yet. Use <strong class="text-highlighted">Resend account setup email</strong> if they need another invite link.
          </p>
        </div>

        <UFormField label="Full name" required class="w-full">
          <UInput v-model="form.name" class="w-full" autocomplete="name" :disabled="inConfirmMode" />
        </UFormField>

        <UFormField label="Work email" required class="w-full">
          <UInput v-model="form.email" class="w-full" type="email" autocomplete="email" :disabled="inConfirmMode" />
        </UFormField>

        <section class="rounded-lg border border-default/60 bg-elevated/20 p-4 space-y-4">
          <UFormField
            label="Organizational role"
            class="w-full"
            :hint="roleFieldHint"
          >
            <select
              v-model="form.role"
              class="team-member-role-select w-full"
              :disabled="roleFieldDisabled || inConfirmMode"
            >
              <option v-for="option in roleOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </UFormField>

          <USwitch
            v-if="commercialEnabled && form.role === 'admin'"
            v-model="form.is_billing_contact"
            class="team-member-billing-switch"
            label="Billing contact"
            description="Receives billing-related communication for this organization."
            :disabled="billingToggleDisabled || inConfirmMode"
          />
          <p
            v-if="commercialEnabled && form.role === 'admin' && billingToggleHint"
            class="text-xs text-warning"
          >
            {{ billingToggleHint }}
          </p>
        </section>

        <UAlert
          v-if="pendingRemove"
          color="error"
          variant="subtle"
          title="Remove team member?"
          :description="removeMessage"
        />

        <div v-if="!isSelf" class="space-y-2 border-t border-default/60 pt-4">
          <p class="text-sm font-medium text-highlighted">
            Account access
          </p>
          <p class="text-sm text-muted leading-relaxed">
            {{ passwordEmailDescription }}
          </p>
          <UButton
            class="w-full justify-center"
            color="neutral"
            variant="outline"
            icon="i-lucide-mail"
            :loading="emailSending"
            :disabled="saving || inConfirmMode"
            @click="emit('send-password-email')"
          >
            {{ passwordEmailLabel }}
          </UButton>
        </div>
      </div>
    </template>

    <template v-if="member" #footer>
      <div v-if="pendingRemove" class="team-member-drawer__footer flex w-full items-center gap-2">
        <div class="flex shrink-0 items-center gap-2">
          <UButton
            color="neutral"
            variant="subtle"
            class="shrink-0 whitespace-nowrap"
            icon="i-lucide-x"
            :disabled="saving"
            @click="cancelRemoveConfirm"
          >
            Cancel
          </UButton>
          <UButton
            color="error"
            class="shrink-0 whitespace-nowrap"
            icon="i-lucide-trash-2"
            :loading="saving"
            @click="handleRemoveConfirm"
          >
            Remove member
          </UButton>
        </div>
      </div>

      <div v-else class="team-member-drawer__footer flex w-full flex-col gap-3">
        <UAlert
          v-if="removeBlockedReason"
          color="warning"
          variant="subtle"
          title="Cannot remove this member"
          :description="removeBlockedReason"
        />

        <div class="team-member-drawer__footer-actions flex w-full flex-wrap items-center gap-2">
          <UButton
            class="shrink-0 whitespace-nowrap"
            icon="i-lucide-check"
            :loading="saving"
            :disabled="emailSending"
            @click="handleSave"
          >
            Save
          </UButton>
          <UButton
            color="neutral"
            variant="subtle"
            class="shrink-0 whitespace-nowrap"
            icon="i-lucide-x"
            :disabled="saving || emailSending"
            @click="openModel = false"
          >
            Cancel
          </UButton>
          <UButton
            v-if="!isSelf && canRemove"
            color="error"
            variant="outline"
            class="ml-auto shrink-0 whitespace-nowrap"
            icon="i-lucide-trash-2"
            :disabled="saving || emailSending"
            @click="requestRemove"
          >
            Remove
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
