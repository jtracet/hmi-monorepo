import {fabric} from 'fabric'
import {BaseElement, type ElementMeta} from './BaseElement'

interface LedProps {
    onColor: string;
    offColor: string
}

export class LedIndicator extends BaseElement<LedProps> {
    static elementType = 'led'
    static meta = {inputs: ['value'], outputs: ['value']} satisfies ElementMeta

    private circle: fabric.Circle
    private _state = false

    constructor(canvas: fabric.Canvas, x: number, y: number) {
        const props = {onColor: '#65d665', offColor: '#2e2e2e'}
        const c = new fabric.Circle({radius: 15, fill: props.offColor, stroke: '#111', strokeWidth: 2})
        super(canvas, x, y, [c], props)
        this.circle = c

        this.on('mouseup', () => {
            if (!this.isRuntime) return
            this._state = !this._state
            this.updateFromProps()
            this.emitState()
        })
    }

    updateFromProps() {
        const {onColor, offColor} = this.customProps
        const fill = this._state ? onColor : offColor
        this.circle.set('fill', fill)
        this.canvas?.requestRenderAll()
    }

    setState({value}: { value?: boolean }) {
        this._state = !!value
        this.updateFromProps()
    }

    private emitState() {
        this.canvas?.fire('element:output', {
            target: this,
            name: 'value',
            value: this._state,
        })
    }
}
