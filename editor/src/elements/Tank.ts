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
  labelPosition?: string
  labelVisible?: boolean
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
      emptyColor: '#d1d5db',
      borderColor: '#333',
      showValue: true,
      valueFontSize: 12,
      label: 'Numeric Indicator Tank',
      labelFontSize: 14,
      labelPosition: 'bottom',
      labelVisible: true,
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

    // fillRect uses originY:'center' so its bounding box stays symmetric
    // and never expands the group upward when the fill grows.
    // We position it so its bottom edge aligns with the container bottom.
    // bottom of container = H/2 - padding
    // center of fillRect  = H/2 - padding - fillHeight/2
    // We start with height=0, center at H/2 - padding (bottom edge).
    const fillRect = new fabric.Rect({
      width: W - padding * 2, height: 0,
      fill: p.fillColor,
      originX: 'center', originY: 'center',
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

    this.setValue(p.value)
  }

  private getH(): number { return this.customProps.elementHeight ?? 150 }
  private getW(): number { return this.customProps.elementWidth ?? 80 }

  private setValue(value: number) {
    const minValue = Number(this.customProps.minValue) || 0
    const maxValue = Number(this.customProps.maxValue) || 100
    const H = this.getH()
    const padding = this._padding

    this.currentValue = Math.max(minValue, Math.min(maxValue, value))
    const percent = (this.currentValue - minValue) / (maxValue - minValue || 1)
    const fillHeight = (H - padding * 2) * percent

    // Keep fillRect bottom edge at H/2 - padding, grow upward.
    // center = bottomEdge - fillHeight/2
    const bottomEdge = H / 2 - padding
    this.fillRect.set({
      height: fillHeight,
      top: fillHeight > 0 ? bottomEdge - fillHeight / 2 : bottomEdge,
    })
    this.valueText.set({ text: this.customProps.showValue ? this.currentValue.toFixed(1) : '' })
    this.canvas?.requestRenderAll()
  }

  updateFromProps() {
    const p = this.customProps
    const W = this.getW()
    const H = this.getH()
    const padding = this._padding

    this.container.set({ width: W, height: H, fill: p.emptyColor, stroke: p.borderColor })
    this.fillRect.set({
      width: W - padding * 2,
      fill: p.fillColor,
    })
    this.valueText.set({
      fontSize: p.valueFontSize,
      top: -H / 2 + 15,
      fontFamily: p.fontFamily ?? 'Arial, sans-serif',
      fontWeight: p.fontWeight ?? 'normal'
    })

    // Set the fill to its final position BEFORE addWithUpdate so the
    // bounding box is computed from the correct final state.
    this.setValue(Number(p.value) || 0)

    this.stableAddWithUpdate()
    // Force correct dimensions — addWithUpdate may compute slightly different
    // values due to strokeWidth or asymmetric children.
    this.width  = W
    this.height = H
    this.applyLabelLayout()
    this.updateIndicatorPosition()
    this.canvas?.requestRenderAll()
  }

  setState({ value }: { value?: number }) {
    if (value != null && Number.isFinite(value)) this.setValue(value)
  }
}

