<script setup lang="ts">
import type { OrgUserRole } from '~/utils/orgAccess'

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  submit: [payload: {
    name: string
    email: string
    role: OrgUserRole
  }]
}>()

const props = defineProps<{
  loading?: boolean
  error?: string
}>()

const localError = ref('')

const roleOptions = [
  { label: 'Admin', value: 'admin', description: 'Manage team members and organization settings' },
  { label: 'Viewer', value: 'viewer', description: 'Read-only access to all organization sites and scan data' }
]

const form = reactive({
  name: '',
  email: '',
  role: 'viewer' as OrgUserRole
})

watch(open, (isOpen) => {
  if (!isOpen) return
  form.name = ''
  form.email = ''
  form.role = 'viewer'
  localError.value = ''
})

const displayError = computed(() => props.error || localError.value)

function handleSubmit() {
  localError.value = ''
  emit('submit', {
    name: form.name,
    email: form.email,
    role: form.role
  })
}
</script>

<template>
  <UModal
    v-model:open="open"
    class="team-member-add-modal"
    :ui="{
      content: 'max-w-lg',
      header: 'border-b border-default/60',
      footer: 'border-t border-default/60'
    }"
  >
    <template #header>
      <div class="flex items-start gap-3">
        <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
          <UIcon name="i-lucide-user-plus" class="size-5 text-primary" />
        </div>
        <div>
          <h2 class="text-lg font-semibold text-highlighted">
            Invite team member
          </h2>
          <p class="mt-0.5 text-sm text-muted">
            We will email them a link to set their password and sign in.
          </p>
        </div>
      </div>
    </template>

    <template #body>
      <form id="team-member-add-form" class="space-y-6" @submit.prevent="handleSubmit">
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
        </section>

        <p class="text-xs text-muted leading-relaxed">
          The new member receives an account setup email. They must complete that step before signing in.
        </p>

        <UAlert v-if="displayError" color="error" variant="subtle" :title="displayError" />
      </form>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton type="button" color="neutral" variant="subtle" @click="open = false">
          Cancel
        </UButton>
        <UButton type="submit" form="team-member-add-form" icon="i-lucide-send" :loading="loading">
          Send invite
        </UButton>
      </div>
    </template>
  </UModal>
</template>
