import { fabric } from 'fabric'
import { BaseElement, type ElementMeta } from './BaseElement'

interface NumDisplayProps {
    fontSize:  number
    precision: number
}

export class NumberDisplay extends BaseElement<NumDisplayProps> {
    static elementType = 'numDisplay'
    static meta        = { inputs: ['value'], outputs: [] } satisfies ElementMeta

    private txt: fabric.Text

    constructor(
        canvas:  fabric.Canvas,
        x: number,
        y: number,
        props: Partial<NumDisplayProps> = {},
    ) {
        const defaults: NumDisplayProps = { fontSize: 24, precision: 2 }
        const p = { ...defaults, ...props }

        const text = new fabric.Text('--', {
            fontSize: p.fontSize,
            fill:     '#000',
            originX:  'left',
            originY:  'top',
        })

        super(canvas, x, y, [text], p)
        this.txt = text
    }

    updateFromProps() {
        this.txt.set({ fontSize: this.customProps.fontSize })
        this.canvas?.requestRenderAll()
    }

    /** PLC → экран */
    setState({ value }: { value?: number }) {
        if (value == null) return
        this.txt.set({
            text: Number(value).toFixed(this.customProps.precision),
        })
        this.canvas?.requestRenderAll()
    }
}
