<template>
  <div class="flex items-center border-t border-gray-200 bg-gray-50 h-9 px-2 gap-1 overflow-x-auto select-none shrink-0">
    <div
      v-for="page in pages"
      :key="page.id"
      class="flex items-center gap-1 px-3 h-7 rounded-t text-sm cursor-pointer border border-b-0 transition-colors shrink-0"
      :class="page.id === activePageId
        ? 'bg-white border-gray-300 text-gray-900 font-medium'
        : 'bg-gray-100 border-transparent text-gray-500 hover:bg-gray-200'"
      @click="selectPage(page.id)"
      @dblclick="startRename(page)"
    >
      <template v-if="renamingId === page.id">
        <input
          ref="renameInput"
          v-model="renameValue"
          class="w-20 text-sm outline-none border-b border-blue-400 bg-transparent"
          @keydown.enter.prevent="commitRename"
          @keydown.escape.prevent="cancelRename"
          @blur="commitRename"
          @click.stop
        />
      </template>
      <template v-else>
        <span>{{ page.name }}</span>
        <button
          v-if="pages.length > 1"
          class="ml-1 text-gray-400 hover:text-red-500 leading-none"
          @click.stop="removePage(page.id)"
          title="Удалить страницу"
        >×</button>
      </template>
    </div>

    <button
      class="flex items-center justify-center w-7 h-7 rounded text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors shrink-0 text-lg leading-none"
      title="Добавить страницу"
      @click="addPage"
    >+</button>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import { usePagesStore } from '../store/pages'

const emit = defineEmits<{
  (e: 'switch', toId: string, fromId: string): void
  (e: 'add', pageId: string): void
  (e: 'remove', pageId: string): void
}>()

const store = usePagesStore()
const pages = computed(() => store.pages)
const activePageId = computed(() => store.activePageId)

const renamingId = ref<string | null>(null)
const renameValue = ref('')
const renameInput = ref<HTMLInputElement | null>(null)

function selectPage(id: string) {
  if (id === activePageId.value || renamingId.value) return
  emit('switch', id, activePageId.value)
}

function addPage() {
  const page = store.addPage()
  emit('add', page.id)
}

function removePage(id: string) {
  const wasActive = id === activePageId.value
  const idx = store.pages.findIndex(p => p.id === id)
  store.removePage(id)
  if (wasActive) {
    const newActive = store.pages[Math.max(0, idx - 1)]
    if (newActive) emit('switch', newActive.id, id)
  }
  emit('remove', id)
}

function startRename(page: { id: string; name: string }) {
  renamingId.value = page.id
  renameValue.value = page.name
  nextTick(() => renameInput.value?.focus())
}

function commitRename() {
  if (renamingId.value && renameValue.value.trim()) {
    store.renamePage(renamingId.value, renameValue.value.trim())
  }
  renamingId.value = null
}

function cancelRename() {
  renamingId.value = null
}
</script>
