import { fabric } from 'fabric'
import { useEditorStore } from '../store/editor'

export interface ElementMeta {
    inputs: string[]
    outputs: string[]
}

interface SavedBindings {
    inputs: Record<string, string>
    outputs: Record<string, string>
}

export abstract class BaseElement<TProps = Record<string, any>> extends fabric.Group {
    static elementType: string
    static category: string

    static meta: ElementMeta

    customProps!: TProps
    bindings: SavedBindings = { inputs: {}, outputs: {} }
    public id: any
    public label!: fabric.Text  

    constructor(
        canvas: fabric.Canvas,
        x: number,
        y: number,
        children: fabric.Object[] = [],
        props: TProps
    ) {
        const label = new fabric.Text('name', {
            fontSize: 14,
            fill: '#000',
            originX: 'center',
            originY: 'top',
            left: 0,
            top: (children[0]?.height ?? 0) / 2 + 5 
        })

        const allChildren = [...children, label]

        super(allChildren, { left: x, top: y })

        this.id = this.id ?? crypto.randomUUID()
        this.customProps = props
        this.label = label

        ;(this as any).elementType = (this.constructor as any).elementType
        ;(this as any).meta = (this.constructor as any).meta
        ;(this as any).bindings = this.bindings

        this.hoverCursor = 'pointer'
        this.setControlsVisibility({
            tl: true, tr: true, bl: true, br: true,
            ml: false, mr: false, mt: false, mb: false,
            mtr: false
        })
        this.lockScalingX = true
        this.lockScalingY = true
        this.lockRotation = true
        this.set({ hasControls: false, selectable: true })

        this.on('mousedblclick', () => {
            this.set({
                hasControls: true,
                lockScalingX: false,
                lockScalingY: false,
                lockRotation: false
            })
            this.canvas?.requestRenderAll()
        })

        this.on('deselected', () => {
            this.set({
                hasControls: false,
                lockScalingX: true,
                lockScalingY: true,
                lockRotation: true
            })
            this.canvas?.requestRenderAll()
        })

        canvas.add(this)
    }

    setState(_: Record<string, any>): void {}

    protected get isRuntime() {
        return useEditorStore().isRuntime
    }
}
