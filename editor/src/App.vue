<template>
  <div class="flex h-screen flex-col overflow-hidden">
    <TopToolbar />
    <div class="flex flex-1 overflow-hidden min-h-0">
      <LeftSidebar class="flex-shrink-0" />
      <div class="flex flex-col flex-1 min-w-0 overflow-hidden">
        <CanvasComponent ref="canvasRef" class="flex-1 min-h-0" />
        <PageBar
          @switch="onSwitchPage"
          @add="onAddPage"
          @remove="onRemovePage"
        />
      </div>
      <RightSidebar :selected="selectedObject" class="flex-shrink-0" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import LeftSidebar from './components/LeftSidebar.vue'
import CanvasComponent from './components/CanvasComponent.vue'
import RightSidebar from './components/RightSidebar.vue'
import TopToolbar from './components/TopToolbar.vue'
import PageBar from './components/PageBar.vue'
import { useCanvasStore } from './store/canvas'
import { usePagesStore } from './store/pages'

const store = useCanvasStore()
const pagesStore = usePagesStore()
const selectedObject = computed(() => store.selection.selectedObject)

const canvasRef = ref<InstanceType<typeof CanvasComponent> | null>(null)

onMounted(() => {
  pagesStore.init()
})

async function onSwitchPage(toId: string, fromId: string) {
  // Save current page state before switching
  const canvasJson = canvasRef.value?.serializePage() ?? null
  const view = store.serializeView()
  pagesStore.saveCurrentPageState(canvasJson, view)

  // Switch active page
  pagesStore.setActivePage(toId)

  // Load new page state
  const page = pagesStore.pages.find(p => p.id === toId)
  canvasRef.value?.loadPage(page?.canvasJson ?? null, page?.view ?? null)
}

function onAddPage(pageId: string) {
  // Save current page before switching to new one
  const canvasJson = canvasRef.value?.serializePage() ?? null
  const view = store.serializeView()
  pagesStore.saveCurrentPageState(canvasJson, view)

  pagesStore.setActivePage(pageId)
  canvasRef.value?.loadPage(null, null)
}

function onRemovePage(_pageId: string) {
  // After removal, load the now-active page
  const page = pagesStore.activePage
  if (page) {
    canvasRef.value?.loadPage(page.canvasJson ?? null, page.view ?? null)
  }
}
</script>
