import { fabric } from 'fabric'
import { BaseElement } from './BaseElement'

interface TankProps {
  minValue: number
  maxValue: number
  value: number
  fillColor: string
  emptyColor: string
  borderColor: string
  showValue: boolean
  valueFontSize: number
  label: string
  labelFontSize: number
  fontFamily?: string
  fontWeight?: string
  elementWidth: number
  elementHeight: number
}

export class Tank extends BaseElement<TankProps> {
  static elementType = 'tank'
  static category = 'numeric'
  static subcategory = 'indicators'
  static meta = { inputs: ['value'] as string[], outputs: [] as string[] } as const

  private container: fabric.Rect
  private fillRect: fabric.Rect
  private valueText: fabric.Text
  private currentValue: number = 0
  private _padding = 6

  constructor(
    canvas: fabric.Canvas,
    x: number,
    y: number,
    props: Partial<TankProps> = {}
  ) {
    const defaults: TankProps = {
      minValue: 0,
      maxValue: 100,
      value: 0,
      fillColor: '#4caf50',
      emptyColor: '#f5f5f5',
      borderColor: '#333',
      showValue: true,
      valueFontSize: 12,
      label: 'Tank',
      labelFontSize: 14,
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'normal',
      elementWidth: 80,
      elementHeight: 150,
    }

    const p = { ...defaults, ...props }
    const W = p.elementWidth
    const H = p.elementHeight
    const padding = 6

    const container = new fabric.Rect({
      width: W, height: H,
      fill: p.emptyColor, stroke: p.borderColor,
      strokeWidth: 2, rx: 4, ry: 4,
      originX: 'center', originY: 'center',
      left: 0, top: 0
    })

    const fillRect = new fabric.Rect({
      width: W - padding * 2, height: 0,
      fill: p.fillColor,
      originX: 'center', originY: 'bottom',
      left: 0, top: H / 2 - padding,
      rx: 2, ry: 2
    })

    const valueText = new fabric.Text('0', {
      fontSize: p.valueFontSize, fill: '#000',
      originX: 'center', originY: 'center',
      left: 0, top: -H / 2 + 15,
      fontWeight: p.fontWeight ?? 'normal',
      fontFamily: p.fontFamily ?? 'Arial, sans-serif'
    })

    super(canvas, x, y, [container, fillRect, valueText], p)

    this.container = container
    this.fillRect = fillRect
    this.valueText = valueText
    this._padding = padding

    this.label.set({
      text: p.label, fontSize: p.labelFontSize,
      originX: 'center', originY: 'top',
      top: H / 2, left: 0
    })

    this.setValue(p.value)
  }

  private getH(): number {
    return this.customProps.elementHeight ?? 150
  }

  private getW(): number {
    return this.customProps.elementWidth ?? 80
  }

  private setValue(value: number) {
    const minValue = Number(this.customProps.minValue) || 0
    const maxValue = Number(this.customProps.maxValue) || 100
    const H = this.getH()

    this.currentValue = Math.max(minValue, Math.min(maxValue, value))
    const percent = (this.currentValue - minValue) / (maxValue - minValue || 1)
    const fillHeight = (H - this._padding * 2) * percent

    this.fillRect.set({ height: fillHeight })
    this.valueText.set({
      text: this.customProps.showValue ? this.currentValue.toFixed(1) : ''
    })
    this.canvas?.requestRenderAll()
  }

  updateFromProps() {
    const p = this.customProps
    const W = this.getW()
    const H = this.getH()

    this.container.set({ width: W, height: H, fill: p.emptyColor, stroke: p.borderColor })
    this.fillRect.set({
      width: W - this._padding * 2,
      fill: p.fillColor,
      top: H / 2 - this._padding
    })
    this.valueText.set({
      fontSize: p.valueFontSize,
      top: -H / 2 + 15,
      fontFamily: p.fontFamily ?? 'Arial, sans-serif',
      fontWeight: p.fontWeight ?? 'normal'
    })
    this.label.set({
      text: p.label, fontSize: p.labelFontSize,
      top: H / 2 + 4,
      fontFamily: p.fontFamily ?? 'Arial, sans-serif',
      fontWeight: p.fontWeight ?? 'normal'
    })

    this.addWithUpdate()
    this.setCoords()
    this.updateIndicatorPosition()
    this.setValue(Number(p.value) || 0)
  }

  setState({ value }: { value?: number }) {
    if (value != null && Number.isFinite(value)) {
      this.setValue(value)
    }
  }
}
