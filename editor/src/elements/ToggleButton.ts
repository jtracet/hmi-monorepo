import { fabric } from 'fabric'
import { BaseElement } from './BaseElement'

interface ToggleProps {
    label: string
    labelFontSize: number
    labelPosition?: string
    labelVisible?: boolean
    fontFamily?: string
    fontWeight?: string
    elementWidth: number
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

    constructor(canvas: fabric.Canvas, x: number, y: number) {
        const props: ToggleProps = {
            label: 'Slide Switch',
            labelFontSize: 14,
            labelPosition: 'bottom',
            labelVisible: true,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'normal',
            elementWidth: 60,
        }

        const bgW = props.elementWidth
        const bgH = Math.round(bgW * 0.5)
        const slSize = Math.round(bgH * 0.87)

        const background = new fabric.Rect({
            width: bgW, height: bgH,
            rx: bgH / 2, ry: bgH / 2,
            fill: '#d1d5db',
            originX: 'center', originY: 'center',
            selectable: false, evented: true
        })

        const slider = new fabric.Rect({
            width: slSize, height: slSize,
            rx: slSize / 2, ry: slSize / 2,
            fill: '#fff',
            left: -Math.round(bgW * 0.2),
            originX: 'center', originY: 'center',
            selectable: false, evented: true
        })

        super(canvas, x, y, [background, slider], props)

        this.forEachObject(obj => {
            obj.set('evented', true)
            obj.set('selectable', false)
            obj.set('hoverCursor', 'pointer')
        })

        this.background = background
        this.slider = slider

        this.label.set({
            text: props.label,
            fontSize: props.labelFontSize,
            originX: 'center', left: 0,
            fontFamily: props.fontFamily,
            fontWeight: props.fontWeight
        })

        this.on('mouseup', (e) => {
            if (!this.isRuntime) return
            e.e.preventDefault()
            e.e.stopPropagation()
            const now = Date.now()
            if (now - this.lastClickTime < 250) return
            this.lastClickTime = now
            this.toggleState()
        })

        this.updateVisuals()
    }

    public toggleState() {
        this._state = !this._state
        this.animateSlider()
        this.emitState()
    }

    public getState(): boolean {
        return this._state
    }

    private animateSlider() {
        const bgW = this.customProps.elementWidth ?? 60
        const bgH = Math.round(bgW * 0.5)
        const travel = Math.round(bgW * 0.2)
        const targetX = this._state ? travel : -travel
        const bgColor = this._state ? '#3b82f6' : '#d1d5db'
        this.background.set({ fill: bgColor, dirty: true })
        this.slider.animate('left', targetX, {
            duration: 150,
            onChange: () => this.canvas?.requestRenderAll(),
        })
        this.canvas?.requestRenderAll()
    }

    private updateVisuals() {
        const bgW = this.customProps.elementWidth ?? 60
        const bgH = Math.round(bgW * 0.5)
        const slSize = Math.round(bgH * 0.87)
        const travel = Math.round(bgW * 0.2)
        const targetX = this._state ? travel : -travel
        const bgColor = this._state ? '#3b82f6' : '#d1d5db'

        this.background.set({ width: bgW, height: bgH, rx: bgH / 2, ry: bgH / 2, fill: bgColor, dirty: true })
        this.slider.set({ width: slSize, height: slSize, rx: slSize / 2, ry: slSize / 2 })
        this.label.set({
            text: this.customProps.label,
            fontSize: this.customProps.labelFontSize,
            left: 0,
            fontFamily: this.customProps.fontFamily || 'Arial, sans-serif',
            fontWeight: this.customProps.fontWeight || 'normal'
        })

        this.slider.animate('left', targetX, {
            duration: 150,
            onChange: () => this.canvas?.requestRenderAll(),
        })

        this.addWithUpdate()
        this.applyLabelLayout(bgH / 2)
        this.setCoords()
        this.canvas?.requestRenderAll()
    }

    private emitState() {
        this.canvas?.fire('element:output', { target: this, name: 'state', value: this._state })
    }

    updateFromProps() {
        this.updateVisuals()
    }
}
