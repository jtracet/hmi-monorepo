<template>
  <header class="flex items-center gap-4 px-4 py-2 bg-white shadow">
    <h1 class="font-semibold">HMI Viewer</h1>
    <n-button @click="fileInp.click()" secondary size="small">
      Загрузить...
    </n-button>
    <input ref="fileInp" type="file" accept=".json,.hmi" class="hidden" @change="onPick"/>
    <span v-if="sessionId" class="text-xs text-gray-500">session: {{ sessionId }}</span>
  </header>
</template>

<script setup lang="ts">
import {ref, computed} from 'vue'
import {NButton} from 'naive-ui'
import {useSessionStore} from '@/store/session'

const emit = defineEmits<{ (e: 'load-hmi', f: File): void }>()
const fileInp = ref<HTMLInputElement>()
const store = useSessionStore()
const sessionId = computed(() => store.sessionId)

function onPick(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) emit('load-hmi', f)
}

function applySession() {
  const id = sessionId.value.trim()
  if (!id) return
  const ss = useSessionStore()
  ss.setSession(id)
}
</script>
