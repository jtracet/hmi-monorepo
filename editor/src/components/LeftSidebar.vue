<template>
  <div v-bind="$attrs">
    <n-radio-group
        v-model:value="mode"
        class="mb-4"
        size="small"
    >
      <n-radio-button value="runtime">Тестирование</n-radio-button>
      <n-radio-button value="design">Редактирование</n-radio-button>
    </n-radio-group>
    
    <div class="w-64 bg-gray-100 p-4 overflow-y-auto space-y-2 border-r" style="max-height: 600px;">
      <h style="font-size: 18px;"><b>Элементы</b></h>
      <div 
        v-for="(categoryData, categoryKey) in paletteWithSubcategories" 
        :key="categoryKey"
        class="border border-gray-300 rounded bg-white overflow-hidden mb-2"
      >
        <div 
          class="flex items-center justify-between px-3 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100 transition"
          @click="toggleCategory(categoryKey)"
        >
          <h2 class="font-semibold capitalize">{{ getCategoryDisplayName(categoryKey) }}</h2>
          <span class="text-gray-600 text-lg transition-transform" :class="{ 'rotate-180': expandedCategory === categoryKey }">
            ▼
          </span>
        </div>
        
        <div v-if="expandedCategory === categoryKey" class="p-2 space-y-2 border-t border-gray-200">
          <template v-if="categoryData.hasSubcategories">
            <div v-if="categoryData.subcategories.controls?.length" class="border border-gray-200 rounded overflow-hidden">
              <div 
                class="flex items-center justify-between px-3 py-1.5 bg-gray-100 text-sm cursor-pointer hover:bg-gray-200 transition"
                @click.stop="toggleSubcategory(categoryKey, 'controls')"
              >
                <span class="font-medium">Controls</span>
                <span class="text-gray-600 text-sm transition-transform" :class="{ 'rotate-180': expandedSubcategory[`${categoryKey}-controls`] }">
                  ▼
                </span>
              </div>
              <div v-if="expandedSubcategory[`${categoryKey}-controls`]" class="p-1 space-y-1">
                <button
                  v-for="s in categoryData.subcategories.controls"
                  :key="s.key"
                  draggable="true"
                  @dragstart="e => e.dataTransfer?.setData('shape', s.key)"
                  class="block w-full px-3 py-1.5 bg-white rounded shadow-sm text-left hover:bg-gray-50 active:scale-95 transition text-sm"
                >
                  {{ getElementDisplayName(s.key) }}
                </button>
              </div>
            </div>

            <div v-if="categoryData.subcategories.indicators?.length" class="border border-gray-200 rounded overflow-hidden">
              <div 
                class="flex items-center justify-between px-3 py-1.5 bg-gray-100 text-sm cursor-pointer hover:bg-gray-200 transition"
                @click.stop="toggleSubcategory(categoryKey, 'indicators')"
              >
                <span class="font-medium">Indicators</span>
                <span class="text-gray-600 text-sm transition-transform" :class="{ 'rotate-180': expandedSubcategory[`${categoryKey}-indicators`] }">
                  ▼
                </span>
              </div>
              <div v-if="expandedSubcategory[`${categoryKey}-indicators`]" class="p-1 space-y-1">
                <button
                  v-for="s in categoryData.subcategories.indicators"
                  :key="s.key"
                  draggable="true"
                  @dragstart="e => e.dataTransfer?.setData('shape', s.key)"
                  class="block w-full px-3 py-1.5 bg-white rounded shadow-sm text-left hover:bg-gray-50 active:scale-95 transition text-sm"
                >
                  {{ getElementDisplayName(s.key) }}
                </button>
              </div>
            </div>
          </template>

          <template v-else>
            <button
              v-for="s in categoryData.items"
              :key="s.key"
              draggable="true"
              @dragstart="e => e.dataTransfer?.setData('shape', s.key)"
              class="block w-full px-3 py-1.5 bg-white rounded shadow-sm text-left hover:bg-gray-50 active:scale-95 transition text-sm"
            >
              {{ getElementDisplayName(s.key) }}
            </button>
          </template>

          <div v-if="!categoryData.items.length && !categoryData.hasSubcategories" class="text-gray-400 text-sm italic px-2 py-1">
            Нет элементов
          </div>
        </div>
      </div>
    </div>

    <hr class="my-3"/>

    <n-button block secondary size="small" class="mb-2" @click="doSave">
      Сохранить (JSON)
    </n-button>
    <n-button block tertiary size="small" @click="openFileDialog">
      Загрузить...
    </n-button>
    <input
        type="file"
        accept=".json"
        ref="fileInp"
        class="hidden"
        @change="onFile"
    />
  </div>
