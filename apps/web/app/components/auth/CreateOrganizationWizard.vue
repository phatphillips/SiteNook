<script setup lang="ts">
import type { OrganizationPlan } from '~/types/sitenook'
import {
  formatOrganizationUrl
} from '~/utils/selfServiceSignup'
import { formatPlanLabel } from '~/utils/planPricing'

const props = defineProps<{
  appDomain: string
  appUrl: string
  termsUrl?: string
  turnstileSiteKey?: string
  plan?: OrganizationPlan
  checkoutSessionId?: string
  teamTrial?: boolean
  initialOwnerEmail?: string
}>()

const emit = defineEmits<{
  complete: []
}>()

type WizardStep = 'organization' | 'you' | 'confirm' | 'done'

const steps: { id: WizardStep, label: string }[] = [
  { id: 'organization', label: 'Organization' },
  { id: 'you', label: 'You' },
  { id: 'confirm', label: 'Confirm' },
  { id: 'done', label: 'Done' }
]

const currentStep = ref<WizardStep>('organization')
const loading = ref(false)
const error = ref('')

const form = reactive({
  orgName: '',
  subdomain: '',
  ownerName: '',
  ownerEmail: '',
  acceptTerms: false
})

const subdomainStatus = ref<'idle' | 'checking' | 'available' | 'unavailable'>('idle')
const subdomainReason = ref('')
const turnstileToken = ref('')
const turnstileWidgetId = ref<string | null>(null)

const result = reactive({
  loginUrl: '',
  ownerEmail: '',
  inviteEmailSent: false
})

const subdomainPreview = computed(() => {
  const slug = form.subdomain.trim().toLowerCase() || 'your-org'
  return formatOrganizationUrl(slug, props.appDomain, props.appUrl)
})

const loginPreview = computed(() => `${subdomainPreview.value}/login`)

const subdomainHelp = computed(() => {
  if (subdomainStatus.value === 'checking') return 'Checking availability…'
  if (subdomainStatus.value === 'available') return subdomainReason.value
  if (subdomainStatus.value === 'unavailable') return subdomainReason.value
  return `Your team will sign in at ${loginPreview.value}`
})

let subdomainCheckTimer: ReturnType<typeof setTimeout> | null = null

const planLabel = computed(() => formatPlanLabel(props.plan))

onMounted(() => {
  const email = props.initialOwnerEmail?.trim()
  if (email && !form.ownerEmail.trim()) {
    form.ownerEmail = email
  }
})

function goToStep(step: WizardStep) {
  currentStep.value = step
  error.value = ''
}

function stepIndex(step: WizardStep): number {
  return steps.findIndex(item => item.id === step)
}

function canProceedFromOrganization(): boolean {
  return !!form.orgName.trim()
    && !!form.subdomain.trim()
    && subdomainStatus.value === 'available'
}

function canProceedFromYou(): boolean {
  return !!form.ownerName.trim() && !!form.ownerEmail.trim()
}

async function checkSubdomainAvailability(slug: string) {
  const trimmed = slug.trim()
  if (!trimmed) {
    subdomainStatus.value = 'idle'
    subdomainReason.value = ''
    return
  }

  subdomainStatus.value = 'checking'
  subdomainReason.value = ''

  try {
    const response = await $fetch<{ available: boolean, reason?: string }>('/api/subdomain-available', {
      query: { slug: trimmed }
    })
    if (response.available) {
      subdomainStatus.value = 'available'
      subdomainReason.value = 'This subdomain is available.'
    } else {
      subdomainStatus.value = 'unavailable'
      subdomainReason.value = response.reason || 'This subdomain is not available.'
    }
  } catch {
    subdomainStatus.value = 'unavailable'
    subdomainReason.value = 'Could not check availability. Try again.'
  }
}

watch(() => form.subdomain, (value) => {
  if (subdomainCheckTimer) clearTimeout(subdomainCheckTimer)
  subdomainStatus.value = 'idle'
  subdomainReason.value = ''
  if (!value.trim()) return

  subdomainCheckTimer = setTimeout(() => {
    checkSubdomainAvailability(value)
  }, 400)
})

function normalizeSubdomainInput() {
  form.subdomain = form.subdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
}

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.turnstile) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-turnstile]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Turnstile failed to load')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.dataset.turnstile = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Turnstile failed to load'))
    document.head.appendChild(script)
  })
}

