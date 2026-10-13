import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
  {
    path: '/',
    component: () => import('../layouts/AdminLayout.vue'),
    redirect: '/overview',
    children: [
      { path: 'overview', name: 'overview', component: () => import('../views/OverviewView.vue'), meta: { title: '概览' } },
      { path: 'users', name: 'users', component: () => import('../views/UsersView.vue'), meta: { title: '用户管理' } },
      { path: 'campaigns', name: 'campaigns', component: () => import('../views/CampaignsView.vue'), meta: { title: '战役管理' } },
      { path: 'rooms', name: 'rooms', component: () => import('../views/RoomsView.vue'), meta: { title: '房间' } },
      { path: 'workshop', name: 'workshop', component: () => import('../views/WorkshopView.vue'), meta: { title: '创意工坊' } },
      { path: 'review', name: 'review', component: () => import('../views/ReviewView.vue'), meta: { title: '战役审核' } },
      { path: 'library', name: 'library', component: () => import('../views/LibraryView.vue'), meta: { title: '资源库审核' } },
      { path: 'game-releases', name: 'game-releases', component: () => import('../views/GameReleasesView.vue'), meta: { title: '游戏版本' } },
      { path: 'game-data', name: 'game-data', component: () => import('../views/GameDataView.vue'), meta: { title: '游戏数据版本' } },
      { path: 'web-template', name: 'web-template', component: () => import('../views/WebTemplateView.vue'), meta: { title: '网页版模板' } },
      { path: 'steam-apps', name: 'steam-apps', component: () => import('../views/SteamAppsView.vue'), meta: { title: 'Steam 应用' } },
      { path: 'license-orders', name: 'license-orders', component: () => import('../views/LicenseOrdersView.vue'), meta: { title: '激活码订单' } },
      { path: 'maker-releases', name: 'maker-releases', component: () => import('../views/ExeReleasesView.vue'), props: { product: 'maker' }, meta: { title: 'Maker 版本' } },
      { path: 'lan-server-releases', name: 'lan-server-releases', component: () => import('../views/ExeReleasesView.vue'), props: { product: 'lanServer' }, meta: { title: '用户版服务器' } },
      { path: 'assets', name: 'assets', component: () => import('../views/AssetsView.vue'), meta: { title: '素材管理' } },
      { path: 'blobs', redirect: { name: 'assets' } }, // 老图床管理页 2026-10-13 下掉，旧书签跳到素材管理
      { path: 'settings', name: 'settings', component: () => import('../views/SettingsView.vue'), meta: { title: '全局配置' } },
      { path: 'audit', name: 'audit', component: () => import('../views/AuditView.vue'), meta: { title: '操作审计' } },
      { path: 'login-logs', name: 'login-logs', component: () => import('../views/LoginLogsView.vue'), meta: { title: '登录日志' } },
      { path: 'change-password', name: 'change-password', component: () => import('../views/ChangePasswordView.vue'), meta: { title: '修改密码' } },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const token = localStorage.getItem('slgm_admin_token')
  if (to.name !== 'login' && !token) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'login' && token) {
    return { name: 'overview' }
  }
})

export default router
