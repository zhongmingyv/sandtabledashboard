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
      { path: 'game-releases', name: 'game-releases', component: () => import('../views/GameReleasesView.vue'), meta: { title: '游戏版本' } },
      { path: 'maker-releases', name: 'maker-releases', component: () => import('../views/MakerReleasesView.vue'), meta: { title: 'Maker 版本' } },
      { path: 'blobs', name: 'blobs', component: () => import('../views/BlobsView.vue'), meta: { title: '图床管理' } },
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
