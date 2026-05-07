import {ref, watch} from 'vue'
import {fabric} from 'fabric'
import {resolveStorePath, buildInputPayload} from './helpers'
import {ElementRegistry} from '@/elements'
import {useSessionStore} from '@/store/session'

export interface HmiFile {
    meta: { version: string; created: string }
    // v2.0 format
    pages?: Array<{ id: string; name: string; canvasJson: any; view: any }>
    activePageId?: string
    // v1.0 legacy format
    canvas?: any
    bindings?: BindingMap[]
    view?: any
    grid?: any
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

        // Поддержка v2.0 (pages) и v1.0 (canvas.objects)
        let rawObjs: any[]
        if (hmi.pages && Array.isArray(hmi.pages)) {
            const activePage = hmi.pages[0]
            rawObjs = activePage?.canvasJson?.objects ?? []
        } else {
            rawObjs = hmi.canvas?.objects ?? []
        }

        console.debug('[runtime] objects to load:', rawObjs?.length)
        canvas.clear()

        const map: Record<string, any> = {}

        for (const obj of rawObjs ?? []) {
            const type = obj.elementType

            // --- IMAGE (через enliven) ---
            if (type === 'image') {
                await new Promise<void>((resolve) => {
                    fabric.util.enlivenObjects([obj], (objs: fabric.Object[]) => {
                        const img = objs[0]
                        if (!img) return resolve()

                        img.set({
                            selectable: false,
                            evented: false,
                            hasControls: false,
                            lockMovementX: true,
                            lockMovementY: true,
                        })

                        img.id = obj.id || crypto.randomUUID()
                        map[img.id] = img

                        canvas.add(img)
                        resolve()
                    })
                })
                continue
            }

            // --- UNKNOWN / DECORATION ---
            if (!type) {
                const rect = new fabric.Rect(obj)
                rect.set({
                    selectable: false,
                    evented: false,
                })
                canvas.add(rect)
                continue
            }

            // --- CUSTOM ELEMENT ---
            const Ctor = ElementRegistry[type as keyof typeof ElementRegistry]
            if (!Ctor) {
                console.warn('[runtime] unknown elementType, skipping:', type)
                continue
            }

            const props = obj.customProps ?? {}
            const el = new Ctor(canvas, obj.left ?? 0, obj.top ?? 0, props)

            el.id = obj.id || crypto.randomUUID()

            const bindings =
                obj.bindingsData ??
                obj.bindings ??
                { inputs: {}, outputs: {} }

            el.bindings = bindings

            el.set({
                scaleX: obj.scaleX ?? 1,
                scaleY: obj.scaleY ?? 1,
                angle: obj.angle ?? 0,
                flipX: obj.flipX ?? false,
                flipY: obj.flipY ?? false,
                selectable: false,
                hasControls: false,
                lockMovementX: true,
                lockMovementY: true,
            })

            el.setCoords()
            el.updateFromProps?.()

            map[el.id] = el
        
        }


        runtimeElems.value = map
        canvas.getObjects().forEach(o => o.setCoords())
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
