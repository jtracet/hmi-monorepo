import { fabric } from 'fabric'
import { BaseElement } from './BaseElement'

interface NumInputProps {
  value: number
  fontSize: number
  label: string
  labelFontSize: number
}

export class NumberInput extends BaseElement<NumInputProps> {
  static elementType = 'numInput'
  static category = 'controls'
  static meta = { inputs: [], outputs: ['value'] } as const

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
      label: 'Number Input',
      labelFontSize: 14
    }
    const p = { ...defaults, ...props }

    const width = 120
    const height = 40

    const border = new fabric.Rect({
      width,
      height,
      fill: 'transparent',
      stroke: '#ccc',
      strokeWidth: 1,
      rx: 4,
      ry: 4,
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0
    })

    const text = new fabric.Text(String(p.value), {
      fontSize: p.fontSize,
      fill: '#000',
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      textAlign: 'center'
    })

    super(canvas, x, y, [border, text], p)

    this.label.set({
      text: p.label,
      fontSize: p.labelFontSize,
      originX: 'center',
      originY: 'top',
      top: height / 2.2,
      left: 0
    })

    this.txt = text
    this.border = border

    this.on('mouseup', () => {
      const res = prompt('Введите число', String(this.customProps.value))
      if (res == null) return

      const n = Number(res)
      if (!Number.isFinite(n)) return

      this.customProps.value = n
      this.updateFromProps()
      this.emitState()
    })
  }

  updateFromProps() {
    const displayValue = String(this.customProps.value)

    this.txt.set({
      text: displayValue,
      fontSize: this.customProps.fontSize
    })

    this.label.set({
      text: this.customProps.label,
      fontSize: this.customProps.labelFontSize
    })

    this.canvas?.requestRenderAll()
  }

  private emitState() {
    this.canvas?.fire('element:output', {
      target: this,
      name: 'value',
      value: this.customProps.value
    })
  }
}