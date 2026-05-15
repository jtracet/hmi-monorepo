import { fabric } from 'fabric'

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
    private _bindings: SavedBindings = { inputs: {}, outputs: {} }
    public id: any
    public label!: fabric.Text

    protected bindIndicator!: fabric.Circle | null

    constructor(
        canvas: fabric.Canvas,
        x: number,
        y: number,
        children: fabric.Object[] = [],
        props: TProps
    ) {
        const bindIndicator = new fabric.Circle({
            radius: 6,
            fill: '#019610',
            stroke: '#ffffff',
            strokeWidth: 1,
            originX: 'right',
            originY: 'center',
            left: (children[0]?.width ?? 60) / 2,
            top: -(children[0]?.height ?? 30) / 2,
            selectable: false,
            evented: false,
            visible: false,
            shadow: new fabric.Shadow({
                color: 'rgba(0,0,0,0.3)',
                blur: 3,
                offsetX: 1,
                offsetY: 1
            })
        })

        // label is NOT part of the group — added to canvas separately
        // so it never interferes with the group's bounding box or rendering
        const allChildren = [...children, bindIndicator]

        super(allChildren, {
            left: x,
            top: y,
            selectable: false,
            hasControls: false,
            hasBorders: false,
            lockMovementX: true,
            lockMovementY: true,
            evented: true
        })

        this.id = this.id ?? crypto.randomUUID()
        this.customProps = props
        this.bindIndicator = bindIndicator

        ;(this as any).elementType = (this.constructor as any).elementType
        ;(this as any).meta        = (this.constructor as any).meta

        this.hoverCursor = 'default'
        this.lockScalingX = true
        this.lockScalingY = true
        this.lockRotation = true
        this.setControlsVisibility({
            tl: false, tr: false, bl: false, br: false,
            ml: false, mr: false, mt: false, mb: false,
            mtr: false
        })

        // Create external label — starts invisible, shown by applyLabelLayout()
        const label = new fabric.Text(' ', {
            fontSize: 14,
            fill: '#000',
            originX: 'center',
            originY: 'top',
            left: x,
            top: y + (children[0]?.height ?? 0) / 2 + 5,
            selectable: false,
            evented: false,
            textAlign: 'center',
            opacity: 0,
        })
        this.label = label

        canvas.add(this)
        canvas.add(label)

        // Remove label when group is removed
        this.on('removed', () => {
            if (this.label?.canvas) this.label.canvas.remove(this.label)
        })

        setTimeout(() => {
            this.updateIndicatorPosition()
            this.checkBindings()
            this._syncLabelPosition()
        }, 0)
    }

    // Sync label position to sit below (or above) the group
    private _syncLabelPosition() {
        if (!this.label) return
        const p       = this.customProps as any
        const visible = p.labelVisible !== false
        const pos     = p.labelPosition ?? 'bottom'
        const center  = this.getCenterPoint()
        const halfH   = (this.height ?? 0) / 2
        const gap     = 4

        if (!visible) {
            this.label.set({ opacity: 0 })
            this.label.setCoords()
            return
        }

        if (pos === 'top') {
            this.label.set({
                opacity: 1,
                originY: 'bottom',
                left: center.x,
                top:  center.y - halfH - gap,
            })
        } else {
            this.label.set({
                opacity: 1,
                originY: 'top',
                left: center.x,
                top:  center.y + halfH + gap,
            })
        }
        this.label.setCoords()
        this.canvas?.requestRenderAll()
    }

    // Called by elements in their updateFromProps to update label text/style/position
    applyLabelLayout() {
        const p = this.customProps as any
        this.label.set({
            fontSize:   p.labelFontSize ?? 14,
            fill:       '#000',
            fontFamily: p.fontFamily   ?? 'Arial, sans-serif',
            fontWeight: p.fontWeight   ?? 'normal',
            text:       p.label        ?? '',
        })
        this._syncLabelPosition()
    }

    get bindings(): SavedBindings { return this._bindings }
    set bindings(value: SavedBindings) {
        this._bindings = { inputs: { ...value.inputs }, outputs: { ...value.outputs } }
        this.checkBindings()
        this.canvas?.requestRenderAll()
    }

    protected checkBindings() {
        if (!this.bindIndicator) return
        const hasAny =
            Object.values(this._bindings.inputs ).some(v => v?.trim()) ||
            Object.values(this._bindings.outputs).some(v => v?.trim())
        this.bindIndicator.set('visible', hasAny)
        this.canvas?.requestRenderAll()
    }

    setState(_: Record<string, any>): void {}

    protected get isRuntime(): boolean { return true }

    protected updateIndicatorPosition() {
        if (!this.bindIndicator) return
        const mainChild = this.getObjects().find(obj => obj !== this.bindIndicator)
        if (mainChild) {
            const width  = mainChild.getScaledWidth  ? mainChild.getScaledWidth()  : (mainChild.width  || 60)
            const height = mainChild.getScaledHeight ? mainChild.getScaledHeight() : (mainChild.height || 30)
            this.bindIndicator.set({ left: width / 2, top: -height / 2 })
            this.bindIndicator.setCoords()
        }
    }

    setDimensions(_width: number, _height: number): void {
        this.updateIndicatorPosition()
    }
}
