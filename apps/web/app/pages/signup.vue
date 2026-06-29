<script setup lang="ts">
definePageMeta({ layout: false, middleware: 'guest' })

import { parseSelfServiceSignupFlag } from '~/utils/selfServiceSignup'

const config = useRuntimeConfig()

const supportEmail = computed(() => config.public.supportEmail || 'contact@your-org.com')
const selfServiceEnabled = computed(() => parseSelfServiceSignupFlag(config.public.selfServiceSignup))
const signInPath = '/sign-in'
</script>

<template>
  <AuthPageShell
    :title="selfServiceEnabled ? 'Get started' : 'Invite only'"
    :subtitle="selfServiceEnabled
      ? 'Create a new organization or join an existing team.'
      : 'Account creation is currently invite-only. Contact your administrator to get set up.'"
    :icon="selfServiceEnabled ? 'i-lucide-sparkles' : 'i-lucide-user-lock'"
  >
    <div v-if="selfServiceEnabled" class="space-y-4">
      <NuxtLink
        to="/pricing"
        class="flex items-start gap-4 rounded-xl border border-default bg-elevated/30 p-4 transition hover:border-primary/40 hover:bg-primary/5"
      >
        <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
          <UIcon name="i-lucide-building-2" class="size-5 text-primary" />
        </div>
        <div class="min-w-0 text-left">
          <p class="font-medium text-highlighted">
            Create an organization
          </p>
          <p class="mt-1 text-sm text-muted">
            Choose a plan and set up a new AccessIQ workspace for your team.
          </p>
        </div>
      </NuxtLink>

      <NuxtLink
        :to="signInPath"
        class="flex items-start gap-4 rounded-xl border border-default bg-elevated/30 p-4 transition hover:border-primary/40 hover:bg-primary/5"
      >
        <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-neutral-500/10 ring-1 ring-neutral-500/20">
          <UIcon name="i-lucide-users" class="size-5 text-neutral-500" />
        </div>
        <div class="min-w-0 text-left">
          <p class="font-medium text-highlighted">
            Join an existing team
          </p>
          <p class="mt-1 text-sm text-muted">
            Sign in at your organization with your work email.
          </p>
        </div>
      </NuxtLink>
    </div>

    <div v-else class="space-y-5">
      <div class="rounded-xl border border-default bg-elevated/30 p-4 text-sm leading-relaxed text-muted">
        <p>
          New AccessIQ accounts are created by an organization admin. If you need access, reach out to your team lead or IT contact.
        </p>
      </div>

      <div class="space-y-2 text-sm">
        <p class="font-medium text-highlighted">
          Contact
        </p>
        <p class="text-muted">
          <a
            :href="`mailto:${supportEmail}`"
            class="inline-flex items-center gap-2 text-primary hover:underline"
          >
            <UIcon name="i-lucide-mail" class="size-4" />
            {{ supportEmail }}
          </a>
        </p>
      </div>
    </div>

    <UButton :to="signInPath" block size="lg" variant="soft" color="neutral" class="mt-5">
      Back to sign in
    </UButton>

    <p class="mt-4 text-center text-xs text-muted">
      Already have credentials?
      <NuxtLink :to="signInPath" class="text-primary hover:underline">
        Sign in
      </NuxtLink>
    </p>
  </AuthPageShell>
</template>
