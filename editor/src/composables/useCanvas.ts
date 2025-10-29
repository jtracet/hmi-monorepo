import {ref} from 'vue'
import type {fabric} from 'fabric'

const canvas = ref<fabric.Canvas | null>(null)

export function setCanvas(c: fabric.Canvas) {
    canvas.value = c
}

export function useCanvas() {
    return {canvas}
}
