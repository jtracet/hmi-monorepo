<template>
  <div class="flex h-screen flex-col overflow-hidden">
    <TopToolbar />
    <div class="flex flex-1 overflow-hidden">
      <LeftSidebar class="flex-shrink-0" />
      <CanvasComponent class="flex-1" />
      <SidebarOperations class="flex-shrink-0" />
    </div>
  </div>
</template>

<script setup lang="ts">
import LeftSidebar from './components/LeftSidebar.vue'
import CanvasComponent from './components/CanvasComponent.vue'
import SidebarOperations from './components/operations/SidebarOperations.vue'
import TopToolbar from './components/TopToolbar.vue'
</script>
