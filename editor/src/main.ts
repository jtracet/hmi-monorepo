import { createApp } from 'vue'
import { createPinia } from 'pinia'
import naive from 'naive-ui'
import App from './App.vue'
import './index.css'

import { useSessionStore } from './store/session'

const app  = createApp(App)
const pinia = createPinia()
app.use(pinia).use(naive)

const sessionId = new URLSearchParams(location.search).get('session') || ''
if (sessionId) {
    const ss = useSessionStore()
    ss.setSession(sessionId)
}

app.mount('#app')
