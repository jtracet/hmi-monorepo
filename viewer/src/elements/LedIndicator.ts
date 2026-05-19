import { fabric } from 'fabric'
import { BaseElement } from './BaseElement'

interface LedProps {
    onColor: string
    offColor: string
    label: string
    labelFontSize: number
    fontFamily?: string
    fontWeight?: string
    radius: number
}

export class LedIndicator extends BaseElement<LedProps> {
    static elementType = 'led'
    static category = 'boolean'
    static subcategory = 'indicators'
    static meta = { inputs: ['value'], outputs: ['value'] } as const

    private circle: fabric.Circle
    private _state = false

    constructor(canvas: fabric.Canvas, x: number, y: number, props: Partial<LedProps> = {}) {
        const defaults: LedProps = {
            onColor: '#65d665',
            offColor: '#d1d5db',
            label: 'LED Indicator',
            labelFontSize: 14,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'normal',
            radius: 15,
        }
        const p = { ...defaults, ...props }

        const circle = new fabric.Circle({
            radius: p.radius,
            fill: p.offColor,
            strokeWidth: 1,
            originX: 'center',
            originY: 'center'
        })

        super(canvas, x, y, [circle], p)

        this.circle = circle

        this.hoverCursor = 'pointer'

        this.on('mouseup', () => {
            this._state = !this._state
            this.updateFromProps()
            this.emitState()
        })
    }

    updateFromProps() {
        const { onColor, offColor } = this.customProps

        this.circle.set({ radius: r, fill: this._state ? onColor : offColor })

        this.applyLabelLayout()

        this.canvas?.requestRenderAll()
    }

    setState({ value }: { value?: boolean }) {
        this._state = !!value
        this.updateFromProps()
    }

    private emitState() {
        this.canvas?.fire('element:output', {
            target: this,
            name: 'value',
            value: this._state
        })
    }
}
