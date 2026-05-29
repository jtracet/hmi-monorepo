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
    bindingsData: SavedBindings = { inputs: {}, outputs: {} }
    private _bindings: SavedBindings = { inputs: {}, outputs: {} }
    public id: any

    // label lives OUTSIDE the group — never affects addWithUpdate()
    public label!: fabric.Text

    private _labelGap = 4

    protected bindIndicator!: fabric.Circle | null
    protected showBindIndicator: boolean = true

    constructor(
        canvas: fabric.Canvas,
        x: number,
        y: number,
        children: fabric.Object[] = [],
        props: TProps,
        options?: { showBindIndicator?: boolean }
    ) {
        let bindIndicator: fabric.Circle | null = null
        const showIndicator = options?.showBindIndicator !== false

        if (showIndicator) {
            bindIndicator = new fabric.Circle({
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
        }

        const allChildren = [...children]
        if (bindIndicator) allChildren.push(bindIndicator)

        super(allChildren, { left: x, top: y })

        this.id = this.id ?? crypto.randomUUID()
        this.customProps = props
        this.bindIndicator = bindIndicator
        this.showBindIndicator = showIndicator

        ;(this as any).elementType = (this.constructor as any).elementType
        ;(this as any).meta        = (this.constructor as any).meta

        this.hoverCursor = 'pointer'
        this.setControlsVisibility({
            tl: false, tr: false, bl: false, br: false,
            ml: false, mr: false, mt: false, mb: false,
            mtr: false
        })
        this.lockScalingX = true
        this.lockScalingY = true
        this.lockRotation = true
        this.set({ hasControls: false, selectable: true } as any)

        // External label — positioned relative to group center, not inside group
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
            // Exclude from any selection bounding box calculations
            excludeFromExport: false,
        })
        ;(label as any).isElementLabel = true
        this.label = label

        canvas.add(this)
        canvas.add(label)

        // Keep label in sync when the group moves/scales
        this.on('moving',   () => this._syncLabelPosition())
        this.on('modified', () => this._syncLabelPosition())
        this.on('scaling',  () => this._syncLabelPosition())

        this.on('deselected', () => {
            this.set({ hasControls: false, lockScalingX: true, lockScalingY: true, lockRotation: true } as any)
            this.canvas?.requestRenderAll()
        })

        // Remove external label when group is removed from canvas
        this.on('removed', () => {
            if (this.label?.canvas) this.label.canvas.remove(this.label)
        })

        if (this.bindIndicator) {
            setTimeout(() => {
                this.updateIndicatorPosition()
                this.checkBindings()
            }, 0)
        }

        // Initial label sync after canvas has laid out the element
        setTimeout(() => this._syncLabelPosition(), 0)
    }

    // ── label sync ────────────────────────────────────────────────────────
    syncLabel() {
        this._syncLabelPosition()
    }

    private _syncLabelPosition() {
        if (!this.label) return
        const p       = this.customProps as any
        const visible = p.labelVisible !== false
        const pos     = p.labelPosition ?? 'bottom'
        const gap     = this._labelGap

        if (!visible) {
            this.label.set({ opacity: 0 })
            this.label.setCoords()
            return
        }

        const m = this.calcTransformMatrix()
        const { scaleY } = fabric.util.qrDecompose(m)
        const centerX = m[4]
        const centerY = m[5]
        const halfH   = ((this.height ?? 0) * Math.abs(scaleY)) / 2

        if (pos === 'top') {
            this.label.set({
                opacity: 1,
                originY: 'bottom',
                left: centerX,
                top:  centerY - halfH - gap,
            })
        } else {
            this.label.set({
                opacity: 1,
                originY: 'top',
                left: centerX,
                top:  centerY + halfH + gap,
            })
        }
        this.label.setCoords()
    }

    /**
     * Call AFTER addWithUpdate() in every updateFromProps().
     * Updates label text/style and repositions it.
     * gap — pixels between group edge and label (default 4)
     */
    applyLabelLayout(gap = 4) {
        this._labelGap = gap

        const p = this.customProps as any
        this.label.set({
            fontSize:   p.labelFontSize ?? 14,
            fill:       '#000',
            fontFamily: p.fontFamily   ?? 'Arial, sans-serif',
            fontWeight: p.fontWeight   ?? 'normal',
            text:       p.label        ?? '',
        })

        this._syncLabelPosition()
        this.canvas?.requestRenderAll()
    }

    // Wrapper around addWithUpdate() that preserves the group's geometry
    // so the selection box never drifts when children change.
    // Only call this when element SIZE actually changes (width/height/radius).
    // For color/text/label changes use applyLabelLayout() directly.
    protected stableAddWithUpdate() {
        const left = this.left ?? 0
        const top  = this.top  ?? 0
        this.addWithUpdate()
        // Restore position — addWithUpdate may shift left/top when bounding
        // box changes due to asymmetric children (e.g. fillRect in Tank).
        this.left = left
        this.top  = top
        this.setCoords()
    }
    // ── bindings ──────────────────────────────────────────────────────────
    setBindings(bindings: SavedBindings) {
        this._bindings = { inputs: { ...bindings.inputs }, outputs: { ...bindings.outputs } }
        this.bindingsData = this._bindings
        this.checkBindings()
        this.canvas?.requestRenderAll()
    }

    getBindings(): SavedBindings { return this._bindings }
    get bindings(): SavedBindings { return this._bindings }
    set bindings(value: SavedBindings) { this.setBindings(value) }

    protected checkBindings() {
        if (!this.bindIndicator || !this.showBindIndicator) return
        const hasAny =
            Object.values(this._bindings.inputs ).some(v => v?.trim()) ||
            Object.values(this._bindings.outputs).some(v => v?.trim())
        this.bindIndicator.set('visible', hasAny)
        this.canvas?.requestRenderAll()
    }

    setState(_: Record<string, any>): void {}

    protected get isRuntime() { return useEditorStore().isRuntime }

    protected updateIndicatorPosition() {
        if (!this.bindIndicator || !this.showBindIndicator) return
        const w = this.getScaledWidth  ? this.getScaledWidth()  : (this.width  || 60)
        const h = this.getScaledHeight ? this.getScaledHeight() : (this.height || 30)
        this.bindIndicator.set({ left: w / 2, top: -h / 2 })
        this.bindIndicator.setCoords()
    }

    setDimensions(_width: number, _height: number): void { this.updateIndicatorPosition() }

    toObject(propertiesToInclude: string[] = []): any {
        return super.toObject([...propertiesToInclude, 'bindingsData', 'elementType', 'meta', 'customProps'])
    }

    fromObject(object: any, callback?: Function) {
        if (object.bindingsData) this.setBindings(object.bindingsData)
        if (callback) callback()
    }

    onRender() {
        if (this.bindIndicator) {
            this.updateIndicatorPosition()
            this.checkBindings()
        }
    }
}
