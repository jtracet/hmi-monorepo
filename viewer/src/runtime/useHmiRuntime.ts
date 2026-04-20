import {ref, watch} from 'vue'
import {fabric} from 'fabric'
import {resolveStorePath, buildInputPayload} from './helpers'
import {ElementRegistry} from '@/elements'
import {useSessionStore} from '@/store/session'

export interface HmiFile {
    meta: { version: string; created: string }
    canvas: any
    bindings?: BindingMap[]
}

interface BindingMap {
    elementId: string
    inputBindings: Record<string, string>
    outputBindings?: Record<string, string>
}

export function useHmiRuntime(canvas: fabric.Canvas) {
    const runtimeElems = ref<Record<string, any>>({})

    async function loadHmi(hmi: HmiFile) {
        console.debug('[runtime] ▶ loadHmi()', hmi)
        if (!canvas) {
            console.warn('[runtime] ⚠️ canvas is undefined, skipping loadHmi')
            return
        }

        const rawObjs = hmi.canvas?.objects
        console.debug('[runtime] hmi.canvas.objects length:', rawObjs?.length)
        canvas.clear()

        await new Promise<void>((done) => {
            fabric.util.enlivenObjects(rawObjs ?? [], (loaded) => {
                console.debug('[runtime] ✨ enlivened objects count:', loaded.length)
                loaded.forEach((o) => canvas.add(o))
                done()
            })
        })

        const map: Record<string, any> = {}
        const objectsCopy = [...canvas.getObjects()]
        console.debug('[runtime] canvas.getObjects count:', objectsCopy.length)

        for (const obj of objectsCopy) {
            const type = (obj as any).elementType
            if (!type) continue

            const props = (obj as any).customProps ?? {}
            let el: fabric.Object
            if (type === 'image') {
                el = obj
                el.set({
                    selectable: false,
                    evented: false,
                    hasControls: false,
                    lockMovementX: true,
                    lockMovementY: true,
                })
                el.setCoords()
            } else {
                const Ctor = ElementRegistry[type as keyof typeof ElementRegistry]
                if (!Ctor) {
                    console.warn('[runtime] unknown elementType, skipping:', type)
                    canvas.remove(obj)
                    continue
                }
                el = new Ctor(canvas, obj.left ?? 0, obj.top ?? 0, props)
                el.customProps = { ...el.customProps, ...props }
                el.updateFromProps?.()

                el.id = obj.id || crypto.randomUUID()
                // bindings are saved as 'bindingsData' by editor's BaseElement.toObject
                const savedBindings = (obj as any).bindingsData ?? (obj as any).bindings ?? { inputs: {}, outputs: {} }
                el.bindings = savedBindings

                el.set({
                    scaleX: obj.scaleX,
                    scaleY: obj.scaleY,
                    skewX: obj.skewX,
                    skewY: obj.skewY,
                    angle: obj.angle,
                    flipX: obj.flipX,
                    flipY: obj.flipY,
                    originX: obj.originX,
                    originY: obj.originY,
                    selectable: false,
                    hasControls: false,
                    lockMovementX: true,
                    lockMovementY: true,
                })
                el.setCoords()

                canvas.remove(obj)
            }

            map[el.id!] = el
        }


        runtimeElems.value = map
        canvas.requestRenderAll()
        console.debug('[runtime] ✅ runtimeElems keys:', Object.keys(map))

        const bindingMaps: BindingMap[] = canvas.getObjects().map(o => ({
            elementId: o.id!,
            inputBindings: (o as any).bindings?.inputs || {},
            outputBindings: (o as any).bindings?.outputs || {}
        }))

        console.debug('[runtime] binding map:', bindingMaps)
        attachStoreWatcher(bindingMaps, map)

        // push initial values of output-bound elements to backend (after a small delay to let tick() run first)
        setTimeout(() => {
            const ss = useSessionStore()
            for (const [, el] of Object.entries(map)) {
                const outputs = (el as any).bindings?.outputs ?? {}
                for (const [pinName, path] of Object.entries(outputs) as [string, string][]) {
                    if (!path) continue
                    const value = (el as any).customProps?.[pinName]
                    if (value === undefined) continue
                    console.debug('[runtime] sending initial value:', path, '=', value)
                    const payload = buildInputPayload(path, value)
                    if (Object.keys(payload).length > 0) {
                        ss.sendInputs(payload).catch(console.error)
                    }
                }
            }
        }, 100)
    }

    function attachStoreWatcher(
        bindings: BindingMap[],
        elems: Record<string, any>
    ) {
        const ss = useSessionStore()
        console.debug('[runtime] ▶ attachStoreWatcher, count=', bindings.length)

        // tick on store change
        watch(
            () => [ss.plc, ss.plant],
            () => { tick() },
            { deep: true, immediate: true }
        )

        // also tick every second to guarantee updates even if store reference doesn't change
        const interval = setInterval(tick, 1000)
        canvas.on('canvas:disposed', () => clearInterval(interval))

        function tick() {
            for (const b of bindings) {
                const el = elems[b.elementId]
                if (!el) continue

                const state: Record<string, any> = {}
                for (const [pin, path] of Object.entries(b.inputBindings ?? {})) {
                    state[pin] = resolveStorePath(ss, path)
                }
                el.setState?.(state)
            }
            canvas.requestRenderAll()
        }

        canvas.on('element:output', (e: any) => {
            console.debug('[runtime] ← element:output', e)
            const bind = bindings.find((b) => b.elementId === e.target?.id)
            if (!bind) return
            const path = bind.outputBindings?.[e.name]
            if (!path) return
            ss.sendInputs(buildInputPayload(path, e.value)).catch(console.error)
        })
    }

    return {loadHmi}
}
