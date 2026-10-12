import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import './styles.css'

// 后台一更新，还开着旧页面的浏览器会去要旧版本的分块脚本（文件名带内容哈希，新版里已经没了）。
// Cloudflare 对找不到的路径一律回首页，浏览器把 HTML 当脚本就报「Failed to fetch dynamically imported module」，
// 页面卡死在那一步。碰到这种情况自动整页重载一次，拿到新版首页与新的文件名。
// 10 秒内只重载一次：真是服务器坏了的时候不至于无限刷新。
function reloadForNewVersion(path) {
  try {
    const last = Number(sessionStorage.getItem('slgm_chunk_reload_at') || 0)
    if (Date.now() - last < 10000) return false
    sessionStorage.setItem('slgm_chunk_reload_at', String(Date.now()))
  } catch {
    // 存不了（隐私模式等）：照样重载这一次
  }
  if (path) window.location.assign(path)
  else window.location.reload()
  return true
}
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewVersion()) event.preventDefault()
})
router.onError((error, to) => {
  if (/dynamically imported module|Importing a module script failed|Failed to load module script/i.test(error?.message || ''))
    reloadForNewVersion(to?.fullPath)
})

const app = createApp(App)
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.mount('#app')