</template>

<script setup lang="ts">
import {ref, computed, onMounted} from 'vue'
import {NButton} from 'naive-ui'
import {fabric} from 'fabric'
import {useCanvas, setSuppressSnapshots, resetHistory} from '../composables/useCanvas'
import {ElementRegistry} from '../elements'
import {useEditorStore} from '../store/editor'
import {useCanvasStore} from '../store/canvas'
import {usePagesStore} from '../store/pages'

const editor = useEditorStore()
const mode = computed({
  get: () => editor.mode,
  set: v => editor.setMode(v)
})

const {canvas} = useCanvas()
const canvasStore = useCanvasStore()
const pagesStore = usePagesStore()

const expandedCategory = ref<string | null>(null)
const expandedSubcategory = ref<Record<string, boolean>>({})

const elementDisplayNames: Record<string, string> = {
  'numInput': 'Numeric Input',
  'numControl': 'Numeric Stepper',
  'numDisplay': 'Numeric Indicator',
  'toggle': 'Slide Switch',
  'slider': 'slider',
  'button': 'Кнопка',
  'text': 'Текст',
  'image': 'Image',
  'led': 'Round LED',
  'gauge': 'Стрелочный индикатор',
  'progress': 'Прогресс-бар',
  'time-graph': 'График времени',
  'trend': 'Тренд',
  'rectangle': 'Прямоугольник',
  'circle': 'Круг',
  'line': 'Line',
  'container': 'Контейнер',
  'graph': 'Time Graph',
  'analog-input': 'Аналоговый ввод',
  'digital-input': 'Дискретный ввод',
  'meter': 'Измеритель',
  'knob': 'Ручка',
  'switch': 'Выключатель',
  'indicator': 'Индикатор',
  'chart': 'Диаграмма',
  'thermometer': 'Термометр',
  'tank': 'Tank',
}

const categoryDisplayNames: Record<string, string> = {
  'numeric': 'numeric',
  'boolean': 'boolean',
  'graph': 'graph',
  'decorations': 'decorations',
  'ring': 'ring',
  'layout': 'layout',
}

function getElementDisplayName(elementKey: string): string {
  return elementDisplayNames[elementKey] || elementKey
}

function getCategoryDisplayName(categoryKey: string): string {
  return categoryDisplayNames[categoryKey] || categoryKey
}

const palette: Record<string, any[]> = {
  numeric: [],
  boolean: [],
  graph: [],
  decorations: [],
  ring: [],
  layout: [],
}

// 'time-graph' is an alias for loading saved files, not a separate palette item
const PALETTE_SKIP = new Set(['time-graph'])

Object.entries(ElementRegistry).forEach(([key, ctor]) => {
  if (PALETTE_SKIP.has(key)) return
  const category = (ctor as any).category || 'decorations'
  const elementType = (ctor as any).elementType || key
  const subcategory = (ctor as any).subcategory
  
  if (palette.hasOwnProperty(category)) {
    palette[category].push({ key, label: elementType, subcategory })
  } else {
    console.warn(`Category "${category}" not found in palette, adding to decorations`)
    palette.decorations.push({ key, label: elementType, subcategory })
  }
})

const paletteWithSubcategories = computed(() => {
  const result: Record<string, any> = {}
  Object.entries(palette).forEach(([categoryKey, items]) => {
    const hasSubcategories = items.some(item => item.subcategory)
    if (hasSubcategories) {
      const subcategories: Record<string, any[]> = { controls: [], indicators: [] }
      const itemsWithoutSubcategory: any[] = []
      items.forEach(item => {
        if (item.subcategory === 'controls') subcategories.controls.push(item)
        else if (item.subcategory === 'indicators') subcategories.indicators.push(item)
        else itemsWithoutSubcategory.push(item)
      })
      result[categoryKey] = { hasSubcategories: true, subcategories, items: itemsWithoutSubcategory }
    } else {
      result[categoryKey] = { hasSubcategories: false, items }
    }
  })
  return result
})

function toggleCategory(categoryKey: string) {
  if (expandedCategory.value === categoryKey) {
    expandedCategory.value = null
  } else {
    expandedCategory.value = categoryKey
    expandedSubcategory.value = {}
  }
}

