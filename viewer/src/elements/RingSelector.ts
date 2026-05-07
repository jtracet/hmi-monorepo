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
  static meta = { inputs: ['index'], outputs: ['value'] }

  private readonly btnW = 18

  private txt: fabric.Text
  private border: fabric.Rect
  private btnLeft: fabric.Rect
  private btnRight: fabric.Rect
  private arrowLeft: fabric.Text
  private arrowRight: fabric.Text

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
      fontSize: 15,
      elementWidth: 120,
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

    const btnW = 18
    const cw   = p.elementWidth
    const h    = p.elementHeight

    const btnLeft = new fabric.Rect({
      width: btnW, height: h,
      fill: '#e5e7eb', stroke: '#ccc', strokeWidth: 1,
      rx: 3, ry: 3,
      originX: 'center', originY: 'center',
      left: -(cw / 2 + btnW / 2), top: 0,
    })

    const arrowLeft = new fabric.Text('◀', {
      fontSize: 9, fill: '#374151',
      originX: 'center', originY: 'center',
      left: -(cw / 2 + btnW / 2), top: 0,
      selectable: false, evented: false,
    })

    const border = new fabric.Rect({
      width: cw, height: h,
      fill: p.bgColor, stroke: '#ccc', strokeWidth: 1,
      originX: 'center', originY: 'center',
      left: 0, top: 0,
    })

    const currentItem = p.items[p.selectedIndex] ?? p.items[0]
    const text = new fabric.Text(currentItem ? String(currentItem.value) : '—', {
      fontSize: p.fontSize,
      fill: p.textColor,
      originX: 'center', originY: 'center',
      left: 0, top: 0,
      textAlign: 'center',
      fontFamily: p.fontFamily,
      fontWeight: p.fontWeight,
      selectable: false, evented: false,
    })

    const btnRight = new fabric.Rect({
      width: btnW, height: h,
      fill: '#e5e7eb', stroke: '#ccc', strokeWidth: 1,
      rx: 3, ry: 3,
      originX: 'center', originY: 'center',
      left: cw / 2 + btnW / 2, top: 0,
    })

    const arrowRight = new fabric.Text('▶', {
      fontSize: 9, fill: '#374151',
      originX: 'center', originY: 'center',
      left: cw / 2 + btnW / 2, top: 0,
      selectable: false, evented: false,
    })

    super(canvas, x, y, [btnLeft, arrowLeft, border, text, btnRight, arrowRight], p)

    this.label.set({
      text: p.label,
      fontSize: p.labelFontSize,
      originX: 'center', originY: 'top',
      top: h / 2.2, left: 0,
      fontFamily: p.fontFamily,
      fontWeight: p.fontWeight,
    })

    this.txt       = text
    this.border    = border
    this.btnLeft   = btnLeft
    this.btnRight  = btnRight
    this.arrowLeft  = arrowLeft
    this.arrowRight = arrowRight

    this.hoverCursor = 'pointer'

    this.on('mouseup', (e) => {
      const now = Date.now()
      if (now - this.lastClickTime < 200) return
      this.lastClickTime = now
      e.e.preventDefault()
      e.e.stopPropagation()

      const pointer = this.canvas!.getPointer(e.e)
      const center  = this.getCenterPoint()
      const localX  = pointer.x - center.x
      const halfCW  = this.customProps.elementWidth / 2

      if (localX < -halfCW)     this.stepIndex(-1)
      else if (localX > halfCW) this.stepIndex(+1)
    })

    this.on('mousemove', (e) => {
      const pointer = this.canvas!.getPointer(e.e)
      const center  = this.getCenterPoint()
      const localX  = pointer.x - center.x
      const halfCW  = this.customProps.elementWidth / 2

      this.btnLeft.set('fill',  localX < -halfCW ? '#d1d5db' : '#e5e7eb')
      this.btnRight.set('fill', localX >  halfCW ? '#d1d5db' : '#e5e7eb')
      this.canvas?.requestRenderAll()
    })

    this.on('mouseout', () => {
      this.btnLeft.set('fill',  '#e5e7eb')
      this.btnRight.set('fill', '#e5e7eb')
      this.canvas?.requestRenderAll()
    })
  }

  private stepIndex(delta: number) {
    const items = this.customProps.items
    if (!items.length) return
    let idx = this.customProps.selectedIndex + delta
    idx = ((idx % items.length) + items.length) % items.length
    this.customProps.selectedIndex = idx
    this.updateFromProps()
    this.emitState()
  }

  setState(state: Record<string, any>) {
    if (state.index !== undefined) {
      const idx = Number(state.index)
      if (Number.isFinite(idx)) {
        this.customProps.selectedIndex = Math.max(
          0,
          Math.min(Math.round(idx), this.customProps.items.length - 1)
        )
        this.updateFromProps()
      }
    }
  }

  updateFromProps() {
    const p     = this.customProps
    const items = p.items ?? []
    const idx   = Math.max(0, Math.min(p.selectedIndex, items.length - 1))
    p.selectedIndex = idx

    const displayText = items[idx] ? String(items[idx].value) : '—'

    const cw = p.elementWidth
    const h  = p.elementHeight
    const bw = this.btnW

    this.border.set({ width: cw, height: h, fill: p.bgColor })
    this.btnLeft.set({  height: h, left: -(cw / 2 + bw / 2) })
    this.btnRight.set({ height: h, left:   cw / 2 + bw / 2  })
    this.arrowLeft.set({  left: -(cw / 2 + bw / 2) })
    this.arrowRight.set({ left:   cw / 2 + bw / 2  })

    this.txt.set({
      text: displayText,
      fontSize: p.fontSize,
      fill: p.textColor,
      fontFamily: p.fontFamily || 'Arial, sans-serif',
      fontWeight: p.fontWeight || 'normal',
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

  private emitState() {
    const item = this.customProps.items[this.customProps.selectedIndex]
    this.canvas?.fire('element:output', { target: this, name: 'value', value: item?.value ?? 0 })
  }
}
