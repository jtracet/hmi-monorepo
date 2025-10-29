import { fabric } from 'fabric'
import { BaseElement, type ElementMeta } from './BaseElement'

interface NumInputProps {
    value:    number
    fontSize: number
}

export class NumberInput extends BaseElement<NumInputProps> {
    static elementType = 'numInput'
    static meta        = { inputs: [], outputs: ['value'] } satisfies ElementMeta

    private txt:    fabric.Text
    private _value: number

    constructor(
        canvas: fabric.Canvas,
        x: number,
        y: number,
        props: Partial<NumInputProps> = {},
    ) {
        const defaults: NumInputProps = { value: 0, fontSize: 24 }
        const p = { ...defaults, ...props }

        const text = new fabric.Text(String(p.value), {
            fontSize: p.fontSize,
            fill:     '#000',
            originX:  'left',
            originY:  'top',
        })

        super(canvas, x, y, [text], p)

        this.txt    = text
        this._value = p.value

        /* runtime-ввод числа */
        this.on('mouseup', () => {
            if (!this.isRuntime) return
            const res = prompt('Введите число', String(this._value))
            if (res == null) return
            const n = Number(res)
            if (!Number.isFinite(n)) return
            this._value = n
            this.updateFromProps()
            this.emitState()
        })
    }

    updateFromProps() {
        this.txt.set({
            text:     String(this._value),
            fontSize: this.customProps.fontSize,
        })
        this.canvas?.requestRenderAll()
    }

    /** экран → PLC */
    private emitState() {
        this.canvas?.fire('element:output', {
            target: this,
            name:   'value',
            value:  this._value,
        })
    }
}
