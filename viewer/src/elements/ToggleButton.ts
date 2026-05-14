import { fabric } from 'fabric'
import { BaseElement } from './BaseElement'

interface ToggleProps {
    label: string
    labelFontSize: number
    fontFamily?: string
    fontWeight?: string
    elementWidth?: number
}

export class ToggleButton extends BaseElement<ToggleProps> {
    static elementType = 'toggle'
    static category = 'boolean'
    static subcategory = 'controls'
    static meta = { inputs: [], outputs: ['state'] } as const

    private background: fabric.Rect
    private slider: fabric.Rect
    private _state = false
    private lastClickTime = 0

    constructor(canvas: fabric.Canvas, x: number, y: number, propsInit: Partial<ToggleProps> = {}) {
        const defaults: ToggleProps = {
            label: 'Slide Switch',
            labelFontSize: 14,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'normal',
            elementWidth: 60,
        }
        const props = { ...defaults, ...propsInit }

        const bgW = props.elementWidth ?? 60
        const bgH = Math.round(bgW * 0.5)
        const slSize = Math.round(bgH * 0.87)

        const background = new fabric.Rect({
            width: bgW,
            height: bgH,
            rx: bgH / 2,
            ry: bgH / 2,
            fill: '#d1d5db',
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false
        })

        const slider = new fabric.Rect({
            width: slSize,
            height: slSize,
            rx: slSize / 2,
            ry: slSize / 2,
            fill: '#fff',
            left: -Math.round(bgW * 0.2),
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false
        })

        super(canvas, x, y, [background, slider], props)

        this.background = background
        this.slider = slider

        this.hoverCursor = 'pointer'

        this.label.set({
            text: props.label,
            fontSize: props.labelFontSize,
            fontFamily: props.fontFamily,
            fontWeight: props.fontWeight,
            top: bgH / 2.2,
        })

        this.on('mouseup', () => {
            const now = Date.now()
            if (now - this.lastClickTime < 250) {
                return
            }
            this.lastClickTime = now
            this.toggleState()
        })

        this.updateVisuals()
    }

    public toggleState() {
        this._state = !this._state
        this.updateVisuals()
        this.emitState()
    }

    public getState(): boolean {
        return this._state
    }

    private updateVisuals() {
        const bgW = this.customProps.elementWidth ?? 60
        const bgH = Math.round(bgW * 0.5)
        const slSize = Math.round(bgH * 0.87)
        const travel = Math.round(bgW * 0.2)
        const targetX = this._state ? travel : -travel
        const bgColor = this._state ? '#3b82f6' : '#d1d5db'

        this.background.set({
            width: bgW,
            height: bgH,
            rx: bgH / 2,
            ry: bgH / 2,
            fill: bgColor,
            dirty: true,
        })
        this.slider.set({
            width: slSize,
            height: slSize,
            rx: slSize / 2,
            ry: slSize / 2,
        })

        this.label.set({
            text: this.customProps.label,
            fontSize: this.customProps.labelFontSize,
            fontFamily: this.customProps.fontFamily || 'Arial, sans-serif',
            fontWeight: this.customProps.fontWeight || 'normal',
            top: bgH / 2.2,
        })

        this.slider.animate('left', targetX, {
            duration: 150,
            onChange: () => this.canvas?.requestRenderAll(),
        })

        this.canvas?.requestRenderAll()
    }

    private emitState() {
        this.canvas?.fire('element:output', {
            target: this,
            name: 'state',
            value: this._state
        })
    }

    updateFromProps() {
        this.updateVisuals()
    }
}