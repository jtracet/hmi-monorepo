import { fabric } from 'fabric'
import { BaseElement, type ElementMeta } from './BaseElement'

interface LineProps {
    stroke: string
    strokeWidth: number
}

export class LineElement extends BaseElement<LineProps> {
    static elementType = 'Line'
    static category = 'decorations'
    static meta = { inputs: [], outputs: [] } satisfies ElementMeta

    private line: fabric.Line

    constructor(canvas: fabric.Canvas, x: number, y: number, props?: Partial<LineProps>) {
        const defaults: LineProps = { stroke: '#000000', strokeWidth: 2 }
        const p = { ...defaults, ...props }
        const l = new fabric.Line([0, 0, 120, 0], {
            stroke: p.stroke,
            strokeWidth: p.strokeWidth,
            strokeLineCap: 'round'
        })
        super(canvas, x, y, [l], p)
        
        this.label.set({
            text: '',
            visible: false
        })
        
        this.line = l
        
        this.setupLineControls()
        
        this.on('mousedblclick', this.handleDoubleClick.bind(this))
        this.on('deselected', this.handleDeselected.bind(this))
    }


    private setupLineControls() {
        this.set({
            hasRotatingPoint: true,
            lockRotation: false
        })

        this.setControlsVisibility({
            tl: false, // верхний левый
            tr: false, // верхний правый  
            bl: false, // нижний левый
            br: false, // нижний правый
            ml: true,  // средний левый - РАБОТАЕТ
            mr: true,  // средний правый - РАБОТАЕТ
            mt: false, // верхний средний
            mb: false, // нижний средний
            mtr: true  // контрол вращения - РАБОТАЕТ
        })

        this.lockScalingY = true
        
        this.lockScalingX = false
    }

    private handleDoubleClick() {
        this.set({
            hasControls: true,
            lockScalingX: false,
            lockScalingY: true,
            lockRotation: false
        })
        this.setupLineControls() 
        this.canvas?.requestRenderAll()
    }

    private handleDeselected() {
        this.set({
            hasControls: false
        })
        this.canvas?.requestRenderAll()
    }

    updateFromProps() {
        this.line.set({
            stroke: this.customProps.stroke,
            strokeWidth: this.customProps.strokeWidth
        })
        this.canvas?.requestRenderAll()
    }
}