import { fabric } from 'fabric'
import { BaseElement } from './BaseElement'

export interface RingItem {
  label: string
  value: number
}

interface RingSelectorProps {
  label: string
  labelFontSize: number
  fontFamily?: string
  fontWeight?: string
  fontSize: number
  elementWidth: number
  elementHeight: number
  selectedIndex: number
  items: RingItem[]
  bgColor: string
  textColor: string
}

export class RingSelector extends BaseElement<RingSelectorProps> {
  static elementType = 'ringSelector'
  static category = 'ring'
  static subcategory = 'controls'
  static meta = { inputs: [], outputs: ['value'] }

  private readonly btnW = 24

  private txt: fabric.Text
  private border: fabric.Rect
  private btnDrop: fabric.Rect
  private arrowDrop: fabric.Text

  private lastClickTime = 0

  constructor(
    canvas: fabric.Canvas,
    x: number,
    y: number,
    props: Partial<RingSelectorProps> = {}
  ) {
    const defaults: RingSelectorProps = {
      label: 'Ring Selector',
      labelFontSize: 14,
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'normal',
      fontSize: 14,
      elementWidth: 140,
      elementHeight: 36,
      selectedIndex: 0,
      items: [
        { label: 'Option 0', value: 0 },
        { label: 'Option 1', value: 1 },
        { label: 'Option 2', value: 2 },
      ],
      bgColor: '#ffffff',
      textColor: '#111827',
    }

    const p: RingSelectorProps = {
      ...defaults,
      ...props,
      items: props.items && props.items.length > 0 ? props.items : defaults.items,
    }
    p.selectedIndex = Math.max(0, Math.min(p.selectedIndex, p.items.length - 1))

    const btnW = 24
    const cw   = p.elementWidth
    const h    = p.elementHeight

    const border = new fabric.Rect({
      width: cw, height: h,
      fill: p.bgColor, stroke: '#ccc', strokeWidth: 1,
      rx: 3, ry: 3,
      originX: 'center', originY: 'center',
      left: 0, top: 0,
    })

    const currentItem = p.items[p.selectedIndex] ?? p.items[0]
    const text = new fabric.Text(currentItem?.label ?? '—', {
      fontSize: p.fontSize,
      fill: p.textColor,
      fontFamily: p.fontFamily,
      fontWeight: p.fontWeight,
      originX: 'center', originY: 'center',
      left: -(btnW / 2), top: 0,
      textAlign: 'left',
      selectable: false, evented: false,
    })

    const btnDrop = new fabric.Rect({
      width: btnW, height: h,
      fill: '#e5e7eb', stroke: '#ccc', strokeWidth: 1,
      rx: 3, ry: 3,
      originX: 'center', originY: 'center',
      left: cw / 2 - btnW / 2, top: 0,
    })

    const arrowDrop = new fabric.Text('▾', {
      fontSize: 14, fill: '#374151',
      originX: 'center', originY: 'center',
      left: cw / 2 - btnW / 2, top: 0,
      selectable: false, evented: false,
    })

    super(canvas, x, y, [border, text, btnDrop, arrowDrop], p)

    this.label.set({
      text: p.label,
      fontSize: p.labelFontSize,
      originX: 'center', originY: 'top',
      top: h / 2.2, left: 0,
      fontFamily: p.fontFamily,
      fontWeight: p.fontWeight,
    })

    this.txt      = text
    this.border   = border
    this.btnDrop  = btnDrop
    this.arrowDrop = arrowDrop

    this.hoverCursor = 'pointer'

    this.on('mouseup', (e) => {
      const now = Date.now()
      if (now - this.lastClickTime < 200) return
      this.lastClickTime = now
      e.e.preventDefault()
      e.e.stopPropagation()
      this.canvas?.fire('element:open-dropdown', { target: this })
    })

    this.on('mousemove', (e) => {
      const pointer = this.canvas!.getPointer(e.e)
      const center  = this.getCenterPoint()
      const localX  = pointer.x - center.x
      const inBtn   = localX > this.customProps.elementWidth / 2 - this.btnW
      this.btnDrop.set('fill', inBtn ? '#d1d5db' : '#e5e7eb')
      this.canvas?.requestRenderAll()
    })

    this.on('mouseout', () => {
      this.btnDrop.set('fill', '#e5e7eb')
      this.canvas?.requestRenderAll()
    })
  }

  selectItem(idx: number) {
    const items = this.customProps.items
    if (!items.length) return
    this.customProps.selectedIndex = Math.max(0, Math.min(idx, items.length - 1))
    this.updateValue()
    this.emitState()
  }

  setState(state: Record<string, any>) {
    if (state.index !== undefined) {
      const idx = Number(state.index)
      if (Number.isFinite(idx)) {
        this.customProps.selectedIndex = Math.max(
          0, Math.min(Math.round(idx), this.customProps.items.length - 1)
        )
        this.updateValue()
      }
    }
  }

  private updateValue() {
    const p = this.customProps
    const items = p.items ?? []
    const idx = Math.max(0, Math.min(p.selectedIndex, items.length - 1))
    const current = items[idx]
    this.txt.set({
      text: current?.label ?? '—',
      fill: p.textColor,
      fontFamily: p.fontFamily || 'Arial, sans-serif',
      fontWeight: p.fontWeight || 'normal',
    })
    this.canvas?.requestRenderAll()
  }

  updateFromProps() {
    const p   = this.customProps
    const items = p.items ?? []
    const idx = Math.max(0, Math.min(p.selectedIndex, items.length - 1))
    p.selectedIndex = idx

    const cw  = p.elementWidth
    const h   = p.elementHeight
    const bw  = this.btnW

    this.border.set({ width: cw, height: h, fill: p.bgColor })
    this.btnDrop.set({ height: h, left: cw / 2 - bw / 2 })
    this.arrowDrop.set({ left: cw / 2 - bw / 2 })
    this.txt.set({
      text: items[idx]?.label ?? '—',
      fontSize: p.fontSize,
      fill: p.textColor,
      fontFamily: p.fontFamily || 'Arial, sans-serif',
      fontWeight: p.fontWeight || 'normal',
      left: -(bw / 2),
    })
    this.label.set({
      text: p.label,
      fontSize: p.labelFontSize,
      top: h / 2.2,
      fontFamily: p.fontFamily || 'Arial, sans-serif',
      fontWeight: p.fontWeight || 'normal',
    })
    this.addWithUpdate()
    this.setCoords()
    this.canvas?.requestRenderAll()
  }

  getDropdownRect(): { width: number; height: number; offsetX: number; offsetY: number } {
    return {
      width:   this.customProps.elementWidth,
      height:  this.customProps.elementHeight,
      offsetX: 0,
      offsetY: 0,
    }
  }

  private emitState() {
    const item = this.customProps.items[this.customProps.selectedIndex]
    this.canvas?.fire('element:output', {
      target: this, name: 'value', value: item?.value ?? 0,
    })
  }
}