async function renderTurnstile() {
  if (!props.turnstileSiteKey || currentStep.value !== 'confirm') return
  await loadTurnstileScript()
  await nextTick()

  const container = document.getElementById('signup-turnstile')
  if (!container || !window.turnstile) return

  container.innerHTML = ''
  turnstileToken.value = ''
  turnstileWidgetId.value = window.turnstile.render(container, {
    sitekey: props.turnstileSiteKey,
    callback: (token: string) => {
      turnstileToken.value = token
    },
    'expired-callback': () => {
      turnstileToken.value = ''
    },
    'error-callback': () => {
      turnstileToken.value = ''
    }
  })
}

watch(currentStep, (step) => {
  if (step === 'confirm') {
    renderTurnstile().catch(() => {
      error.value = 'Captcha could not load. Refresh and try again.'
    })
  }
})

async function submitSignup() {
  loading.value = true
  error.value = ''

  try {
    const response = await $fetch<{
      loginUrl: string
      owner: { email: string }
      inviteEmailSent: boolean
    }>('/api/signup-organization', {
      method: 'POST',
      body: {
        orgName: form.orgName.trim(),
        subdomain: form.subdomain.trim().toLowerCase(),
        ownerName: form.ownerName.trim(),
        ownerEmail: form.ownerEmail.trim(),
        acceptTerms: true,
        turnstileToken: turnstileToken.value || undefined,
        plan: props.plan,
        checkoutSessionId: props.checkoutSessionId,
        trial: props.teamTrial === true ? 1 : undefined
      }
    })

    result.loginUrl = response.loginUrl
    result.ownerEmail = response.owner.email
    result.inviteEmailSent = response.inviteEmailSent
    goToStep('done')
    emit('complete')
  } catch (e: unknown) {
    const fetchError = e as { data?: { statusMessage?: string }, statusMessage?: string, message?: string }
    error.value = fetchError.data?.statusMessage
      || fetchError.statusMessage
      || fetchError.message
      || 'Could not create your organization. Please try again.'
    if (props.turnstileSiteKey && window.turnstile && turnstileWidgetId.value) {
      window.turnstile.reset(turnstileWidgetId.value)
      turnstileToken.value = ''
    }
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(() => {
  if (subdomainCheckTimer) clearTimeout(subdomainCheckTimer)
})
</script>

<script lang="ts">
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: Record<string, unknown>
      ) => string
      reset: (widgetId: string) => void
    }
  }
}
</script>