function toggleSubcategory(categoryKey: string, subcategoryKey: string) {
  const key = `${categoryKey}-${subcategoryKey}`
  expandedSubcategory.value[key] = !expandedSubcategory.value[key]
}

onMounted(() => {
  const firstCategory = Object.keys(palette)[0]
  if (firstCategory) expandedCategory.value = firstCategory
})

const fileInp = ref<HTMLInputElement | null>(null)

function openFileDialog() {
  fileInp.value?.click()
}

function doSave() {
  if (!canvas.value) return

  // Save current page state first
  const currentCanvasJson = canvas.value.toJSON(['id', 'customProps', 'elementType', 'bindings', 'meta'])
  const currentView = canvasStore.serializeView()
  pagesStore.saveCurrentPageState(currentCanvasJson, currentView)

  const hmi = {
    meta: {version: '2.0', created: new Date().toISOString()},
    pages: pagesStore.serialize(),
    activePageId: pagesStore.activePageId,
    grid: {
      showGrid: canvasStore.grid.showGrid,
      snapToGrid: canvasStore.grid.snapToGrid,
      showGuides: canvasStore.grid.showGuides,
    },
  }
  const blob = new Blob([JSON.stringify(hmi, null, 2)], {type: 'application/json'})
  const a = document.createElement('a')
  a.download = 'screen.hmi.json'
  a.href = url
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f || !canvas.value) return
  f.text().then(text => {
    const json = JSON.parse(text)
    const c = canvas.value
    if (!c) return

    if (json.grid) {
      canvasStore.setGridState({
        showGrid: Boolean(json.grid.showGrid),
        snapToGrid: Boolean(json.grid.snapToGrid),
        showGuides: Boolean(json.grid.showGuides),
      })
    }

    // New multi-page format (version 2.0+)
    if (json.pages && Array.isArray(json.pages)) {
      pagesStore.restore(json.pages, json.activePageId)
      const activePage = pagesStore.activePage
      if (activePage?.canvasJson) {
        loadCanvasFromJson(c, activePage.canvasJson)
        if (activePage.view) canvasStore.setViewportTransform(activePage.view)
      } else {
        c.clear()
        c.requestRenderAll()
      }
      return
    }

    // Legacy single-page format (version 1.0)
    const objects = json.canvas?.objects ?? []
    loadCanvasFromJson(c, { objects })
    if (json.view) canvasStore.setViewportTransform(json.view)
  })
}

function loadCanvasFromJson(c: fabric.Canvas, canvasJson: { objects: any[] }) {
  const objects = canvasJson?.objects ?? []
  c.clear()

  for (const obj of objects) {
    const type = obj.elementType
    if (!type) continue

    if (type === 'image') {
      fabric.util.enlivenObjects([obj], (objs: fabric.Object[]) => {
        const img = objs[0]
        if (!img) return
        img.set({ selectable: true, evented: true })
        c.add(img)
        c.requestRenderAll()
      }, 'fabric')
      continue
    }

    const Ctor = ElementRegistry[type as keyof typeof ElementRegistry]
    if (!Ctor) {
      console.warn('[load] unknown elementType, skipping:', type)
      continue
    }

    const props = obj.customProps ?? {}
    const el = new Ctor(c, obj.left ?? 0, obj.top ?? 0, props)

    el.id = obj.id || crypto.randomUUID()

    const bindings = obj.bindingsData ?? obj.bindings ?? { inputs: {}, outputs: {} }
    if (typeof (el as any).setBindings === 'function') {
      ;(el as any).setBindings(bindings)
    }

    el.set({
      scaleX: obj.scaleX ?? 1,
      scaleY: obj.scaleY ?? 1,
      angle: obj.angle ?? 0,
      flipX: obj.flipX ?? false,
      flipY: obj.flipY ?? false,
      hasControls: false,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true,
    })
    el.setCoords()
    ;(el as any).updateFromProps?.()
  }

  // Прогреваем oCoords через цикл ActiveSelection → discard,
  // иначе findTarget после загрузки находит устаревший кеш и контролы не работают
  const allObjects = c.getObjects()
  if (allObjects.length > 0) {
    const warmup = new fabric.ActiveSelection(allObjects, { canvas: c })
    c.setActiveObject(warmup)
    c.discardActiveObject()
  }

  c.requestRenderAll()
}
</script>

<style scoped>
.rotate-180 {
  transform: rotate(180deg);
}

.overflow-y-auto {
  scrollbar-width: thin;
  scrollbar-color: #9ca3af #e5e7eb;
}

.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #e5e7eb;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #9ca3af;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}
</style>
