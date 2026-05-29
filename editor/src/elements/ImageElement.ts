import {fabric} from 'fabric'
import {BaseElement, type ElementMeta} from './BaseElement'

export interface ImageProps {
    src: string
}

export class ImageElement extends BaseElement<ImageProps> {
    static elementType = 'image'
    static category = 'decorations'
    static meta = {inputs: [], outputs: []} satisfies ElementMeta

    constructor(
        canvas: fabric.Canvas,
        x: number,
        y: number,
        props: ImageProps
    ) {

        super(canvas, x, y, [], props, {showBindIndicator: false})

        fabric.Image.fromURL(
            props.src,
            (img) => {
                this.addWithUpdate(img)
                this.set({left: x, top: y} as any)
                this.setCoords()
                this.canvas?.requestRenderAll()
            },
            {crossOrigin: ''}
        )

        this.on('mousedblclick', this.enableScaling.bind(this))
    }

    private enableScaling() {
        this.set({
            hasControls: true,
            lockScalingX: false,
            lockScalingY: false,
            lockRotation: false,
        } as any)
        this.setControlsVisibility({
            tl: true, tr: true, bl: true, br: true,
            ml: false, mr: false, mt: false, mb: false,
            mtr: true,
        })
        this.canvas?.requestRenderAll()
    }
}