<template>
  <div class="space-y-6">
    <ol class="flex items-center justify-between gap-2 text-xs font-medium text-muted">
      <li
        v-for="(step, index) in steps"
        :key="step.id"
        class="flex flex-1 items-center gap-2"
      >
        <span
          class="flex size-7 shrink-0 items-center justify-center rounded-full ring-1"
          :class="stepIndex(currentStep) >= index
            ? 'bg-primary/10 text-primary ring-primary/30'
            : 'bg-elevated ring-default'"
        >
          {{ index + 1 }}
        </span>
        <span
          class="hidden sm:inline"
          :class="stepIndex(currentStep) >= index ? 'text-highlighted' : ''"
        >
          {{ step.label }}
        </span>
        <span
          v-if="index < steps.length - 1"
          class="mx-1 hidden h-px flex-1 bg-default sm:block"
        />
      </li>
    </ol>

    <div v-if="currentStep === 'organization'" class="space-y-4">
      <UFormField label="Organization name" class="w-full">
        <UInput
          v-model="form.orgName"
          class="w-full"
          placeholder="Acme Agency"
          size="lg"
          autocomplete="organization"
        />
      </UFormField>

      <UFormField
        label="Subdomain"
        class="w-full"
        :help="subdomainHelp"
        :error="subdomainStatus === 'unavailable' ? subdomainReason : undefined"
      >
        <UInput
          v-model="form.subdomain"
          class="w-full font-mono"
          placeholder="acme"
          size="lg"
          autocomplete="off"
          @blur="normalizeSubdomainInput"
        />
      </UFormField>

      <UButton
        block
        size="lg"
        :disabled="!canProceedFromOrganization()"
        @click="goToStep('you')"
      >
        Continue
      </UButton>
    </div>

    <div v-else-if="currentStep === 'you'" class="space-y-4">
      <UFormField label="Your name" class="w-full">
        <UInput
          v-model="form.ownerName"
          class="w-full"
          placeholder="Jane Owner"
          size="lg"
          autocomplete="name"
        />
      </UFormField>

      <UFormField label="Work email" class="w-full" help="You will be the first admin and billing contact.">
        <UInput
          v-model="form.ownerEmail"
          class="w-full"
          type="email"
          placeholder="you@company.com"
          size="lg"
          autocomplete="email"
        />
      </UFormField>

      <div class="flex gap-3">
        <UButton variant="soft" color="neutral" size="lg" @click="goToStep('organization')">
          Back
        </UButton>
        <UButton
          class="flex-1"
          size="lg"
          :disabled="!canProceedFromYou()"
          @click="goToStep('confirm')"
        >
          Continue
        </UButton>
      </div>
    </div>

    <div v-else-if="currentStep === 'confirm'" class="space-y-4">
      <div class="rounded-xl border border-default bg-elevated/30 p-4 text-sm leading-relaxed">
        <dl class="space-y-3">
          <div v-if="planLabel">
            <dt class="text-muted">
              Plan
            </dt>
            <dd class="font-medium text-highlighted">
              {{ planLabel }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Organization
            </dt>
            <dd class="font-medium text-highlighted">
              {{ form.orgName.trim() }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Sign-in URL
            </dt>
            <dd class="font-mono text-sm break-all text-highlighted">
              {{ loginPreview }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Admin
            </dt>
            <dd class="font-medium text-highlighted">
              {{ form.ownerName.trim() }} · {{ form.ownerEmail.trim() }}
            </dd>
          </div>
        </dl>
      </div>

      <UCheckbox v-model="form.acceptTerms" label="I agree to the terms of service">
        <template v-if="termsUrl" #description>
          Read the
          <a :href="termsUrl" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">
            terms of service
          </a>.
        </template>
        <template v-else #description>
          By creating an organization you agree to use SiteNook responsibly.
        </template>
      </UCheckbox>

      <div id="signup-turnstile" class="flex justify-center" />

      <UAlert v-if="error" color="error" variant="subtle" :title="error" />

      <div class="flex gap-3">
        <UButton variant="soft" color="neutral" size="lg" @click="goToStep('you')">
          Back
        </UButton>
        <UButton
          class="flex-1"
          size="lg"
          :loading="loading"
          :disabled="!form.acceptTerms || (!!turnstileSiteKey && !turnstileToken)"
          @click="submitSignup"
        >
          Create organization
        </UButton>
      </div>
    </div>

    <div v-else class="space-y-5 text-sm">
      <UAlert
        color="success"
        variant="subtle"
        title="Organization created"
        :description="result.inviteEmailSent
          ? `We sent an account setup link to ${result.ownerEmail}.`
          : `Your organization was created, but the account setup email could not be sent. Use Forgot password on your sign-in page.`"
      />

      <ol class="space-y-3 rounded-xl border border-default bg-elevated/30 p-4 leading-relaxed text-muted">
        <li class="flex gap-3">
          <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-elevated text-xs font-semibold text-highlighted">1</span>
          <span>
            {{ result.inviteEmailSent
              ? `Open the setup link in the email sent to ${result.ownerEmail}.`
              : 'Use Forgot password on the sign-in page to receive a setup link.' }}
          </span>
        </li>
        <li class="flex gap-3">
          <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-elevated text-xs font-semibold text-highlighted">2</span>
          <span>Choose a password to finish setting up your admin account.</span>
        </li>
        <li class="flex gap-3">
          <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-elevated text-xs font-semibold text-highlighted">3</span>
          <span>
            Sign in at your organization URL:
            <span class="mt-1 block font-mono text-default break-all">{{ result.loginUrl }}</span>
          </span>
        </li>
      </ol>

      <UButton
        :to="result.loginUrl"
        block
        size="lg"
      >
        Go to sign in
      </UButton>

      <p class="text-center text-xs text-muted">
        After you sign in, a short checklist helps you add a site and invite teammates. Colleagues join via Team Members invite — not from this page.
      </p>
    </div>
  </div>
</template>
