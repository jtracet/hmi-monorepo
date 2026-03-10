import { fabric } from 'fabric'
import { BaseElement, type ElementMeta } from './BaseElement'

export class GraphElement extends BaseElement<Record<string, never>> {

  static elementType = 'time-graph'
  static category = 'graph'
  static subcategory = 'indicators'

  static meta = {
    inputs: [],
    outputs: []
  } satisfies ElementMeta

  constructor(canvas: fabric.Canvas, x: number, y: number) {
    super(canvas, x, y, [])

    const rect = new fabric.Rect({
      width: 300,
      height: 200,
      fill: '#1e1e1e',
      stroke: '#888',
      strokeWidth: 1
    })

    const text = new fabric.Text('Graph', {
      fontSize: 16,
      fill: '#fff',
      originX: 'center',
      originY: 'center'
    })

    this.addWithUpdate(rect)

    text.left = rect.width! / 2
    text.top = rect.height! / 2

    this.addWithUpdate(text)

    this.canvas?.requestRenderAll()
  }
}