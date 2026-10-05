import './assets/main.css'
import 'vue-sonner/style.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueRendererMarkdown } from 'markstream-vue'

import App from './App.vue'
import { i18n } from './i18n/config'
import { markstreamI18n } from './i18n/markstream'

const app = createApp(App)

app.use(createPinia())
app.use(i18n)
// markstream 的界面文案（代码块复制等）走我们的 i18n，见 src/i18n/markstream.ts
app.use(VueRendererMarkdown, { defaultI18nMap: markstreamI18n })

app.mount('#app')
