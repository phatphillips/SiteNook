<script setup lang="ts">
import type { OrgUserRole } from '~/utils/orgAccess'
import { generateInvitePassword } from '~/utils/inviteUser'

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  submit: [payload: {
    name: string
    email: string
    role: OrgUserRole
    password: string
    sendSetupEmail: boolean
  }]
}>()

const props = defineProps<{
  loading?: boolean
  error?: string
  smtpEnabled?: boolean
  smtpChecked?: boolean
  created?: {
    name: string
    email: string
    password: string
    emailSent: boolean
    emailError?: string
  } | null
}>()

const localError = ref('')
/** WordPress-style: generated passwords start visible so they can be read aloud / shared. */
const passwordVisible = ref(true)
const passwordCopied = ref(false)

const roleOptions = [
  { label: 'Admin', value: 'admin', description: 'Manage team members and organization settings' },
  { label: 'Viewer', value: 'viewer', description: 'Read-only access to all organization sites and scan data' }
]

const form = reactive({
  name: '',
  email: '',
  role: 'viewer' as OrgUserRole,
  password: '',
  sendSetupEmail: false
})

function resetForm() {
  form.name = ''
  form.email = ''
  form.role = 'viewer'
  form.password = generateInvitePassword()
  form.sendSetupEmail = false
  localError.value = ''
  passwordVisible.value = true
  passwordCopied.value = false
}

watch(open, (isOpen) => {
  if (!isOpen) return
  if (!props.created) resetForm()
  else {
    passwordVisible.value = true
    passwordCopied.value = false
  }
})

watch(() => props.smtpEnabled, (enabled) => {
  if (enabled && !props.created) form.sendSetupEmail = true
})

const displayError = computed(() => props.error || localError.value)

function regeneratePassword() {
  form.password = generateInvitePassword()
  passwordVisible.value = true
  passwordCopied.value = false
}

async function copyPassword(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    passwordCopied.value = true
    window.setTimeout(() => {
      passwordCopied.value = false
    }, 1500)
  } catch {
    passwordCopied.value = false
  }
}

function handleSubmit() {
  localError.value = ''
  emit('submit', {
    name: form.name,
    email: form.email,
    role: form.role,
    password: form.password,
    sendSetupEmail: Boolean(props.smtpEnabled && form.sendSetupEmail)
  })
}
</script>

