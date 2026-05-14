import { fabric } from 'fabric'
import { BaseElement, type ElementMeta } from './BaseElement'

interface NumInputProps {
  value: number
  fontSize: number
  label: string
  labelFontSize: number
  labelPosition?: string
  labelVisible?: boolean
  fontFamily?: string
  fontWeight?: string
  elementWidth: number
  elementHeight: number
}

export class NumberInput extends BaseElement<NumInputProps> {
  static elementType = 'numInput'
  static category = 'numeric'
  static subcategory = 'controls'
  static meta = { inputs: [], outputs: ['value'] } satisfies ElementMeta

  private txt: fabric.Text
  private border: fabric.Rect

  constructor(
    canvas: fabric.Canvas,
    x: number,
    y: number,
    props: Partial<NumInputProps> = {}
  ) {
    const defaults: NumInputProps = {
      value: 0,
      fontSize: 24,
      label: 'Numeric Input',
      labelFontSize: 14,
      labelPosition: 'bottom',
      labelVisible: true,
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'normal',
      elementWidth: 120,
      elementHeight: 40,
    }
    const p = { ...defaults, ...props }

    const border = new fabric.Rect({
      width: p.elementWidth, height: p.elementHeight,
      fill: 'transparent', stroke: '#ccc', strokeWidth: 1,
      rx: 4, ry: 4,
      originX: 'center', originY: 'center',
      left: 0, top: 0
    })

    const text = new fabric.Text(String(p.value), {
      fontSize: p.fontSize, fill: '#000',
      originX: 'center', originY: 'center',
      left: 0, top: 0,
      textAlign: 'center',
      fontFamily: p.fontFamily, fontWeight: p.fontWeight
    })

    super(canvas, x, y, [border, text], p)

    this.txt = text
    this.border = border

    this.on('mouseup', (e) => {
      if (!this.isRuntime) return
      e.e.preventDefault()
      e.e.stopPropagation()
      this.canvas?.fire('element:edit-number', { target: this })
    })
  }

  getInputRect() {
    return {
      width: this.border.width ?? 120,
      height: this.border.height ?? 40,
      offsetX: this.border.left ?? 0,
      offsetY: this.border.top ?? 0,
    }
  }

  commitValue(raw: string) {
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    this.customProps.value = n
    this.txt.set({ text: String(n) })
    this.canvas?.requestRenderAll()
    this.emitState()
  }

  setEditing(active: boolean) {
    this.border.set('stroke', active ? '#3b82f6' : '#ccc')
    this.txt.set('fill', active ? '#3b82f6' : '#000')
    this.canvas?.requestRenderAll()
  }

  updateFromProps() {
    const w = this.customProps.elementWidth ?? 120
    const h = this.customProps.elementHeight ?? 40
    this.border.set({ width: w, height: h })
    this.txt.set({
      text: String(this.customProps.value),
      fontSize: this.customProps.fontSize,
      fontFamily: this.customProps.fontFamily || 'Arial, sans-serif',
      fontWeight: this.customProps.fontWeight || 'normal'
    })
    this.label.set({
      text: this.customProps.label,
      fontSize: this.customProps.labelFontSize,
      left: 0,
      fontFamily: this.customProps.fontFamily || 'Arial, sans-serif',
      fontWeight: this.customProps.fontWeight || 'normal'
    })
    this.stableAddWithUpdate()
    this.applyLabelLayout()
    this.setCoords()
    this.canvas?.requestRenderAll()
  }

  private emitState() {
    this.canvas?.fire('element:output', { target: this, name: 'value', value: this.customProps.value })
  }
}


