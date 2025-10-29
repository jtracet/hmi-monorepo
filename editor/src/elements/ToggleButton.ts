import {fabric} from 'fabric'
import {BaseElement, type ElementMeta} from './BaseElement'

interface BtnProps {
    label: string
}

export class ToggleButton extends BaseElement<BtnProps> {
    static elementType = 'toggle'
    static meta = {inputs: [], outputs: ['state']} satisfies ElementMeta

    private rect: fabric.Rect
    private txt: fabric.Text
    private _state = false

    constructor(canvas: fabric.Canvas, x: number, y: number) {
        const props = {label: 'Toggle'}
        const rect = new fabric.Rect({width: 90, height: 34, rx: 6, ry: 6, fill: '#3b82f6'})
        const text = new fabric.Text(props.label, {fontSize: 14, fill: '#fff', originX: 'center', originY: 'center'})
        text.top = rect.height! / 2
        text.left = rect.width! / 2
        super(canvas, x, y, [rect, text], props)
        this.rect = rect
        this.txt = text

        this.on('mouseup', () => {
            if (!this.isRuntime) return
            this._state = !this._state
            this.updateFromProps()
            this.emitState()
        })
    }

    updateFromProps() {
        this.txt.text = this.customProps.label
        const bg = this._state ? '#1C3760FF' : '#3b82f6'
        this.rect.set('fill', bg)
        this.canvas?.requestRenderAll()
    }

    private emitState() {
        this.canvas?.fire('element:output', {
            target: this,
            name: 'state',
            value: this._state,
        })
    }
}