<template>
  <UModal
    v-model:open="open"
    class="team-member-add-modal"
    :dismissible="!loading"
    :ui="{
      content: 'max-w-lg',
      header: 'border-b border-default/60',
      footer: 'border-t border-default/60'
    }"
  >
    <template #header>
      <div class="flex items-start gap-3">
        <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
          <UIcon :name="created ? 'i-lucide-key-round' : 'i-lucide-user-plus'" class="size-5 text-primary" />
        </div>
        <div>
          <h2 class="text-lg font-semibold text-highlighted">
            {{ created ? 'Share this password' : 'Add team member' }}
          </h2>
          <p class="mt-0.5 text-sm text-muted">
            {{ created
              ? 'They can sign in right away. This password is only shown once.'
              : 'Create an account and share the generated password so they can sign in.'
            }}
          </p>
        </div>
      </div>
    </template>

    <template #body>
      <div v-if="created" class="space-y-4">
        <p class="text-sm text-muted leading-relaxed">
          <strong class="text-highlighted">{{ created.name }}</strong>
          can sign in as
          <strong class="text-highlighted">{{ created.email }}</strong>
          with this password:
        </p>
        <div class="team-member-password-field w-full space-y-2">
          <UInput
            :model-value="created.password"
            class="w-full font-mono"
            size="lg"
            :type="passwordVisible ? 'text' : 'password'"
            readonly
            autocomplete="off"
            :ui="{ trailing: 'pe-1' }"
          >
            <template #trailing>
              <div class="flex items-center gap-0.5">
                <UButton
                  type="button"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  square
                  :icon="passwordCopied ? 'i-lucide-check' : 'i-lucide-copy'"
                  :aria-label="passwordCopied ? 'Password copied' : 'Copy password'"
                  @click="copyPassword(created.password)"
                />
                <UButton
                  type="button"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  square
                  :icon="passwordVisible ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  :aria-pressed="passwordVisible"
                  :aria-label="passwordVisible ? 'Hide password' : 'Show password'"
                  @click="passwordVisible = !passwordVisible"
                />
              </div>
            </template>
          </UInput>
        </div>
        <UAlert
          v-if="created.emailSent"
          color="success"
          variant="subtle"
          title="Setup email sent"
          description="They can also use the email link to choose their own password."
        />
        <UAlert
          v-else-if="created.emailError"
          color="warning"
          variant="subtle"
          title="Setup email was not sent"
          :description="`${created.emailError} They can still sign in with the password above.`"
        />
      </div>

      <form v-else id="team-member-add-form" class="space-y-6" @submit.prevent="handleSubmit">
        <section class="space-y-4">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">
            Profile
          </h3>
          <UFormField label="Full name" required class="w-full">
            <UInput v-model="form.name" class="w-full" required autocomplete="name" placeholder="Jane Smith" />
          </UFormField>
          <UFormField label="Work email" required class="w-full">
            <UInput
              v-model="form.email"
              class="w-full"
              type="email"
              required
              autocomplete="email"
              placeholder="jane@company.com"
            />
          </UFormField>
        </section>

        <section class="space-y-4">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">
            Access
          </h3>
          <UFormField label="Organization role" required>
            <USelectMenu
              v-model="form.role"
              :items="roleOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Temporary password"
            class="w-full"
            help="Share this with them. They can change it in Settings after signing in."
          >
            <div class="team-member-password-field w-full space-y-2">
              <UInput
                v-model="form.password"
                class="w-full font-mono"
                size="lg"
                :type="passwordVisible ? 'text' : 'password'"
                autocomplete="new-password"
                required
                minlength="8"
                :ui="{ trailing: 'pe-1' }"
              >
                <template #trailing>
                  <div class="flex items-center gap-0.5">
                    <UButton
                      type="button"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      square
                      :icon="passwordCopied ? 'i-lucide-check' : 'i-lucide-copy'"
                      :aria-label="passwordCopied ? 'Password copied' : 'Copy password'"
                      @click="copyPassword(form.password)"
                    />
                    <UButton
                      type="button"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      square
                      :icon="passwordVisible ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                      :aria-pressed="passwordVisible"
                      :aria-label="passwordVisible ? 'Hide password' : 'Show password'"
                      @click="passwordVisible = !passwordVisible"
                    />
                  </div>
                </template>
              </UInput>
              <UButton
                type="button"
                color="neutral"
                variant="link"
                size="sm"
                class="px-0"
                icon="i-lucide-refresh-cw"
                @click="regeneratePassword"
              >
                Generate new password
              </UButton>
            </div>
          </UFormField>
        </section>

        <UAlert
          v-if="smtpChecked && !smtpEnabled"
          color="info"
          variant="subtle"
          title="Email invites need SMTP"
          description="PocketBase mail is not configured, so no setup email will be sent. Share the password instead. To enable email later, open PocketBase admin → Settings → Mail settings and turn on SMTP."
        />

        <UCheckbox
          v-else-if="smtpEnabled"
          v-model="form.sendSetupEmail"
          label="Also email a setup link"
          description="They can sign in with the password now, or use the email to choose their own."
        />

        <UAlert v-if="displayError" color="error" variant="subtle" :title="displayError" />
      </form>
    </template>

    <template #footer>
      <div v-if="created" class="flex w-full justify-end">
        <UButton @click="open = false">
          Done
        </UButton>
      </div>
      <div v-else class="flex w-full justify-end gap-2">
        <UButton type="button" color="neutral" variant="subtle" :disabled="loading" @click="open = false">
          Cancel
        </UButton>
        <UButton type="submit" form="team-member-add-form" icon="i-lucide-user-plus" :loading="loading">
          Create account
        </UButton>
      </div>
    </template>
  </UModal>
</template>
