<template>
  <div class="h-full flex flex-row">
    <div class="flex-1 flex flex-col h-full min-w-0">
      <TopBar @load-hmi="handleFile" @zoom="handleZoom"/>
      <ViewerCanvas ref="viewerCanvas" :hmi="activePage" class="flex-1 min-h-0"/>
      <PageBar
        v-if="pages.length > 1"
        :pages="pages"
        :active-page-id="activePageId"
        @switch="switchPage"
      />
    </div>

    <div class="flex-shrink-0 w-[500px] border-l h-full overflow-auto z-10">
      <SnapshotPanel />
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import TopBar        from '@/components/TopBar.vue'
import ViewerCanvas  from '@/components/ViewerCanvas.vue'
import SnapshotPanel from '@/components/SnapshotPanel.vue'
import PageBar       from '@/components/PageBar.vue'
import { useSessionStore } from '@/store/session'
import type { HmiFile } from '@/runtime/useHmiRuntime'

interface PageState {
  id: string
  name: string
  canvasJson: any
  view: any
}

const pages = ref<PageState[]>([])
const activePageId = ref('')
const viewerCanvas = ref<InstanceType<typeof ViewerCanvas>>()

// Формируем HmiFile для активной страницы
const activePage = computed<HmiFile | null>(() => {
  if (!pages.value.length) return null
  const page = pages.value.find(p => p.id === activePageId.value) ?? pages.value[0]
  return {
    meta: { version: '2.0', created: '' },
    canvas: page.canvasJson,
  }
})

function switchPage(pageId: string) {
  if (pageId === activePageId.value) return
  activePageId.value = pageId
}

function handleFile(file: File) {
  file.text().then(t => {
    let json: any
    try { json = JSON.parse(t) } catch (e) { console.error('[App] invalid JSON:', e); return }

    // v2.0 multi-page format
    if (json.pages && Array.isArray(json.pages)) {
      pages.value = json.pages
      activePageId.value = json.activePageId ?? json.pages[0]?.id ?? ''
      return
    }

    // v1.0 legacy — single page
    pages.value = [{ id: 'page-1', name: 'Page 1', canvasJson: json.canvas, view: json.view }]
    activePageId.value = 'page-1'
  })
}

function handleZoom(action: 'in' | 'out' | 'reset' | 'actual' | 'fit') {
  const vc = viewerCanvas.value
  if (!vc) return
  const map = { in: vc.zoomIn, out: vc.zoomOut, reset: vc.zoomReset, actual: vc.zoomActual, fit: vc.zoomFit }
  map[action]()
}

onMounted(() => {
  const id = new URLSearchParams(location.search).get('session') ?? ''
  if (id) useSessionStore().setSession(id)
})
</script>
