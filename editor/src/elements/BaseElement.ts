import {fabric} from 'fabric'
import {useEditorStore} from '../store/editor'

export interface ElementMeta {
    inputs: string[]
    outputs: string[]
}

interface SavedBindings {
    inputs: Record<string, string>
    outputs: Record<string, string>
}

export abstract class BaseElement<
    TProps = Record<string, any>
> extends fabric.Group {

    static elementType: string
    static meta: ElementMeta

    customProps!: TProps
    bindings: SavedBindings = {inputs: {}, outputs: {}}
    public id: any;

    constructor(
        canvas: fabric.Canvas,
        x: number, y: number,
        children: fabric.Object[],
        props: TProps
    ) {
        super(children, {left: x, top: y})
        this.id = this.id ?? crypto.randomUUID();
        this.customProps = props
        ;(this as any).elementType = (this.constructor as any).elementType
        ;(this as any).meta = (this.constructor as any).meta
        ;(this as any).bindings = this.bindings
        canvas.add(this)
    }

    setState(_: Record<string, any>): void {
    }

    protected get isRuntime() {
        return useEditorStore().isRuntime
    }
}
