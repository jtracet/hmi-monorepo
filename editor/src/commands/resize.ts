import type {CommandDefinition} from './types'
import {commitCanvasChange, getActiveSelection, getBoundingRect, withCanvas} from './utils'
import type {fabric} from 'fabric'

type ResizeMode = 'width' | 'height' | 'both'
type RefStrategy = 'min' | 'max'

function measureDimension(obj: fabric.Object, mode: ResizeMode): number {
    const rect = getBoundingRect(obj)
    if (mode === 'width') return rect.width
    if (mode === 'height') return rect.height
    return rect.width * rect.height
}

function findReference(objects: fabric.Object[], mode: ResizeMode, strategy: RefStrategy): fabric.Object {
    return objects.reduce((best, obj) => {
        const bestVal = measureDimension(best, mode)
        const objVal = measureDimension(obj, mode)
        return strategy === 'min'
            ? (objVal < bestVal ? obj : best)
            : (objVal > bestVal ? obj : best)
    })
}

function applyDimensions(obj: fabric.Object, targetWidth: number | null, targetHeight: number | null) {
    const any = obj as any
    const props = any.customProps
    const objRect = getBoundingRect(obj)
    let usedProps = false

    if (props) {
        if (targetWidth != null && objRect.width > 0) {
            const scale = targetWidth / objRect.width
            if ('elementWidth' in props && typeof props.elementWidth === 'number') {
                props.elementWidth = Math.max(1, props.elementWidth * scale)
                usedProps = true
            } else if ('width' in props && typeof props.width === 'number') {
                props.width = Math.max(1, props.width * scale)
                usedProps = true
            } else if ('radius' in props && typeof props.radius === 'number') {
                props.radius = Math.max(1, props.radius * scale)
                usedProps = true
            }
        }
        if (targetHeight != null && objRect.height > 0) {
            const scale = targetHeight / objRect.height
            if ('elementHeight' in props && typeof props.elementHeight === 'number') {
                props.elementHeight = Math.max(1, props.elementHeight * scale)
                usedProps = true
            } else if ('height' in props && typeof props.height === 'number') {
                props.height = Math.max(1, props.height * scale)
                usedProps = true
            }
        }
    }

    if (usedProps && typeof any.updateFromProps === 'function') {
        any.updateFromProps()
        obj.setCoords()
        return
    }

    if (targetWidth != null && objRect.width > 0) {
        obj.scaleX = (obj.scaleX ?? 1) * (targetWidth / objRect.width)
    }
    if (targetHeight != null && objRect.height > 0) {
        obj.scaleY = (obj.scaleY ?? 1) * (targetHeight / objRect.height)
    }
    obj.setCoords()
}

function resize(mode: ResizeMode, strategy: RefStrategy) {
    return withCanvas(canvas => {
        const {objects} = getActiveSelection(canvas)
        if (objects.length < 2) return false

        const reference = findReference(objects, mode, strategy)
        const rect = getBoundingRect(reference)
        const targetWidth = rect.width
        const targetHeight = rect.height

        objects.forEach(obj => {
            if (obj === reference) return
            const w = (mode === 'width' || mode === 'both') ? targetWidth : null
            const h = (mode === 'height' || mode === 'both') ? targetHeight : null
            applyDimensions(obj, w, h)
        })

        commitCanvasChange(canvas)
        return true
    })
}

const enabled = () => withCanvas(canvas => getActiveSelection(canvas).objects.length >= 2)

export const resizeCommands: CommandDefinition[] = [
    {
        id: 'resize:match-width-min',
        section: 'resize',
        label: 'Smallest Width',
        run: () => resize('width', 'min'),
        isEnabled: enabled,
    },
    {
        id: 'resize:match-width-max',
        section: 'resize',
        label: 'Largest Width',
        run: () => resize('width', 'max'),
        isEnabled: enabled,
    },
    {
        id: 'resize:match-height-min',
        section: 'resize',
        label: 'Smallest Height',
        run: () => resize('height', 'min'),
        isEnabled: enabled,
    },
    {
        id: 'resize:match-height-max',
        section: 'resize',
        label: 'Largest Height',
        run: () => resize('height', 'max'),
        isEnabled: enabled,
    },
    {
        id: 'resize:match-both-min',
        section: 'resize',
        label: 'Smallest Size',
        run: () => resize('both', 'min'),
        isEnabled: enabled,
    },
    {
        id: 'resize:match-both-max',
        section: 'resize',
        label: 'Largest Size',
        run: () => resize('both', 'max'),
        isEnabled: enabled,
    },
]
