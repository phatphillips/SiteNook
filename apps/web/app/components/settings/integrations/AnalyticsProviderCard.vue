<script setup lang="ts">
import type { AnalyticsConnection, AnalyticsConnectionStatus, AnalyticsProvider } from '~/types/sitenook'

const props = defineProps<{
  provider: AnalyticsProvider
  name: string
  description: string
  monogram: string
  connections: AnalyticsConnection[]
  canManage: boolean
  highlight?: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  connect: []
  manage: [connection: AnalyticsConnection]
  disconnect: [connection: AnalyticsConnection]
  reconnect: [connection: AnalyticsConnection]
}>()

const connectBtnRef = ref<HTMLElement | null>(null)

function statusMeta(status: AnalyticsConnectionStatus | undefined) {
  switch (status) {
    case 'connected':
      return { label: 'Connected', icon: 'i-lucide-check-circle-2', color: 'text-success' }
    case 'needs_reconnect':
      return { label: 'Needs reconnect', icon: 'i-lucide-alert-triangle', color: 'text-warning' }
    case 'error':
      return { label: 'Sync error', icon: 'i-lucide-circle-alert', color: 'text-error' }
    case 'disconnected':
      return { label: 'Disconnected', icon: 'i-lucide-unlink', color: 'text-muted' }
    default:
      return { label: 'Not connected', icon: 'i-lucide-circle-dashed', color: 'text-muted' }
  }
}

const primary = computed(() => props.connections[0] || null)
const status = computed(() => statusMeta(primary.value?.status))

const cardClass = computed(() => {
  const base = 'bg-elevated/25 border border-default rounded-lg p-4 sm:p-5 flex flex-col gap-3 transition-[box-shadow,border-color] duration-500'
  if (props.highlight) {
    return `${base} border-success/60 shadow-[0_0_0_1px_rgba(34,197,94,0.25)] motion-safe:animate-none`
  }
  return base
})

defineExpose({ connectBtnRef })
</script>

<template>
  <article
    :class="cardClass"
    :aria-labelledby="`provider-${provider}-title`"
  >
    <div class="flex items-start gap-3">
      <div
        class="size-10 shrink-0 rounded-md bg-default border border-default flex items-center justify-center font-semibold text-sm"
        aria-hidden="true"
      >
        {{ monogram }}
      </div>
      <div class="min-w-0 flex-1">
        <h3
          :id="`provider-${provider}-title`"
          class="font-semibold text-default"
        >
          {{ name }}
        </h3>
        <p class="text-sm text-muted mt-0.5">
          {{ description }}
        </p>
      </div>
    </div>

    <div
      class="flex items-center gap-2 text-sm"
      :class="status.color"
    >
      <UIcon
        :name="status.icon"
        class="size-4 shrink-0"
        aria-hidden="true"
      />
      <span>{{ status.label }}</span>
      <span
        v-if="primary?.expand?.site?.name || primary?.credentials_meta?.propertyLabel"
        class="text-muted truncate"
      >
        · {{ primary?.credentials_meta?.propertyLabel || primary?.expand?.site?.name }}
      </span>
    </div>

    <div
      v-if="loading"
      class="flex items-center gap-2 text-sm text-muted"
      aria-busy="true"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-4 animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
      <span>Working…</span>
    </div>

    <div class="mt-auto flex flex-wrap gap-2">
      <template v-if="canManage">
        <UButton
          v-if="!primary || primary.status === 'disconnected'"
          ref="connectBtnRef"
          color="neutral"
          size="sm"
          @click="emit('connect')"
        >
          Connect
        </UButton>
        <template v-else>
          <UButton
            v-if="primary.status === 'needs_reconnect'"
            ref="connectBtnRef"
            color="neutral"
            size="sm"
            @click="emit('reconnect', primary)"
          >
            Reconnect
          </UButton>
          <UButton
            v-else
            ref="connectBtnRef"
            color="neutral"
            variant="outline"
            size="sm"
            @click="emit('manage', primary)"
          >
            Manage
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            @click="emit('disconnect', primary)"
          >
            Disconnect
          </UButton>
        </template>
      </template>
      <p
        v-else
        class="text-sm text-muted"
      >
        Ask an admin to connect this provider.
      </p>
    </div>
  </article>
</template>
