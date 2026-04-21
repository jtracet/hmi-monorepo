import { defineStore } from 'pinia'

export interface PageState {
    id: string
    name: string
    canvasJson: any | null
    view: { zoom: number; offsetX: number; offsetY: number } | null
}

function makePage(name: string): PageState {
    return { id: crypto.randomUUID(), name, canvasJson: null, view: null }
}

export const usePagesStore = defineStore('pages', {
    state: () => ({
        pages: [makePage('Page 1')] as PageState[],
        activePageId: '' as string,
    }),
    getters: {
        activePage: (state) => state.pages.find(p => p.id === state.activePageId) ?? state.pages[0],
    },
    actions: {
        init() {
            if (!this.activePageId && this.pages.length > 0) {
                this.activePageId = this.pages[0].id
            }
        },
        addPage() {
            const page = makePage(`Page ${this.pages.length + 1}`)
            this.pages.push(page)
            return page
        },
        removePage(id: string) {
            if (this.pages.length <= 1) return
            const idx = this.pages.findIndex(p => p.id === id)
            this.pages.splice(idx, 1)
            if (this.activePageId === id) {
                this.activePageId = this.pages[Math.max(0, idx - 1)].id
            }
        },
        renamePage(id: string, name: string) {
            const page = this.pages.find(p => p.id === id)
            if (page) page.name = name
        },
        saveCurrentPageState(canvasJson: any, view: any) {
            const page = this.pages.find(p => p.id === this.activePageId)
            if (page) {
                page.canvasJson = canvasJson
                page.view = view
            }
        },
        setActivePage(id: string) {
            this.activePageId = id
        },
        /** Serialize all pages for file export */
        serialize() {
            return this.pages.map(p => ({ ...p }))
        },
        /** Restore pages from file import */
        restore(pages: PageState[], activeId?: string) {
            this.pages = pages
            this.activePageId = activeId ?? pages[0]?.id ?? ''
        },
    },
})
