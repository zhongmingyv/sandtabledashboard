<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../store/auth'
import { api } from '../api/admin'
import { USE_MOCK, API_BASE } from '../config'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const activeMenu = computed(() => route.name)

// 有 children 的是分组（可折叠的父节点），没有的直接是页面
const menus = [
  { name: 'overview', title: '概览', icon: 'DataLine' },
  {
    group: 'players', title: '玩家与对局', icon: 'User',
    children: [
      { name: 'users', title: '用户管理', icon: 'User' },
      { name: 'rooms', title: '房间', icon: 'Connection' },
    ],
  },
  {
    group: 'content', title: '内容与审核', icon: 'Files',
    children: [
      { name: 'campaigns', title: '战役管理', icon: 'Files' },
      { name: 'review', title: '战役审核', icon: 'Checked' },
      { name: 'library', title: '资源库审核', icon: 'Collection' },
      { name: 'arenas', title: '擂台', icon: 'Trophy' },
      { name: 'workshop', title: '创意工坊', icon: 'Shop' },
      { name: 'assets', title: '素材管理', icon: 'Picture' },
    ],
  },
  {
    group: 'releases', title: '版本发布', icon: 'Upload',
    children: [
      { name: 'game-releases', title: '游戏版本', icon: 'Upload' },
      { name: 'game-data', title: '游戏数据版本', icon: 'FolderOpened' },
      { name: 'web-template', title: '网页版模板', icon: 'Platform' },
      { name: 'maker-releases', title: 'Maker 版本', icon: 'Monitor' },
      { name: 'lan-server-releases', title: '用户版服务器', icon: 'Cpu' },
      { name: 'temp-files', title: '临时文件', icon: 'Link' },
    ],
  },
  {
    group: 'commerce', title: 'Steam 与销售', icon: 'Key',
    children: [
      { name: 'steam-apps', title: 'Steam 应用', icon: 'Key' },
      { name: 'license-orders', title: '激活码订单', icon: 'Tickets' },
    ],
  },
  {
    group: 'system', title: '系统', icon: 'Setting',
    children: [
      { name: 'settings', title: '全局配置', icon: 'Setting' },
      { name: 'audit', title: '操作审计', icon: 'Document' },
      { name: 'login-logs', title: '登录日志', icon: 'List' },
    ],
  },
]

// 默认只展开当前页所在的那一组
const openGroups = computed(() =>
  menus.filter((g) => g.children?.some((c) => c.name === route.name)).map((g) => g.group),
)

async function logout() {
  try {
    await api.logout()
  } catch {
    /* 忽略 */
  }
  auth.clear()
  router.push({ name: 'login' })
}
</script>

<template>
  <el-container style="height: 100%">
    <el-aside width="200px" style="background: #001529">
      <div style="color: #fff; font-size: 16px; font-weight: 600; padding: 18px 20px">
        SLGM 运营后台
      </div>
      <el-menu
        :default-active="activeMenu"
        :default-openeds="openGroups"
        background-color="#001529"
        text-color="#c0c4cc"
        active-text-color="#409eff"
        router
      >
        <template v-for="m in menus" :key="m.group || m.name">
          <el-sub-menu v-if="m.children" :index="m.group">
            <template #title>
              <el-icon><component :is="m.icon" /></el-icon>
              <span>{{ m.title }}</span>
            </template>
            <el-menu-item v-for="c in m.children" :key="c.name" :index="c.name" :route="{ name: c.name }">
              <el-icon><component :is="c.icon" /></el-icon>
              <span>{{ c.title }}</span>
            </el-menu-item>
          </el-sub-menu>
          <el-menu-item v-else :index="m.name" :route="{ name: m.name }">
            <el-icon><component :is="m.icon" /></el-icon>
            <span>{{ m.title }}</span>
          </el-menu-item>
        </template>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header
        style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #fff;
          border-bottom: 1px solid #eee;
        "
      >
        <div style="font-size: 16px">{{ route.meta.title || '' }}</div>
        <div style="display: flex; align-items: center; gap: 16px">
          <el-tag v-if="USE_MOCK" type="warning" size="small">MOCK 模式 · 未接后端</el-tag>
          <el-tag v-else type="success" size="small">{{ API_BASE }}</el-tag>
          <span style="color: #666">{{ auth.username || 'admin' }}</span>
          <el-button link type="primary" @click="router.push({ name: 'change-password' })">修改密码</el-button>
          <el-button link type="primary" @click="logout">退出</el-button>
        </div>
      </el-header>
      <el-main style="background: #f5f7fa">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>
