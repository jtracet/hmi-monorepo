<template>
  <header class="border-b border-gray-200 bg-white px-4 py-2 shadow-sm">
    <div class="flex items-start gap-4 overflow-x-auto pb-1">
      <div
          v-for="section in sections"
          :key="section.id"
          class="flex items-center gap-2"
      >
        <span class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">{{ section.title }}</span>
        <div class="flex items-center gap-2">
          <OpButton
              v-for="cmd in commandsBySection(section.id)"
              :key="cmd.id"
              :command-id="cmd.id"
              :disabled="isCommandDisabled(cmd)"
              :active="isCommandHighlighted(section.id, cmd)"
              layout="horizontal"
              :stretch="false"
          />
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import {computed} from 'vue'
import {SECTIONS, listCommandsBySection} from '../commands'
import type {OperationSectionId} from '../commands/types'
import {useCommandState} from '../composables/useCommandState'
import {useCanvasStore} from '../store/canvas'
import OpButton from './operations/OpButton.vue'

const sections = computed(() => SECTIONS)
const {isCommandDisabled, isCommandActive} = useCommandState()
const store = useCanvasStore()
const lastCommand = computed(() => store.operations.lastCommand)

function commandsBySection(section: OperationSectionId) {
  return listCommandsBySection(section)
}

function isCommandHighlighted(section: OperationSectionId, cmd: ReturnType<typeof commandsBySection>[number]) {
  return isCommandActive(cmd) || lastCommand.value[section] === cmd.id
}
</script>
