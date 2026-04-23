<template>
  <div class="flex items-center border-t border-gray-200 bg-gray-50 h-9 px-2 gap-1 overflow-x-auto select-none shrink-0">
    <div
      v-for="page in pages"
      :key="page.id"
      class="flex items-center gap-1 px-3 h-7 rounded-t text-sm cursor-pointer border border-b-0 transition-colors shrink-0"
      :class="page.id === activePageId
        ? 'bg-white border-gray-300 text-gray-900 font-medium'
        : 'bg-gray-100 border-transparent text-gray-500 hover:bg-gray-200'"
      @click="$emit('switch', page.id)"
    >
      <span>{{ page.name }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  pages: Array<{ id: string; name: string }>
  activePageId: string
}>()

defineEmits<{
  (e: 'switch', pageId: string): void
}>()
</script>
