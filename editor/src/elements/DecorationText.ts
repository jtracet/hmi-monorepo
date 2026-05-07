import { fabric } from 'fabric'
import { BaseElement, type ElementMeta } from './BaseElement'

interface DecorationTextProps {
  text: string
  fontSize: number
  fontFamily?: string
  fontWeight?: string
  textColor: string
  bgColor: string
  borderColor: string
  borderWidth: number
  borderRadius: number
  elementWidth: number
  elementHeight: number
  textAlign: string
}

export class DecorationText extends BaseElement<DecorationTextProps> {
  static elementType = 'decorationText'
  static category = 'decorations'
  static meta = { inputs: [], outputs: [] } satisfies ElementMeta

  private box: fabric.Rect
  private txt: fabric.Text

  constructor(
    canvas: fabric.Canvas,
    x: number,
    y: number,
    props: Partial<DecorationTextProps> = {}
  ) {
    const defaults: DecorationTextProps = {
      text: 'Text',
      fontSize: 16,
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'normal',
      textColor: '#111827',
      bgColor: 'transparent',
      borderColor: '#6b7280',
      borderWidth: 1,
      borderRadius: 4,
      elementWidth: 120,
      elementHeight: 40,
      textAlign: 'center',
    }

    const p: DecorationTextProps = { ...defaults, ...props }

    const box = new fabric.Rect({
      width: p.elementWidth,
      height: p.elementHeight,
      fill: p.bgColor,
      stroke: p.borderColor,
      strokeWidth: p.borderWidth,
      rx: p.borderRadius,
      ry: p.borderRadius,
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
    })

    const txt = new fabric.Text(p.text, {
      fontSize: p.fontSize,
      fill: p.textColor,
      fontFamily: p.fontFamily,
      fontWeight: p.fontWeight,
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      textAlign: p.textAlign as any,
      selectable: false,
      evented: false,
    })

    // Pass showBindIndicator: false — decorations don't need the binding dot
    super(canvas, x, y, [box, txt], p, { showBindIndicator: false })

    // The inherited label sits below the main rect. We don't need it here —
    // hide it visually and keep it at a neutral position so it never
    // contributes to bounding-box calculations.
    this.label.set({ text: ' ', fontSize: 1, opacity: 0, top: 0, left: 0 })

    this.box = box
    this.txt = txt
  }

  updateFromProps() {
    const p = this.customProps

    this.box.set({
      width: p.elementWidth,
      height: p.elementHeight,
      fill: p.bgColor,
      stroke: p.borderColor,
      strokeWidth: p.borderWidth,
      rx: p.borderRadius,
      ry: p.borderRadius,
    })

    this.txt.set({
      text: p.text,
      fontSize: p.fontSize,
      fill: p.textColor,
      fontFamily: p.fontFamily || 'Arial, sans-serif',
      fontWeight: p.fontWeight || 'normal',
      textAlign: p.textAlign as any,
    })

    // Keep label neutral — single space, size 1, at group center.
    // This way addWithUpdate() sees it as a 1px dot at (0,0) and
    // the bounding box is determined entirely by box + txt.
    this.label.set({ text: ' ', fontSize: 1, top: 0, left: 0 })

    this.addWithUpdate()
    this.setCoords()
    this.canvas?.requestRenderAll()
  }
}
